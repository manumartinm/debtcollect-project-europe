import { logger } from "@trigger.dev/sdk"

const SCOPE = "debtor-enrichment"

type JsonRecord = Record<string, unknown>

/**
 * Structured logs for Trigger.dev runs (visible in `pnpm trigger:dev` / dashboard).
 * Use {@link logger.debug} for per-actor noise — enable with `logLevel: "debug"` in `trigger.config.ts`.
 */
export const debtorEnrichmentLog = {
  info(message: string, data?: JsonRecord) {
    logger.info(`[${SCOPE}] ${message}`, { scope: SCOPE, ...data })
  },

  debug(message: string, data?: JsonRecord) {
    logger.debug(`[${SCOPE}] ${message}`, { scope: SCOPE, ...data })
  },

  warn(message: string, data?: JsonRecord) {
    logger.warn(`[${SCOPE}] ${message}`, { scope: SCOPE, ...data })
  },

  error(message: string, data?: JsonRecord) {
    logger.error(`[${SCOPE}] ${message}`, { scope: SCOPE, ...data })
  },
}
