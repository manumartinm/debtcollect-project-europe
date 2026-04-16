import { metadata } from "@trigger.dev/sdk/v3"
import { normalizeEnrichedFieldValueText } from "../../../lib/normalize-enriched-value.js"
import {
  EnrichedFieldModel,
  type TraceStepInput,
} from "../../../models/debtor.model.js"
import type { DebtorEnrichmentOutput, EnrichmentFieldOutput } from "../../types.js"
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
  "bankruptcy_status",
  "litigation_history",
  "property_ownership",
  "business_affiliations",
  "relatives_associates",
  "date_of_birth",
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
    push("Skip trace", branches.skipTrace.runUrl)
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

  private normalizeClaims(
    field: EnrichmentFieldOutput,
    pipelineSources: TraceSourceRow[],
  ): Array<{
    claim_content: string
    linked_citations: string[]
    confidence: "High" | "Medium" | "Low"
  }> {
    const raw = Array.isArray(field.explainability) ? field.explainability : []
    const valid = raw.filter(
      (c) =>
        c &&
        typeof c.claim_content === "string" &&
        c.claim_content.trim().length > 0 &&
        Array.isArray(c.linked_citations) &&
        c.linked_citations.some((u) => typeof u === "string" && /^https?:\/\//i.test(u.trim())),
    )
    if (valid.length > 0) {
      return valid.map((c) => {
        const linked_citations = c.linked_citations.filter(
          (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u.trim()),
        )
        const conf =
          c.confidence === "High" || c.confidence === "Medium" || c.confidence === "Low"
            ? c.confidence
            : "Low"
        return {
          claim_content: c.claim_content.trim(),
          linked_citations: linked_citations.length > 0 ? linked_citations : [APIFY_CONSOLE],
          confidence: conf,
        }
      })
    }
    const fallbackUrl = pipelineSources[0]?.url ?? APIFY_CONSOLE
    return [
      {
        claim_content:
          "Evidence-backed field (explainability was missing or invalid — recovered for trace persistence).",
        linked_citations: [fallbackUrl],
        confidence: "Low",
      },
    ]
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
      const value = normalizeEnrichedFieldValueText(field.value)
      if (!value) continue
      const claims = this.normalizeClaims(field, pipelineSources)
      const traceSteps: TraceStepInput[] = claims.map((claim, index) => ({
        stepNumber: index + 1,
        agentName: "Debtor Enrichment LLM",
        action: "claim",
        reasoning: claim.claim_content,
        finding: claim.claim_content,
        confidence: claim.confidence.toLowerCase() as TraceStepInput["confidence"],
        claimContent: claim.claim_content,
        linkedCitations: claim.linked_citations,
        claimConfidence: claim.confidence.toLowerCase(),
        durationMs: 0,
        sources: this.mergeStepSources(
          claim.linked_citations.map((url) => ({ name: "citation", url, type: "citation" })),
          pipelineSources,
        ),
      }))
      await EnrichedFieldModel.upsert(debtorId, fieldName, value, traceSteps)
      persisted.push({ fieldName, value })
      // Realtime: frontend `useRealtimeRun` receives metadata updates → refetch enriched fields without polling.
      metadata.set(
        "enrichedFieldsReady",
        persisted.map((p) => p.fieldName),
      )
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
