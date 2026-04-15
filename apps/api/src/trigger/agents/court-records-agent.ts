import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { APIFY_ACTORS, runActor } from "../lib/apify.js"
import { basePayloadLabel, buildProvenance, newTraceStep } from "../lib/agent-helpers.js"
import { safeGenerateObject } from "../lib/llm-extract.js"
import type { AgentResult, DebtorAgentPayload, EnrichedFieldKey } from "../types.js"

const schema = z.object({
  reasoning: z.string(),
  litigationHistory: z.array(z.string()),
  judgments: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
})

export const courtRecordsAgent = task({
  id: "court-records-agent",
  maxDuration: 300,
  run: async (payload: DebtorAgentPayload): Promise<AgentResult> => {
    const start = Date.now()
    const stepNumber = payload.stepIndex ?? 1

    const court = await runActor<Record<string, unknown>>(APIFY_ACTORS.courtRecords, {
      searchQuery: payload.name,
      mode: "dockets",
      maxResults: 25,
    })

    const recap = await runActor<Record<string, unknown>>(APIFY_ACTORS.recapDockets, {
      partyName: payload.name,
      maxResults: 25,
    })

    const items = [...court.items, ...recap.items]
    const actorRun = court.items.length ? court : recap

    const llm = await safeGenerateObject({
      system:
        "You summarize federal court docket-style results. Do not invent case numbers; quote only what appears in JSON.",
      prompt: `Debtor: ${basePayloadLabel(payload)}.\n\nCourt + RECAP items:\n${JSON.stringify(items).slice(0, 14000)}`,
      schema,
    })

    const reasoning =
      llm?.reasoning ??
      (items.length === 0
        ? "No court docket items returned from Apify actors."
        : "Court items present; LLM unavailable.")

    const trace = newTraceStep({
      stepNumber,
      agentName: "Court Records Agent",
      action: "cross-referenced",
      reasoning,
      sources: llm?.sources ?? [
        { name: "Court records run", url: court.runUrl, type: "court" },
        { name: "RECAP dockets run", url: recap.runUrl, type: "court" },
      ],
      finding: llm?.litigationHistory?.[0] ?? null,
      confidence: llm?.confidence ?? (items.length ? "low" : "none"),
      durationMs: Date.now() - start,
    })

    const extractedFields: AgentResult["extractedFields"] = {
      litigationHistory: llm?.litigationHistory ?? [],
      judgments: llm?.judgments ?? [],
    }

    const provenance: AgentResult["provenance"] = []
    for (const key of ["litigationHistory", "judgments"] as EnrichedFieldKey[]) {
      provenance.push(
        buildProvenance({
          fieldKey: key,
          value: extractedFields[key],
          agentName: trace.agentName,
          traceStepId: trace.id,
          stepNumber,
          apifyActorId: `${APIFY_ACTORS.courtRecords}+${APIFY_ACTORS.recapDockets}`,
          apifyRunUrl: court.runUrl,
          rawDataSnapshot: items.slice(0, 6),
          aiModel: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini",
          aiPromptSummary: "Extract litigation/judgment lines from docket items",
          aiReasoning: reasoning.slice(0, 2000),
          confidence: trace.confidence,
          sources: trace.sources,
          durationMs: trace.durationMs,
        })
      )
    }

    logger.log("court-records-agent done", { caseId: payload.caseId })
    return { trace, extractedFields, provenance }
  },
})
