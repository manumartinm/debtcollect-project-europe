-- Run once if `pnpm db:migrate` fails with "relation debtors already exists".
-- Drizzle re-runs migration 0001 when the row for 0001 in __drizzle_migrations has
-- created_at < journal `when` (1776294673306) for that file.
UPDATE drizzle.__drizzle_migrations
SET created_at = 1776294673306
WHERE hash = 'b4c7b12990417931490d705a50ad471c08ba461f7bf654cc4931f597ea5326b0';
