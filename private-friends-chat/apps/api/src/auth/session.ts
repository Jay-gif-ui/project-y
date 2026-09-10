import { createHmac, randomBytes } from "node:crypto";

export const sessionCookieName = "private_chat_session";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function hashIp(ip: string | undefined, secret: string): string | null {
  return ip ? createHmac("sha256", secret).update(ip).digest("hex") : null;
}
