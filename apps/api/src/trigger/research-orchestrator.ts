import { batch, logger, task } from "@trigger.dev/sdk"

import { bankruptcyAgent } from "./agents/bankruptcy-agent.js"
import { businessEntityAgent } from "./agents/business-entity-agent.js"
import { courtRecordsAgent } from "./agents/court-records-agent.js"
import { propertyAgent } from "./agents/property-agent.js"
import { serpDeepAgent } from "./agents/serp-deep-agent.js"
import { skipTraceAgent } from "./agents/skip-trace-agent.js"
import { socialOsintAgent } from "./agents/social-osint-agent.js"
import { safeGenerateObject } from "./lib/llm-extract.js"
import { executionPlanSchema, replanSchema, type PlanAgentId } from "./lib/planning.js"
import { synthesisAgent } from "./synthesis-agent.js"
import type { AgentResult, DebtorAgentPayload, ResearchOrchestratorPayload } from "./types.js"

const agentById = {
  "skip-trace": skipTraceAgent,
  "court-records": courtRecordsAgent,
  bankruptcy: bankruptcyAgent,
  "business-entity": businessEntityAgent,
  property: propertyAgent,
  "social-osint": socialOsintAgent,
  "serp-deep": serpDeepAgent,
} as const

function toPayload(
  p: ResearchOrchestratorPayload,
  stepIndex: number,
  overrides?: Record<string, unknown>
): DebtorAgentPayload {
  return {
    caseRef: p.caseRef,
    name: p.debtor.name,
    state: p.debtor.state,
    city: p.debtor.city,
    stepIndex,
    overrides,
  }
}

function collectOutputs(
  runs: Array<{ ok: boolean; output?: AgentResult; error?: unknown }>
): AgentResult[] {
  const out: AgentResult[] = []
  for (const r of runs) {
    if (r.ok && r.output) {
      out.push(r.output)
    } else if (!r.ok) {
      logger.error("Child agent run failed", { error: r.error })
    }
  }
  return out
}

export const researchOrchestrator = task({
  id: "research-orchestrator",
  maxDuration: 900,
  run: async (payload: ResearchOrchestratorPayload) => {
    const wave1Default: PlanAgentId[] = ["skip-trace", "bankruptcy", "serp-deep"]

    const plan = await safeGenerateObject({
      system:
        "You plan US debt-collection research waves. Wave1 should prioritize skip-trace, bankruptcy screening, and broad SERP. Wave2 adds court, business, property, social based on value and debt size.",
      prompt: `Debtor: ${payload.debtor.name}, state ${payload.debtor.state}, city ${payload.debtor.city ?? "unknown"}, debt ${payload.debtor.debtAmount ?? "unknown"}, type ${payload.debtor.debtType ?? "unknown"}, DOL ${payload.debtor.dateOfDelinquency ?? "unknown"}.

Choose wave1 and wave2 agent ids from: skip-trace, court-records, bankruptcy, business-entity, property, social-osint, serp-deep.
Explain skipped agents in skipAgents.`,
      schema: executionPlanSchema,
    })

    const wave1 = plan?.wave1?.length ? plan.wave1 : wave1Default
    let step = 1
    const wave1Jobs = wave1.map((id) => ({
      task: agentById[id],
      payload: toPayload(payload, step++),
    }))

    logger.log("researchOrchestrator wave1", { caseRef: payload.caseRef, wave1 })
    const w1 = await batch.triggerByTaskAndWait(wave1Jobs)
    const wave1Results = collectOutputs(w1.runs)

    const wave1Summary = wave1Results.map((r) => ({
      agent: r.trace.agentName,
      finding: r.trace.finding,
      confidence: r.trace.confidence,
    }))

    const replan = await safeGenerateObject({
      system:
        "You adjust Wave2 after Wave1. Use bankruptcy signals to possibly abort further research. Pass property county or linkedin URL overrides when inferable from Wave1 text.",
      prompt: `Wave1 summary:\n${JSON.stringify(wave1Summary).slice(0, 8000)}\n\nOriginal wave2 intent:\n${JSON.stringify(plan?.wave2 ?? [])}`,
      schema: replanSchema,
    })

    if (replan?.abortRemaining) {
      logger.warn("Orchestrator abort after wave1", {
        reason: replan.abortReason,
        caseRef: payload.caseRef,
      })
      const syn = await synthesisAgent.triggerAndWait({
        caseRef: payload.caseRef,
        debtor: payload.debtor,
        agentResults: wave1Results,
        planReasoning: `${plan?.reasoning ?? ""}\nAbort: ${replan.abortReason ?? ""}`,
      })
      if (!syn.ok) {
        throw new Error(String(syn.error ?? "synthesis failed"))
      }
      return {
        caseRef: payload.caseRef,
        plan,
        replan,
        wave1Results,
        wave2Results: [] as AgentResult[],
        synthesis: syn.output,
      }
    }

    let wave2Ids = [...(plan?.wave2?.length ? plan.wave2 : [])]
    if (!wave2Ids.length) {
      wave2Ids = ["court-records", "business-entity", "property", "social-osint"]
    }
    if (replan?.addToWave2?.length) {
      wave2Ids = [...new Set([...wave2Ids, ...replan.addToWave2])]
    }
    if (replan?.removeFromWave2?.length) {
      const remove = new Set(replan.removeFromWave2)
      wave2Ids = wave2Ids.filter((id) => !remove.has(id))
    }

    const overrides: Record<string, unknown> = {}
    if (replan?.propertyCounty) {
      overrides.county = replan.propertyCounty
    }
    if (replan?.linkedinUrl) {
      overrides.linkedinUrl = replan.linkedinUrl
    }

    const wave2Jobs = wave2Ids.map((id) => ({
      task: agentById[id],
      payload: toPayload(payload, step++, Object.keys(overrides).length ? overrides : undefined),
    }))

    logger.log("researchOrchestrator wave2", { caseRef: payload.caseRef, wave2Ids })
    const w2 = await batch.triggerByTaskAndWait(wave2Jobs)
    const wave2Results = collectOutputs(w2.runs)
    const allResults = [...wave1Results, ...wave2Results]

    const syn = await synthesisAgent.triggerAndWait({
      caseRef: payload.caseRef,
      debtor: payload.debtor,
      agentResults: allResults,
      planReasoning: plan?.reasoning,
    })

    if (!syn.ok) {
      throw new Error(String(syn.error ?? "synthesis failed"))
    }

    logger.log("researchOrchestrator complete", { caseRef: payload.caseRef })

    return {
      caseRef: payload.caseRef,
      plan,
      replan,
      wave1Results,
      wave2Results,
      synthesis: syn.output,
    }
  },
})
