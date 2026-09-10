import { buildApp } from "./app.js";
import { PostgresAuthRepository } from "./db/repository.js";
import { createPool } from "./db/pool.js";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3000");
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const sessionSecret = process.env.SESSION_SECRET;
const databaseUrl = process.env.DATABASE_URL;
const sessionTtlDays = Number(process.env.SESSION_TTL_DAYS ?? "14");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}
if (!sessionSecret || sessionSecret.length < 32)
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!Number.isInteger(sessionTtlDays) || sessionTtlDays < 1 || sessionTtlDays > 90) {
  throw new Error("SESSION_TTL_DAYS must be an integer between 1 and 90.");
}

const pool = createPool(databaseUrl);
const app = buildApp(
  {
    webOrigin,
    sessionSecret,
    sessionTtlDays,
    isProduction: process.env.NODE_ENV === "production",
  },
  new PostgresAuthRepository(pool),
);

app.addHook("onClose", async () => {
  await pool.end();
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
