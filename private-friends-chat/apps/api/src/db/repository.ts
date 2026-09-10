import type { Pool } from "pg";
import type { AuthRepository, AuthUser, StoredUser } from "../auth/types.js";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: StoredUser["role"];
  status: StoredUser["status"];
}

function toUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
  };
}

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly pool: Pool) {}

  public async findUserByIdentifier(
    identifier: string,
  ): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT id, username, display_name, password_hash, role, status FROM users WHERE username = $1 OR email = $1",
      [identifier],
    );
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  public async findActiveUserBySessionHash(
    sessionHash: string,
  ): Promise<AuthUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT u.id, u.username, u.display_name, u.password_hash, u.role, u.status
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.session_hash = $1 AND s.expires_at > now() AND s.revoked_at IS NULL AND u.status = 'ACTIVE'`,
      [sessionHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    await this.pool.query(
      "UPDATE sessions SET last_used_at = now() WHERE session_hash = $1",
      [sessionHash],
    );
    const { passwordHash: _passwordHash, ...user } = toUser(row);
    return user;
  }

  public async createSession(input: {
    userId: string;
    sessionHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      "INSERT INTO sessions (user_id, session_hash, expires_at) VALUES ($1, $2, $3)",
      [input.userId, input.sessionHash, input.expiresAt],
    );
  }

  public async revokeSession(sessionHash: string): Promise<void> {
    await this.pool.query(
      "UPDATE sessions SET revoked_at = now() WHERE session_hash = $1",
      [sessionHash],
    );
  }

  public async createOwner(input: {
    username: string;
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<void> {
    await this.pool.query(
      "INSERT INTO users (username, display_name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'OWNER', 'ACTIVE')",
      [input.username, input.displayName, input.email, input.passwordHash],
    );
  }

  public async hasOwner(): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM users WHERE role = 'OWNER') AS exists",
    );
    return result.rows[0]?.exists ?? false;
  }

  public async recordSecurityEvent(input: {
    userId: string | null;
    eventType: string;
    ipHash: string | null;
  }): Promise<void> {
    await this.pool.query(
      "INSERT INTO security_events (user_id, event_type, ip_hash) VALUES ($1, $2, $3)",
      [input.userId, input.eventType, input.ipHash],
    );
  }
}
