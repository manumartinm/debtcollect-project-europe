import {
  EnrichedFieldModel,
  type TraceStepInput,
} from "../../../models/debtor.model.js"
import type { DebtorEnrichmentOutput } from "../../types.js"
import type { PipelineBranches, TraceSourceRow } from "./pipeline-types.js"

const fieldKeys = [
  "phone",
  "address",
  "employer",
  "assets",
  "social_media_hints",
  "income_bracket",
  "email",
  "tax_id",
] as const satisfies ReadonlyArray<keyof DebtorEnrichmentOutput>

const APIFY_CONSOLE = "https://console.apify.com/actors"

/** Upserts enriched field values and nested trace steps + sources. */
export class DebtorEnrichmentPersistence {
  private dedupeSourcesByUrl(sources: TraceSourceRow[]): TraceSourceRow[] {
    const seen = new Set<string>()
    const out: TraceSourceRow[] = []
    for (const s of sources) {
      const url = s.url.trim()
      if (!url) continue
      const key = url.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ...s, url })
    }
    return out
  }

  private normalizeOneSource(raw: {
    name?: string
    url?: string
    type?: string
  }): TraceSourceRow | null {
    const url = (raw.url ?? "").trim()
    const name = (raw.name ?? "").trim() || "source"
    const type = (raw.type ?? "").trim() || "evidence"
    if (!url || !/^https?:\/\//i.test(url)) return null
    return { name, url, type }
  }

  collectPipelineRunSources(branches: PipelineBranches): TraceSourceRow[] {
    const rows: TraceSourceRow[] = []
    const push = (name: string, runUrl: string) => {
      const url = runUrl.trim()
      if (url) rows.push({ name, url, type: "apify_run" })
    }

    push("Google Search", branches.social.google.runUrl)
    push("Instagram", branches.social.instagram.runUrl)
    push("LinkedIn", branches.social.linkedin.runUrl)
    push("Twitter / X", branches.social.twitter.runUrl)
    push("Bankruptcy filings", branches.bankruptcy.runUrl)
    push(
      branches.skipTrace.usedFallback ? "Skip trace (TruePeople fallback)" : "Skip trace",
      branches.skipTrace.runUrl,
    )
    push("Court records", branches.courtRecords.runUrl)
    push("RECAP federal dockets", branches.recapDockets.runUrl)
    push("Business entity", branches.businessEntity.runUrl)
    if (branches.uccNy) push("UCC NY", branches.uccNy.runUrl)
    push("Property tax", branches.propertyTax.runUrl)

    const deduped = this.dedupeSourcesByUrl(rows)
    if (deduped.length === 0) {
      return [{ name: "Apify console", url: APIFY_CONSOLE, type: "apify" }]
    }
    return deduped
  }

  private mergeStepSources(
    llmSources: Array<{ name: string; url: string; type: string }> | undefined,
    pipelineFallbacks: TraceSourceRow[],
  ): TraceSourceRow[] {
    const fromLlm = (llmSources ?? [])
      .map((s) => this.normalizeOneSource(s))
      .filter((s): s is TraceSourceRow => s !== null)
    const merged = this.dedupeSourcesByUrl([...fromLlm, ...pipelineFallbacks])
    if (merged.length > 0) return merged.slice(0, 20)
    return [{ name: "Apify console", url: APIFY_CONSOLE, type: "apify" }]
  }

  async persistOutput(
    debtorId: string,
    output: DebtorEnrichmentOutput,
    branches: PipelineBranches,
  ): Promise<Array<{ fieldName: string; value: string }>> {
    const pipelineSources = this.collectPipelineRunSources(branches)
    const persisted: Array<{ fieldName: string; value: string }> = []
    for (const fieldName of fieldKeys) {
      const field = output[fieldName]
      if (!field) continue
      const value = field.value.trim()
      if (!value) continue
      const traceSteps: TraceStepInput[] = field.traceSteps.map((step) => ({
        stepNumber: step.stepNumber,
        agentName: step.agentName,
        action: step.action,
        reasoning: step.reasoning,
        finding: step.finding,
        confidence: step.confidence,
        durationMs: step.durationMs,
        sources: this.mergeStepSources(step.sources, pipelineSources),
      }))
      await EnrichedFieldModel.upsert(debtorId, fieldName, value, traceSteps)
      persisted.push({ fieldName, value })
    }
    return persisted
  }
}

export const debtorEnrichmentPersistence = new DebtorEnrichmentPersistence()

export async function persistEnrichmentOutput(
  debtorId: string,
  output: DebtorEnrichmentOutput,
  branches: PipelineBranches,
): Promise<Array<{ fieldName: string; value: string }>> {
  return debtorEnrichmentPersistence.persistOutput(debtorId, output, branches)
}
