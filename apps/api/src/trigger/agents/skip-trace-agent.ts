import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { APIFY_ACTORS, runActor } from "../lib/apify.js"
import { basePayloadLabel, buildProvenance, newTraceStep } from "../lib/agent-helpers.js"
import { safeGenerateObject } from "../lib/llm-extract.js"
import type { AgentResult, DebtorAgentPayload, EnrichedFieldKey } from "../types.js"

const extractSchema = z.object({
  reasoning: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  currentAddress: z.string().nullable(),
  addressHistory: z.array(z.string()),
  relatives: z.array(z.string()),
  dateOfBirth: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(
    z.object({ name: z.string(), url: z.string(), type: z.string() })
  ),
})

export const skipTraceAgent = task({
  id: "skip-trace-agent",
  maxDuration: 300,
  run: async (payload: DebtorAgentPayload): Promise<AgentResult> => {
    const start = Date.now()
    const stepNumber = payload.stepIndex ?? 1

    const primary = await runActor<Record<string, unknown>>(APIFY_ACTORS.skipTrace, {
      searchQueries: [
        {
          query: `${payload.name} ${payload.state}`,
          state: payload.state,
        },
      ],
    })

    let items = primary.items
    let actorRun = primary
    if (items.length === 0) {
      const fallback = await runActor<Record<string, unknown>>(
        APIFY_ACTORS.truePeopleSearch,
        {
          name: payload.name,
          state: payload.state,
        }
      )
      items = fallback.items
      actorRun = fallback
    }

    const rawJson = JSON.stringify(items.slice(0, 20))
    const llm = await safeGenerateObject({
      system:
        "You are a US skip-tracing analyst for compliant debt collection. Only use facts from the provided JSON. Never invent PII.",
      prompt: `Debtor: ${basePayloadLabel(payload)}.\n\nRaw Apify dataset items:\n${rawJson.slice(0, 12000)}\n\nExtract structured contact and identity signals.`,
      schema: extractSchema,
    })

    const reasoning =
      llm?.reasoning ??
      (items.length === 0
        ? "No skip-trace actor results; Apify returned empty or token missing."
        : "Parsed skip-trace actor output without LLM (missing OPENAI_API_KEY).")

    const trace = newTraceStep({
      stepNumber,
      agentName: "Skip Trace Agent",
      action: "queried",
      reasoning,
      sources: llm?.sources ?? [
        { name: "Apify run", url: actorRun.runUrl, type: "skip_trace" },
      ],
      finding:
        llm?.currentAddress ??
        (items[0] ? JSON.stringify(items[0]).slice(0, 280) : null),
      confidence: llm?.confidence ?? (items.length ? "medium" : "none"),
      durationMs: Date.now() - start,
    })

    const extractedFields: AgentResult["extractedFields"] = {
      phones: llm?.phones ?? [],
      emails: llm?.emails ?? [],
      currentAddress: llm?.currentAddress ?? null,
      addressHistory: llm?.addressHistory ?? [],
      relatives: llm?.relatives ?? [],
      dateOfBirth: llm?.dateOfBirth ?? null,
    }

    const provenance: AgentResult["provenance"] = []
    const fieldEntries: Array<{ key: EnrichedFieldKey; value: unknown }> = [
      { key: "phones", value: extractedFields.phones },
      { key: "emails", value: extractedFields.emails },
      { key: "currentAddress", value: extractedFields.currentAddress },
      { key: "addressHistory", value: extractedFields.addressHistory },
      { key: "relatives", value: extractedFields.relatives },
      { key: "dateOfBirth", value: extractedFields.dateOfBirth },
    ]

    for (const { key, value } of fieldEntries) {
      provenance.push(
        buildProvenance({
          fieldKey: key,
          value,
          agentName: trace.agentName,
          traceStepId: trace.id,
          stepNumber,
          apifyActorId: actorRun.actorId,
          apifyRunUrl: actorRun.runUrl,
          rawDataSnapshot: items.slice(0, 5),
          aiModel: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini",
          aiPromptSummary: "Extract phones, emails, addresses from skip-trace items",
          aiReasoning: reasoning.slice(0, 2000),
          confidence: trace.confidence,
          sources: trace.sources,
          durationMs: trace.durationMs,
        })
      )
    }

    logger.log("skip-trace-agent done", { caseRef: payload.caseRef, ms: Date.now() - start })

    return { trace, extractedFields, provenance }
  },
})
