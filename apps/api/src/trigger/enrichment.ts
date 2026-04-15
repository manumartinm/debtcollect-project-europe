import { logger, task } from "@trigger.dev/sdk"

import { lookupAgentApi, lookupRequestSchema } from "../lib/lookup.js"

export const unifiedEnrichmentTask = task({
  id: "unified-enrichment",
  maxDuration: 3600,
  run: async (payload: unknown) => {
    const request = lookupRequestSchema.parse(payload)

    logger.log("Starting unified enrichment", {
      subject: request.subject,
      maxResults: request.maxResults,
    })

    const result = await lookupAgentApi.runUnifiedIngestionPipeline(
      request.subject,
      request.maxResults
    )

    logger.log("Unified enrichment complete", {
      sources: result.toolRuns.map((run) =>
        run.ok
          ? {
              source: run.source,
              confidence: run.selection.confidence,
              selected: Boolean(run.selection.selectedItem),
            }
          : {
              source: run.source,
              error: run.error,
            }
      ),
    })

    return result
  },
})
