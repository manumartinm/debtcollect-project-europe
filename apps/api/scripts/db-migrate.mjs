#!/usr/bin/env node
/**
 * Runs Drizzle migrations with full error output (drizzle-kit migrate often hides the message).
 * Usage from apps/api: node scripts/db-migrate.mjs
 */
import "dotenv/config"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const folder = join(__dirname, "..", "drizzle")

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (load apps/api/.env).")
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

try {
  await migrate(db, { migrationsFolder: folder })
  console.log("Migrations applied successfully.")
} catch (e) {
  console.error(e)
  const msg = e?.cause?.message ?? e?.message ?? ""
  if (
    typeof msg === "string" &&
    msg.includes("already exists") &&
    msg.includes("debtors")
  ) {
    console.error(
      "\nHint: Drizzle is re-applying an old migration because `drizzle.__drizzle_migrations` " +
        "has a `created_at` lower than that migration’s journal `when`. " +
        "Repair with:\n" +
        "  UPDATE drizzle.__drizzle_migrations SET created_at = 1776294673306 " +
        "WHERE hash = 'b4c7b12990417931490d705a50ad471c08ba461f7bf654cc4931f597ea5326b0';\n" +
        "Then run `pnpm db:migrate` again.\n",
    )
  }
  process.exit(1)
} finally {
  await pool.end()
}
