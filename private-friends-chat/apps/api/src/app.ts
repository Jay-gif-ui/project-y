import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import type { HealthResponse } from "@private-chat/shared";
import {
  hashIp,
  hashSessionToken,
  createSessionToken,
  sessionCookieName,
} from "./auth/session.js";
import { LoginThrottler } from "./auth/throttle.js";
import type { AuthRepository, AuthUser } from "./auth/types.js";
import { verifyPassword } from "./auth/password.js";

export interface AppConfig {
  webOrigin: string;
  sessionSecret: string;
  sessionTtlDays: number;
  isProduction: boolean;
}

interface AuthenticatedRequest {
  authUser?: AuthUser;
}

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(254)
    .refine(
      (value) => /^[a-z0-9_]+$/.test(value) || z.email().safeParse(value).success,
    ),
  password: z.string().min(1).max(256),
});

function apiError(code: string, message: string) {
  return { error: { code, message } };
}

export function buildApp(config: AppConfig, repository?: AuthRepository) {
  const app = Fastify({ logger: true });
  const throttler = new LoginThrottler();

  app.register(cookie, { secret: config.sessionSecret, hook: "onRequest" });
  app.register(rateLimit, { global: false });
  app.register(cors, {
    origin: config.webOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  });

  app.get("/api/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  }));

  async function getAuthenticatedUser(
    request: FastifyRequest,
  ): Promise<AuthUser | null> {
    const token = request.cookies[sessionCookieName];
    if (!token || !repository) return null;
    return repository.findActiveUserBySessionHash(
      hashSessionToken(token, config.sessionSecret),
    );
  }

  async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<boolean> {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      reply
        .code(401)
        .send(apiError("UNAUTHORIZED", "Authentication required."));
      return false;
    }
    (request as AuthenticatedRequest).authUser = user;
    return true;
  }

  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!repository)
        return reply
          .code(503)
          .send(
            apiError(
              "SERVICE_UNAVAILABLE",
              "Authentication is not configured.",
            ),
          );
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send(apiError("VALIDATION_ERROR", "Invalid username or password."));
      const key = `${request.ip}:${parsed.data.identifier}`;
      if (throttler.isBlocked(key))
        return reply
          .code(429)
          .send(
            apiError(
              "LOGIN_THROTTLED",
              "Too many failed login attempts. Try again later.",
            ),
          );

      const user = await repository.findUserByIdentifier(parsed.data.identifier);
      const valid =
        user && user.status === "ACTIVE"
          ? await verifyPassword(user.passwordHash, parsed.data.password)
          : false;
      if (!valid || !user) {
        throttler.recordFailure(key);
        await repository.recordSecurityEvent({
          userId: user?.id ?? null,
          eventType: "LOGIN_FAILED",
          ipHash: hashIp(request.ip, config.sessionSecret),
        });
        return reply
          .code(401)
          .send(
            apiError("INVALID_CREDENTIALS", "Invalid username or password."),
          );
      }

      const token = createSessionToken();
      const expiresAt = new Date(
        Date.now() + config.sessionTtlDays * 86_400_000,
      );
      await repository.createSession({
        userId: user.id,
        sessionHash: hashSessionToken(token, config.sessionSecret),
        expiresAt,
      });
      await repository.recordSecurityEvent({
        userId: user.id,
        eventType: "LOGIN_SUCCEEDED",
        ipHash: hashIp(request.ip, config.sessionSecret),
      });
      throttler.clear(key);
      reply.setCookie(sessionCookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProduction,
        path: "/",
        expires: expiresAt,
      });
      return reply.send({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    },
  );

  app.post("/api/auth/logout", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;
    const token = request.cookies[sessionCookieName];
    if (token && repository)
      await repository.revokeSession(
        hashSessionToken(token, config.sessionSecret),
      );
    reply.clearCookie(sessionCookieName, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
      path: "/",
    });
    return reply.code(204).send();
  });

  app.get("/api/auth/me", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;
    const { authUser } = request as typeof request & AuthenticatedRequest;
    return reply.send({ user: authUser });
  });

  app.get("/api/private/ping", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;
    return reply.send({ ok: true });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply
      .code(500)
      .send(apiError("INTERNAL_ERROR", "An unexpected error occurred."));
  });

  return app;
}
