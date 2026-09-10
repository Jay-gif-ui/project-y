export type AccountRole = "OWNER" | "ADMIN" | "MEMBER";
export type AccountStatus = "ACTIVE" | "DISABLED" | "REMOVED";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: AccountRole;
  status: AccountStatus;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
}

export interface AuthRepository {
  findUserByIdentifier(identifier: string): Promise<StoredUser | null>;
  findActiveUserBySessionHash(sessionHash: string): Promise<AuthUser | null>;
  createSession(input: {
    userId: string;
    sessionHash: string;
    expiresAt: Date;
  }): Promise<void>;
  revokeSession(sessionHash: string): Promise<void>;
  createOwner(input: {
    username: string;
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<void>;
  hasOwner(): Promise<boolean>;
  recordSecurityEvent(input: {
    userId: string | null;
    eventType: string;
    ipHash: string | null;
  }): Promise<void>;
}
