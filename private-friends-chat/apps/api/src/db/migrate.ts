import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./pool.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);
const pool = createPool(databaseUrl);

try {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const applied = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations",
  );
  const appliedFiles = new Set(applied.rows.map((row) => row.filename));
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (appliedFiles.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        await readFile(join(migrationsDirectory, file), "utf8"),
      );
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
