/**
 * Trigger.dev tasks run in a separate bundle from `src/index.ts`, so `import 'dotenv/config'`
 * there does not apply. Load `apps/api/.env` before any task reads `process.env`.
 */
import { config } from "dotenv"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(here, "../../.env") })
