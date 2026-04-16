import "./load-env.js"

import { logger, task } from "@trigger.dev/sdk"

import { formatEnrichmentFailure } from "../lib/enrichment-error.js"
import { DebtorModel } from "../models/debtor.model.js"
import { safeGenerateObject } from "./lib/llm-extract.js"
import { resolveOpenAiResearchModelId } from "./lib/openai-model.js"
import { ApifyActorPipeline } from "./lib/debtor-enrichment/apify-actor-pipeline.js"
import { buildEnrichmentLlmPrompt } from "./lib/debtor-enrichment/enrichment-prompt.js"
import { persistEnrichmentOutput } from "./lib/debtor-enrichment/persist-enrichment.js"
import { computeSolExpirationIso } from "./lib/fdcpa.js"
import { debtorEnrichmentLog } from "./lib/task-logger.js"
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
 *
 * Logs: use `pnpm trigger:dev` (or `npm run trigger:dev`) — output appears in the Trigger CLI and the run page.
 * For more detail, set `logLevel: "debug"` in `trigger.config.ts`.
 */
export const debtorEnrichmentTask = task({
  id: "debtor-enrichment",
  maxDuration: 1800,
  run: async (payload: DebtorEnrichmentPayload) => {
    debtorEnrichmentLog.info("task run started", { payload })

    const debtor = await DebtorModel.findById(payload.debtorId)
    if (!debtor) {
      debtorEnrichmentLog.error("debtor not found", { debtorId: payload.debtorId })
      throw new Error(`Debtor ${payload.debtorId} not found`)
    }

    const facts = inputFactsSchema.parse(buildSubjectFacts(debtor))
    logger.log("debtor-enrichment start", {
      debtorId: facts.debtorId,
      caseRef: facts.caseRef,
      fullName: facts.fullName,
      state: facts.state,
    })
    debtorEnrichmentLog.info("subject facts loaded", {
      debtorId: facts.debtorId,
      caseRef: facts.caseRef,
      state: facts.state,
      hasPhone: Boolean(facts.phone),
      hasAddress: Boolean(facts.address),
      hasEmail: Boolean(facts.email),
      courtListenerTokenConfigured: Boolean(process.env.COURTLISTENER_API_TOKEN?.trim()),
    })

    await DebtorModel.update(debtor.id, {
      enrichmentStatus: "running",
      enrichmentError: null,
    })
    debtorEnrichmentLog.info("DB: enrichmentStatus -> running", { debtorId: debtor.id })

    try {
      const fdcpa = computeSolExpirationIso(undefined, facts.state)
      debtorEnrichmentLog.info("FDCPA / SOL context (no delinquency date on debtor)", {
        state: facts.state,
        solYears: fdcpa.years,
        solExpirationIso: fdcpa.expirationIso,
        timeBarred: fdcpa.timeBarred,
      })

      const tApify = Date.now()
      const branches = await new ApifyActorPipeline(facts).run()
      debtorEnrichmentLog.info("Apify pipeline complete", {
        durationMs: Date.now() - tApify,
      })

      debtorEnrichmentLog.info("LLM: calling generateObject (structured enrichment)", {
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: resolveOpenAiResearchModelId(),
      })
      const tLlm = Date.now()
      const llm = await safeGenerateObject({
        system:
          "You consolidate parallel Apify evidence into structured debtor enrichment for US collections. Be conservative; only emit supported fields.",
        prompt: buildEnrichmentLlmPrompt({ facts, branches, fdcpa }),
        schema: debtorEnrichmentOutputSchema,
        schemaName: "DebtorEnrichment",
      })
      const llmMs = Date.now() - tLlm

      if (!llm) {
        debtorEnrichmentLog.warn("LLM returned null — check OPENAI_API_KEY or prior [llm-extract] errors", {
          durationMs: llmMs,
        })
      } else {
        const fieldKeys = (Object.keys(llm) as (keyof DebtorEnrichmentOutput)[]).filter(
          (k) => llm[k] != null,
        )
        debtorEnrichmentLog.info("LLM: structured output received", {
          durationMs: llmMs,
          fieldKeys,
        })
      }

      const finalOutput: DebtorEnrichmentOutput = llm ?? ({} as DebtorEnrichmentOutput)
      const tPersist = Date.now()
      const persisted = await persistEnrichmentOutput(debtor.id, finalOutput, branches)
      debtorEnrichmentLog.info("DB: enriched fields + trace steps persisted", {
        durationMs: Date.now() - tPersist,
        fieldNames: persisted.map((p) => p.fieldName),
        count: persisted.length,
      })

      await DebtorModel.update(debtor.id, {
        enrichmentStatus: "complete",
        enrichmentError: null,
      })
      debtorEnrichmentLog.info("DB: enrichmentStatus -> complete", { debtorId: debtor.id })

      logger.log("debtor-enrichment complete", {
        debtorId: debtor.id,
        caseRef: debtor.caseRef,
        persisted: persisted.map((row) => row.fieldName),
      })
      debtorEnrichmentLog.info("task run finished OK", {
        debtorId: debtor.id,
        caseRef: debtor.caseRef,
        totalFieldsPersisted: persisted.length,
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
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      debtorEnrichmentLog.error("task run failed", {
        debtorId: debtor.id,
        error: message,
        stack,
      })
      await DebtorModel.update(debtor.id, {
        enrichmentStatus: "failed",
        enrichmentError: formatEnrichmentFailure(err),
      })
      debtorEnrichmentLog.info("DB: enrichmentStatus -> failed", { debtorId: debtor.id })
      throw err
    }
  },
})
