import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { APIFY_ACTORS, runActor } from "../lib/apify.js"
import { basePayloadLabel, buildProvenance, newTraceStep } from "../lib/agent-helpers.js"
import { safeGenerateObject } from "../lib/llm-extract.js"
import type { AgentResult, DebtorAgentPayload, EnrichedFieldKey } from "../types.js"

const schema = z.object({
  reasoning: z.string(),
  bankruptcyStatus: z
    .string()
    .nullable()
    .describe('e.g. "none", "chapter7_active", "chapter13_discharged"'),
  bankruptcyDetail: z.string().nullable(),
  complianceFlag: z
    .string()
    .nullable()
    .describe("If automatic stay may apply, describe briefly"),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
})

export const bankruptcyAgent = task({
  id: "bankruptcy-agent",
  maxDuration: 300,
  run: async (payload: DebtorAgentPayload): Promise<AgentResult> => {
    const start = Date.now()
    const stepNumber = payload.stepIndex ?? 1

    const actorRun = await runActor<Record<string, unknown>>(APIFY_ACTORS.bankruptcy, {
      searchQuery: payload.name,
      maxResults: 50,
    })

    const items = actorRun.items
    const rawJson = JSON.stringify(items.slice(0, 30))

    const llm = await safeGenerateObject({
      system:
        "You analyze US bankruptcy filings for compliance. Never claim legal conclusions; summarize what the data suggests.",
      prompt: `Debtor: ${basePayloadLabel(payload)}.\n\nRaw bankruptcy search items:\n${rawJson.slice(0, 12000)}`,
      schema,
    })

    const reasoning =
      llm?.reasoning ??
      (items.length === 0
        ? "No bankruptcy filings returned from Apify actor."
        : "LLM unavailable; raw bankruptcy items present.")

    const trace = newTraceStep({
      stepNumber,
      agentName: "Bankruptcy Agent",
      action: "queried",
      reasoning,
      sources: llm?.sources ?? [
        { name: "Apify bankruptcy run", url: actorRun.runUrl, type: "bankruptcy" },
      ],
      finding: llm?.bankruptcyDetail ?? (items[0] ? String(items[0]).slice(0, 400) : null),
      confidence: llm?.confidence ?? (items.length ? "medium" : "none"),
      durationMs: Date.now() - start,
    })

    const extractedFields: AgentResult["extractedFields"] = {
      bankruptcyStatus: llm?.bankruptcyStatus ?? null,
      bankruptcyDetail: llm?.bankruptcyDetail ?? null,
    }

    const provenance: AgentResult["provenance"] = []
    const keys: EnrichedFieldKey[] = ["bankruptcyStatus", "bankruptcyDetail"]
    for (const key of keys) {
      provenance.push(
        buildProvenance({
          fieldKey: key,
          value: extractedFields[key],
          agentName: trace.agentName,
          traceStepId: trace.id,
          stepNumber,
          apifyActorId: actorRun.actorId,
          apifyRunUrl: actorRun.runUrl,
          rawDataSnapshot: items.slice(0, 5),
          aiModel: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini",
          aiPromptSummary: "Summarize bankruptcy filings from Apify items",
          aiReasoning: reasoning.slice(0, 2000),
          confidence: trace.confidence,
          sources: trace.sources,
          durationMs: trace.durationMs,
        })
      )
    }

    logger.log("bankruptcy-agent done", { caseId: payload.caseId })
    return { trace, extractedFields, provenance }
  },
})
