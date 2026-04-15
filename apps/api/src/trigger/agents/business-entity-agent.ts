import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { APIFY_ACTORS, runActor } from "../lib/apify.js"
import { basePayloadLabel, buildProvenance, newTraceStep } from "../lib/agent-helpers.js"
import { safeGenerateObject } from "../lib/llm-extract.js"
import type { AgentResult, DebtorAgentPayload, EnrichedFieldKey } from "../types.js"

const schema = z.object({
  reasoning: z.string(),
  businessAffiliations: z.array(z.string()),
  uccFilings: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
})

export const businessEntityAgent = task({
  id: "business-entity-agent",
  maxDuration: 300,
  run: async (payload: DebtorAgentPayload): Promise<AgentResult> => {
    const start = Date.now()
    const stepNumber = payload.stepIndex ?? 1

    const biz = await runActor<Record<string, unknown>>(APIFY_ACTORS.businessEntity, {
      searchQuery: payload.name,
      state: payload.state,
      maxResults: 30,
    })

    let uccItems: Record<string, unknown>[] = []
    if (payload.state.toUpperCase() === "NY") {
      const ucc = await runActor<Record<string, unknown>>(APIFY_ACTORS.uccNy, {
        debtorName: payload.name,
        maxResults: 20,
      })
      uccItems = ucc.items
    }

    const items = [...biz.items, ...uccItems]
    const llm = await safeGenerateObject({
      system:
        "You extract business entity affiliations and UCC hints from Secretary of State data. Be conservative.",
      prompt: `Debtor: ${basePayloadLabel(payload)}.\n\nRaw items:\n${JSON.stringify(items).slice(0, 14000)}`,
      schema,
    })

    const reasoning =
      llm?.reasoning ??
      (items.length === 0
        ? "No business entity records returned."
        : "Business records present; LLM unavailable.")

    const trace = newTraceStep({
      stepNumber,
      agentName: "Business Entity Agent",
      action: "queried",
      reasoning,
      sources: llm?.sources ?? [
        { name: "US business search", url: biz.runUrl, type: "registry" },
      ],
      finding: llm?.businessAffiliations?.[0] ?? null,
      confidence: llm?.confidence ?? (items.length ? "low" : "none"),
      durationMs: Date.now() - start,
    })

    const extractedFields: AgentResult["extractedFields"] = {
      businessAffiliations: llm?.businessAffiliations ?? [],
      uccFilings: llm?.uccFilings ?? [],
    }

    const provenance: AgentResult["provenance"] = []
    for (const key of ["businessAffiliations", "uccFilings"] as EnrichedFieldKey[]) {
      provenance.push(
        buildProvenance({
          fieldKey: key,
          value: extractedFields[key],
          agentName: trace.agentName,
          traceStepId: trace.id,
          stepNumber,
          apifyActorId: biz.actorId,
          apifyRunUrl: biz.runUrl,
          rawDataSnapshot: items.slice(0, 6),
          aiModel: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini",
          aiPromptSummary: "Extract officer/entity affiliations",
          aiReasoning: reasoning.slice(0, 2000),
          confidence: trace.confidence,
          sources: trace.sources,
          durationMs: trace.durationMs,
        })
      )
    }

    logger.log("business-entity-agent done", { caseRef: payload.caseRef })
    return { trace, extractedFields, provenance }
  },
})
