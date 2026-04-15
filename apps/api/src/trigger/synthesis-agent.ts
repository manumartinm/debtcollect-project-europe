import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { computeSolExpirationIso, statuteOfLimitationsYears } from "./lib/fdcpa.js"
import { safeGenerateObject } from "./lib/llm-extract.js"
import type { AgentResult, EnrichedFieldKey, FieldProvenance, SynthesisInput } from "./types.js"

const fieldProvSchema = z.object({
  fieldKey: z.string(),
  value: z.unknown(),
  agentName: z.string(),
  traceStepId: z.string(),
  stepNumber: z.number(),
  apifyActorId: z.string(),
  apifyRunUrl: z.string(),
  rawDataSnapshot: z.unknown(),
  aiModel: z.string(),
  aiPromptSummary: z.string(),
  aiReasoning: z.string(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
  alternativeSources: z.array(
    z.object({
      agentName: z.string(),
      value: z.unknown(),
      confidence: z.enum(["high", "medium", "low", "none"]),
      reason: z.string(),
    })
  ),
  timestamp: z.string(),
  durationMs: z.number(),
})

const synthesisOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  leverageScore: z.enum(["none", "low", "medium", "high"]),
  enrichmentConfidence: z.number().min(0).max(1),
  callStrategy: z.object({
    recommendedApproach: z.string(),
    talkingPoints: z.array(
      z.object({
        title: z.string(),
        points: z.array(z.string()),
      })
    ),
    complianceAnchors: z.array(z.string()),
    doNotMention: z.array(z.string()),
  }),
  fieldProvenance: z.record(z.string(), fieldProvSchema),
})

export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>

function mergeProvenance(agentResults: AgentResult[]): Record<string, FieldProvenance> {
  const byField = new Map<string, FieldProvenance[]>()

  for (const ar of agentResults) {
    for (const p of ar.provenance) {
      const list = byField.get(p.fieldKey) ?? []
      list.push(p)
      byField.set(p.fieldKey, list)
    }
  }

  const merged: Record<string, FieldProvenance> = {}

  for (const [key, list] of byField) {
    if (list.length === 1) {
      merged[key] = { ...list[0], alternativeSources: list[0].alternativeSources ?? [] }
      continue
    }
    const ranked = [...list].sort((a, b) => scoreConf(b.confidence) - scoreConf(a.confidence))
    const winner = ranked[0]!
    const alternatives = ranked.slice(1).map((p) => ({
      agentName: p.agentName,
      value: p.value,
      confidence: p.confidence,
      reason: `Lower priority vs ${winner.agentName} for this field.`,
    }))
    merged[key] = {
      ...winner,
      alternativeSources: [...(winner.alternativeSources ?? []), ...alternatives],
    }
  }

  return merged
}

function scoreConf(c: FieldProvenance["confidence"]): number {
  switch (c) {
    case "high":
      return 4
    case "medium":
      return 3
    case "low":
      return 2
    default:
      return 0
  }
}

export const synthesisAgent = task({
  id: "synthesis-agent",
  maxDuration: 300,
  run: async (input: SynthesisInput): Promise<SynthesisOutput> => {
    const start = Date.now()
    const merged = mergeProvenance(input.agentResults)

    const sol = computeSolExpirationIso(
      input.debtor.dateOfDelinquency,
      input.debtor.state
    )
    const solYears = statuteOfLimitationsYears(input.debtor.state)

    const serializedAgents = input.agentResults.map((r) => ({
      agent: r.trace.agentName,
      finding: r.trace.finding,
      confidence: r.trace.confidence,
      fields: r.extractedFields,
    }))

    const prompt = `Case ${input.caseRef}. Debtor portfolio: ${JSON.stringify(input.debtor)}.

Statute of limitations (written contract, informational): state ${input.debtor.state} -> ${solYears ?? "unknown"} years; estimated time-barred: ${sol.timeBarred}; expiration ISO: ${sol.expirationIso ?? "n/a"}.

Plan reasoning (if any): ${input.planReasoning ?? "n/a"}

Agent outputs:
${JSON.stringify(serializedAgents).slice(0, 28000)}

Merged provenance keys: ${Object.keys(merged).join(", ")}

Produce final synthesis: summary, key findings, leverage score, enrichment confidence 0-1, call strategy, and fieldProvenance object keyed by fieldKey — copy winning provenance entries from merged data where possible (you may refine aiReasoning strings to be field-specific).`

    const llm = await safeGenerateObject({
      system:
        "You are a senior US debt-collection research synthesizer. Output is for licensed collectors; include compliance anchors and never assert legal conclusions.",
      prompt,
      schema: synthesisOutputSchema,
    })

    if (llm) {
      for (const k of Object.keys(merged)) {
        if (!llm.fieldProvenance[k] && merged[k]) {
          llm.fieldProvenance[k] = merged[k] as z.infer<typeof fieldProvSchema>
        }
      }
      logger.log("synthesis-agent done", { caseRef: input.caseRef, ms: Date.now() - start })
      return llm
    }

    return {
      summary: "Synthesis unavailable (missing OPENAI_API_KEY or model error).",
      keyFindings: ["Review raw agent traces in Trigger run logs."],
      leverageScore: "low",
      enrichmentConfidence: 0.35,
      callStrategy: {
        recommendedApproach: "Verify all facts manually before contact.",
        talkingPoints: [
          {
            title: "Account snapshot",
            points: [`Case ${input.caseRef}`, `Debtor ${input.debtor.name}`],
          },
        ],
        complianceAnchors: [
          "Follow FDCPA / Regulation F and state law.",
          sol.timeBarred ? "Debt may be time-barred — do not threaten suit." : "Confirm SOL with counsel.",
        ],
        doNotMention: ["Unverified asset or employment claims"],
      },
      fieldProvenance: merged as Record<string, z.infer<typeof fieldProvSchema>>,
    }
  },
})
