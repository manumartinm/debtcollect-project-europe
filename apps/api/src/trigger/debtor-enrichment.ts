import "./load-env.js"

import { logger, task } from "@trigger.dev/sdk"

import { formatEnrichmentFailure } from "../lib/enrichment-error.js"
import { DebtorModel } from "../models/debtor.model.js"
import { safeGenerateObject } from "./lib/llm-extract.js"
import { resolveOpenAiResearchModelId } from "./lib/openai-model.js"
import { ApifyActorPipeline } from "./lib/debtor-enrichment/apify-actor-pipeline.js"
import { buildEnrichmentLlmPrompt } from "./lib/debtor-enrichment/enrichment-prompt.js"
import {
  buildEvidenceFallbackOutput,
  mergeEnrichmentWithEvidenceFallback,
} from "./lib/debtor-enrichment/evidence-fallback.js"
import { persistEnrichmentOutput } from "./lib/debtor-enrichment/persist-enrichment.js"
import { countPipelineItems } from "./lib/debtor-enrichment/pipeline-types.js"
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

const LLM_SYSTEM_MESSAGE = `You consolidate parallel Apify evidence into structured debtor enrichment for US collections.

Two different outputs per populated field — do not confuse them:
1) "value" — This is the single human-readable summary shown as the field content. It must be normal prose: short sentences only. Never put JSON, object/array literals, markdown code blocks, or machine-readable key:value dumps inside "value". Imagine pasting into a CRM text field.
2) "explainability" — This is the reasoning trace (claims with citations). Keep structured claims here; this is not the same as "value".

For each field you populate, you MUST produce an "explainability" array of claims that shows your work:
- Each claim has: claim_content (plain-language: what the evidence says and why it supports the field), linked_citations (1+ real URLs from the evidence bundle), and confidence (High/Medium/Low).
- Claims are stored and may be shown as an audit trail. Be specific and cite real data. claim_content must also be plain text, not JSON.

CRITICAL RULES:
1. You may ONLY output a field if there is concrete, specific evidence for it in the actor evidence bundle.
2. If NO evidence exists for a field, you MUST return null for that field. Never guess, infer, or fabricate.
3. The "baseline identity facts" section is context — do NOT parrot those values back as new discoveries.
4. If every actor returned zero items, return null for ALL fields. Do not speculate.
5. Confidence must reflect actual evidence quality: "High" requires multiple corroborating sources; "Low" means a single weak signal.
6. Every non-null field MUST have explainability claims that cite real URLs from the evidence. Do not invent URLs.
7. When in doubt, return null. A missing field is always better than a wrong one.`

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
      const totalItems = countPipelineItems(branches)
      debtorEnrichmentLog.info("Apify pipeline complete", {
        durationMs: Date.now() - tApify,
        totalItems,
      })

      // ── No evidence → skip LLM, mark complete with "no data" ─────────
      if (totalItems === 0) {
        debtorEnrichmentLog.info("No evidence found across all actors — skipping LLM call", {
          debtorId: debtor.id,
        })

        await DebtorModel.update(debtor.id, {
          enrichmentStatus: "complete",
          enrichmentError: null,
          enrichmentConfidence: 0,
        })

        logger.log("debtor-enrichment complete (no data)", {
          debtorId: debtor.id,
          caseRef: debtor.caseRef,
        })

        return {
          debtorId: debtor.id,
          caseRef: debtor.caseRef,
          facts,
          fdcpa,
          branches,
          finalOutput: {} as DebtorEnrichmentOutput,
          persisted: [],
          noDataFound: true,
        }
      }

      // ── LLM consolidation ────────────────────────────────────────────
      debtorEnrichmentLog.info("LLM: calling generateObject (structured enrichment)", {
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: resolveOpenAiResearchModelId(),
        totalEvidenceItems: totalItems,
      })
      const tLlm = Date.now()
      const llm = await safeGenerateObject({
        system: LLM_SYSTEM_MESSAGE,
        prompt: buildEnrichmentLlmPrompt({ facts, branches, fdcpa }),
        schema: debtorEnrichmentOutputSchema,
        schemaName: "DebtorEnrichment",
      })
      const llmMs = Date.now() - tLlm

      let populatedFieldCount = 0
      if (!llm) {
        debtorEnrichmentLog.warn("LLM returned null — check OPENAI_API_KEY or prior [llm-extract] errors", {
          durationMs: llmMs,
        })
      } else {
        const fieldKeys = (Object.keys(llm) as (keyof DebtorEnrichmentOutput)[]).filter(
          (k) => llm[k] != null,
        )
        populatedFieldCount = fieldKeys.length
        debtorEnrichmentLog.info("LLM: structured output received", {
          durationMs: llmMs,
          fieldKeys,
        })
      }

      const evidenceFallback = buildEvidenceFallbackOutput(branches)
      const llmParsed = llm ? debtorEnrichmentOutputSchema.safeParse(llm) : null
      if (llm && !llmParsed?.success) {
        debtorEnrichmentLog.warn(
          "LLM output failed full-schema validation — merging per-field with evidence fallback",
          {
            issues: llmParsed?.error?.issues?.slice(0, 8).map((i) => i.message),
          },
        )
      }
      const finalOutput = mergeEnrichmentWithEvidenceFallback(llm, evidenceFallback)
      const tPersist = Date.now()
      const persisted = await persistEnrichmentOutput(debtor.id, finalOutput, branches)
      debtorEnrichmentLog.info("DB: enriched fields + trace steps persisted", {
        durationMs: Date.now() - tPersist,
        fieldNames: persisted.map((p) => p.fieldName),
        count: persisted.length,
      })

      const confidence = persisted.length > 0
        ? Math.min(1, persisted.length / 4)
        : 0

      await DebtorModel.update(debtor.id, {
        enrichmentStatus: "complete",
        enrichmentError: persisted.length === 0
          ? "Enrichment ran but found no relevant data for this debtor."
          : null,
        enrichmentConfidence: confidence,
      })
      debtorEnrichmentLog.info("DB: enrichmentStatus -> complete", {
        debtorId: debtor.id,
        confidence,
        fieldsFound: persisted.length,
      })

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
        noDataFound: persisted.length === 0,
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
