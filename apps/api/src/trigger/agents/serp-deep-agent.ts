import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { APIFY_ACTORS, runActor } from "../lib/apify.js"
import { basePayloadLabel, buildProvenance, newTraceStep } from "../lib/agent-helpers.js"
import { safeGenerateObject } from "../lib/llm-extract.js"
import type { AgentResult, DebtorAgentPayload, EnrichedFieldKey } from "../types.js"

const schema = z.object({
  reasoning: z.string(),
  keySignals: z.array(z.string()),
  complianceFlags: z.array(z.string()),
  deceasedOrMilitaryHint: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
})

export const serpDeepAgent = task({
  id: "serp-deep-agent",
  maxDuration: 300,
  run: async (payload: DebtorAgentPayload): Promise<AgentResult> => {
    const start = Date.now()
    const stepNumber = payload.stepIndex ?? 1
    const q = payload.name
    const st = payload.state

    const queries = [
      `"${q}" ${st}`,
      `"${q}" lawsuit OR judgment OR court ${st}`,
      `"${q}" business OR LLC OR corporation ${st}`,
      `"${q}" obituary OR deceased`,
    ]

    const actorRun = await runActor<Record<string, unknown>>(APIFY_ACTORS.googleSearch, {
      queries,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
    })

    const items = actorRun.items
    const rawJson = JSON.stringify(items.slice(0, 40))

    const llm = await safeGenerateObject({
      system:
        "You synthesize open-web search results for compliant US debt-collection research. Flag sensitivity (deceased, military) without asserting facts not in data.",
      prompt: `Debtor: ${basePayloadLabel(payload)}.\n\nSERP items:\n${rawJson.slice(0, 14000)}`,
      schema,
    })

    const reasoning =
      llm?.reasoning ??
      (items.length === 0
        ? "Google Search actor returned no organic results."
        : "SERP data present; LLM summary unavailable.")

    const socialHint =
      llm?.keySignals?.join(" · ").slice(0, 500) ?? null

    const trace = newTraceStep({
      stepNumber,
      agentName: "SERP Deep Agent",
      action: "queried",
      reasoning,
      sources: llm?.sources ?? [
        { name: "Google Search (Apify)", url: actorRun.runUrl, type: "search" },
      ],
      finding: socialHint,
      confidence: llm?.confidence ?? (items.length ? "medium" : "none"),
      durationMs: Date.now() - start,
    })

    const fdcpa = [...(llm?.complianceFlags ?? [])]
    if (llm?.deceasedOrMilitaryHint) {
      fdcpa.push(`Signal: ${llm.deceasedOrMilitaryHint}`)
    }

    const extractedFields: AgentResult["extractedFields"] = {
      socialMediaHints: socialHint,
      fdcpaFlags: fdcpa,
    }

    const provenance: AgentResult["provenance"] = []
    for (const key of ["socialMediaHints", "fdcpaFlags"] as EnrichedFieldKey[]) {
      provenance.push(
        buildProvenance({
          fieldKey: key,
          value: extractedFields[key],
          agentName: trace.agentName,
          traceStepId: trace.id,
          stepNumber,
          apifyActorId: actorRun.actorId,
          apifyRunUrl: actorRun.runUrl,
          rawDataSnapshot: items.slice(0, 8),
          aiModel: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini",
          aiPromptSummary: "Debt-collection SERP synthesis",
          aiReasoning: reasoning.slice(0, 2000),
          confidence: trace.confidence,
          sources: trace.sources,
          durationMs: trace.durationMs,
        })
      )
    }

    logger.log("serp-deep-agent done", { caseRef: payload.caseRef })
    return { trace, extractedFields, provenance }
  },
})
