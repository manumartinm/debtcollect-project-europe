import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { APIFY_ACTORS, runActor } from "../lib/apify.js"
import { basePayloadLabel, buildProvenance, newTraceStep } from "../lib/agent-helpers.js"
import { safeGenerateObject } from "../lib/llm-extract.js"
import type { AgentResult, DebtorAgentPayload, EnrichedFieldKey } from "../types.js"

const schema = z.object({
  reasoning: z.string(),
  realEstateHoldings: z.array(z.string()),
  estimatedPropertyValue: z.number().nullable(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
})

export const propertyAgent = task({
  id: "property-agent",
  maxDuration: 300,
  run: async (payload: DebtorAgentPayload): Promise<AgentResult> => {
    const start = Date.now()
    const stepNumber = payload.stepIndex ?? 1

    const countyHint =
      (payload.overrides?.county as string | undefined) ??
      (payload.city ? `${payload.city} area` : undefined)

    const actorRun = await runActor<Record<string, unknown>>(APIFY_ACTORS.propertyTax, {
      ownerName: payload.name,
      state: payload.state,
      county: countyHint,
      maxResults: 50,
    })

    const items = actorRun.items
    const llm = await safeGenerateObject({
      system:
        "You summarize property tax / assessor records. Never invent parcel IDs; quote what appears in data.",
      prompt: `Debtor: ${basePayloadLabel(payload)}.\n\nProperty tax items:\n${JSON.stringify(items).slice(0, 14000)}`,
      schema,
    })

    const reasoning =
      llm?.reasoning ??
      (items.length === 0
        ? "Property tax actor returned no rows (may need county-specific actor)."
        : "Property rows present; LLM unavailable.")

    const trace = newTraceStep({
      stepNumber,
      agentName: "Property Agent",
      action: "queried",
      reasoning,
      sources: llm?.sources ?? [
        { name: "Property tax scraper", url: actorRun.runUrl, type: "property" },
      ],
      finding: llm?.realEstateHoldings?.[0] ?? null,
      confidence: llm?.confidence ?? (items.length ? "low" : "none"),
      durationMs: Date.now() - start,
    })

    const extractedFields: AgentResult["extractedFields"] = {
      realEstateHoldings: llm?.realEstateHoldings ?? [],
      estimatedPropertyValue: llm?.estimatedPropertyValue ?? null,
    }

    const provenance: AgentResult["provenance"] = []
    for (const key of ["realEstateHoldings", "estimatedPropertyValue"] as EnrichedFieldKey[]) {
      provenance.push(
        buildProvenance({
          fieldKey: key,
          value: extractedFields[key],
          agentName: trace.agentName,
          traceStepId: trace.id,
          stepNumber,
          apifyActorId: actorRun.actorId,
          apifyRunUrl: actorRun.runUrl,
          rawDataSnapshot: items.slice(0, 6),
          aiModel: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini",
          aiPromptSummary: "Extract property holdings from assessor output",
          aiReasoning: reasoning.slice(0, 2000),
          confidence: trace.confidence,
          sources: trace.sources,
          durationMs: trace.durationMs,
        })
      )
    }

    logger.log("property-agent done", { caseId: payload.caseId })
    return { trace, extractedFields, provenance }
  },
})
