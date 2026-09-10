import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";
import { createPool } from "../db/pool.js";
import { PostgresAuthRepository } from "../db/repository.js";

const inputSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(256),
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const prompt = createInterface({ input: stdin, output: stdout });
const pool = createPool(databaseUrl);

try {
  const repository = new PostgresAuthRepository(pool);
  if (await repository.hasOwner())
    throw new Error(
      "An OWNER account already exists. Owner creation is intentionally one-time only.",
    );
  const data = inputSchema.parse({
    username: await prompt.question("Username: "),
    displayName: await prompt.question("Display name: "),
    email: await prompt.question("Email: "),
    password: await prompt.question("Password (minimum 12 characters): "),
  });
  await repository.createOwner({
    ...data,
    passwordHash: await hashPassword(data.password),
  });
  console.log("Owner account created.");
} finally {
  prompt.close();
  await pool.end();
}
