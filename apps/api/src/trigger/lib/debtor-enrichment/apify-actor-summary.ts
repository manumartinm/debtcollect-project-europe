import type { ActorRunResult } from "../apify.js"

/** Compact summary for logs (no raw PII dumps). */
export function apifyRunSummary(run: ActorRunResult<Record<string, unknown>>) {
  return {
    actorId: run.actorId,
    runId: run.runId,
    itemCount: run.items.length,
    runUrl: run.runUrl,
  }
}
