import { logger, task } from "@trigger.dev/sdk"

import { DebtorModel } from "../models/debtor.model.js"
import { safeGenerateObject } from "./lib/llm-extract.js"
import { ApifyActorPipeline } from "./lib/debtor-enrichment/apify-actor-pipeline.js"
import { buildEnrichmentLlmPrompt } from "./lib/debtor-enrichment/enrichment-prompt.js"
import { persistEnrichmentOutput } from "./lib/debtor-enrichment/persist-enrichment.js"
import { computeSolExpirationIso } from "./lib/fdcpa.js"
import {
  buildSubjectFacts,
  inputFactsSchema,
} from "./lib/debtor-enrichment/subject-facts.js"
import {
  debtorEnrichmentOutputSchema,
  type DebtorEnrichmentOutput,
  type DebtorEnrichmentPayload,
} from "./types.js"

/**
 * Orchestrates debtor enrichment: {@link ApifyActorPipeline} → LLM structured output → DB trace + sources.
 */
export const debtorEnrichmentTask = task({
  id: "debtor-enrichment",
  maxDuration: 1800,
  run: async (payload: DebtorEnrichmentPayload) => {
    const debtor = await DebtorModel.findById(payload.debtorId)
    if (!debtor) {
      throw new Error(`Debtor ${payload.debtorId} not found`)
    }

    const facts = inputFactsSchema.parse(buildSubjectFacts(debtor))
    logger.log("debtor-enrichment start", {
      debtorId: facts.debtorId,
      caseRef: facts.caseRef,
      fullName: facts.fullName,
      state: facts.state,
    })

    await DebtorModel.update(debtor.id, { enrichmentStatus: "running" })

    try {
      const fdcpa = computeSolExpirationIso(undefined, facts.state)
      const branches = await new ApifyActorPipeline(facts).run()

      const llm = await safeGenerateObject({
        system:
          "You consolidate parallel Apify evidence into structured debtor enrichment for US collections. Be conservative; only emit supported fields.",
        prompt: buildEnrichmentLlmPrompt({ facts, branches, fdcpa }),
        schema: debtorEnrichmentOutputSchema,
        schemaName: "DebtorEnrichment",
      })

      const finalOutput: DebtorEnrichmentOutput = llm ?? {}
      const persisted = await persistEnrichmentOutput(debtor.id, finalOutput, branches)

      await DebtorModel.update(debtor.id, {
        enrichmentStatus: "complete",
      })

      logger.log("debtor-enrichment complete", {
        debtorId: debtor.id,
        caseRef: debtor.caseRef,
        persisted: persisted.map((row) => row.fieldName),
      })

      return {
        debtorId: debtor.id,
        caseRef: debtor.caseRef,
        facts,
        fdcpa,
        branches,
        finalOutput,
        persisted,
      }
    } catch (err) {
      await DebtorModel.update(debtor.id, { enrichmentStatus: "failed" })
      throw err
    }
  },
})
