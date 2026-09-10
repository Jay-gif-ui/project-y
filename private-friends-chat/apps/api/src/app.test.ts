import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";
import { hashPassword } from "./auth/password.js";
import type { AuthRepository, AuthUser, StoredUser } from "./auth/types.js";

const config = {
  webOrigin: "http://localhost:5173",
  sessionSecret: "test-session-secret-that-is-at-least-32-characters",
  sessionTtlDays: 14,
  isProduction: false,
};

class MemoryAuthRepository implements AuthRepository {
  public readonly sessions = new Map<
    string,
    { userId: string; expiresAt: Date; revoked: boolean }
  >();
  public readonly events: string[] = [];
  public user: StoredUser | null = null;
  public email = "";

  public async findUserByIdentifier(
    identifier: string,
  ): Promise<StoredUser | null> {
    return this.user?.username === identifier || this.email === identifier
      ? this.user
      : null;
  }
  public async findActiveUserBySessionHash(
    sessionHash: string,
  ): Promise<AuthUser | null> {
    const session = this.sessions.get(sessionHash);
    if (
      !session ||
      session.revoked ||
      session.expiresAt <= new Date() ||
      session.userId !== this.user?.id ||
      this.user.status !== "ACTIVE"
    )
      return null;
    const { passwordHash: _passwordHash, ...user } = this.user;
    return user;
  }
  public async createSession(input: {
    userId: string;
    sessionHash: string;
    expiresAt: Date;
  }): Promise<void> {
    this.sessions.set(input.sessionHash, {
      userId: input.userId,
      expiresAt: input.expiresAt,
      revoked: false,
    });
  }
  public async revokeSession(sessionHash: string): Promise<void> {
    const session = this.sessions.get(sessionHash);
    if (session) session.revoked = true;
  }
  public async createOwner(): Promise<void> {
    throw new Error("Not used in tests");
  }
  public async hasOwner(): Promise<boolean> {
    return false;
  }
  public async recordSecurityEvent(input: {
    eventType: string;
  }): Promise<void> {
    this.events.push(input.eventType);
  }
}

test("health endpoint reports API status", async () => {
  const app = buildApp(config);
  const response = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    status: "ok",
    service: "api",
    timestamp: JSON.parse(response.body).timestamp,
  });

  await app.close();
});

test("login creates an HttpOnly session and protects private routes", async () => {
  const repository = new MemoryAuthRepository();
  repository.user = {
    id: "user-1",
    username: "owner",
    displayName: "Owner",
    passwordHash: await hashPassword("correct horse battery staple"),
    role: "OWNER",
    status: "ACTIVE",
  };
  repository.email = "owner@example.com";
  const app = buildApp(config, repository);

  const denied = await app.inject({ method: "GET", url: "/api/auth/me" });
  assert.equal(denied.statusCode, 401);

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      identifier: "owner@example.com",
      password: "correct horse battery staple",
    },
  });
  assert.equal(login.statusCode, 200);
  const cookie = login.headers["set-cookie"];
  assert.ok(cookie?.includes("HttpOnly"));
  assert.ok(cookie?.includes("SameSite=Lax"));

  const me = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(JSON.parse(me.body).user.username, "owner");

  const logout = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { cookie },
  });
  assert.equal(logout.statusCode, 204);
  const revoked = await app.inject({
    method: "GET",
    url: "/api/private/ping",
    headers: { cookie },
  });
  assert.equal(revoked.statusCode, 401);
  await app.close();
});

test("disabled accounts and failed login attempts are rejected", async () => {
  const repository = new MemoryAuthRepository();
  repository.user = {
    id: "user-1",
    username: "member",
    displayName: "Member",
    passwordHash: await hashPassword("correct horse battery staple"),
    role: "MEMBER",
    status: "DISABLED",
  };
  const app = buildApp(config, repository);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { identifier: "member", password: "correct horse battery staple" },
  });
  assert.equal(login.statusCode, 401);
  assert.equal(repository.events[0], "LOGIN_FAILED");
  await app.close();
});
