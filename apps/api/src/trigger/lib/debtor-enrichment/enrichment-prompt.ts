import type { SolComputation } from "../fdcpa.js"
import { debtorEnrichmentLog } from "../task-logger.js"
import type { PipelineBranches } from "./pipeline-types.js"
import { promptEvidenceCompactFormatter } from "./compact-for-prompt.js"
import type { SubjectFacts } from "./subject-facts.js"

type CompactEvidence = ReturnType<DebtorEnrichmentPromptComposer["buildEvidence"]>

/** Per-branch item counts after compact (for logs). */
function compactEvidenceStats(evidence: CompactEvidence): {
  evidenceJsonChars: number
  itemCounts: Record<string, number | Record<string, number>>
} {
  const n = (x: { itemCount?: number }) => x.itemCount ?? 0
  return {
    evidenceJsonChars: JSON.stringify(evidence).length,
    itemCounts: {
      social: {
        google: n(evidence.social.google),
        instagram: n(evidence.social.instagram),
        linkedin: n(evidence.social.linkedin),
        twitter: n(evidence.social.twitter),
      },
      bankruptcy: n(evidence.bankruptcy),
      skipTrace: evidence.skipTrace.items?.length ?? 0,
      courtRecords: n(evidence.courtRecords),
      recapDockets: n(evidence.recapDockets),
      businessEntity: n(evidence.businessEntity),
      uccNy: evidence.uccNy ? n(evidence.uccNy) : 0,
      propertyTax: n(evidence.propertyTax),
    },
  }
}

/** Builds the consolidation prompt for the final structured-output LLM call. */
export class DebtorEnrichmentPromptComposer {
  buildEvidence(branches: PipelineBranches) {
    const c = promptEvidenceCompactFormatter
    return {
      social: {
        google: c.wrappedActor(branches.social.google),
        instagram: c.wrappedActor(branches.social.instagram),
        linkedin: c.wrappedActor(branches.social.linkedin),
        twitter: c.wrappedActor(branches.social.twitter),
      },
      bankruptcy: c.wrappedActor(branches.bankruptcy),
      skipTrace: c.skipTrace(branches.skipTrace),
      courtRecords: c.wrappedActor(branches.courtRecords),
      recapDockets: c.wrappedActor(branches.recapDockets),
      businessEntity: c.wrappedActor(branches.businessEntity),
      uccNy: branches.uccNy ? c.wrappedActor(branches.uccNy) : null,
      propertyTax: c.wrappedActor(branches.propertyTax),
    }
  }

  compose(args: {
    facts: SubjectFacts
    branches: PipelineBranches
    fdcpa: SolComputation
  }): string {
    const { facts, branches, fdcpa } = args

    const evidence = this.buildEvidence(branches)

    debtorEnrichmentLog.info("LLM prompt: evidence compact summary", compactEvidenceStats(evidence))
    const evidenceJson = JSON.stringify(evidence, null, 2)
    debtorEnrichmentLog.debug("LLM prompt: evidence compact JSON preview", {
      chars: evidenceJson.length,
      preview: evidenceJson.slice(0, 4000),
      truncated: evidenceJson.length > 4000,
    })

    const fdcpaBlock = {
      state: facts.state,
      statuteOfLimitationsYears: fdcpa.years,
      solExpirationIso: fdcpa.expirationIso,
      timeBarred: fdcpa.timeBarred,
      note:
        "SOL requires date of delinquency; debtor record may not include it — treat expiration as unknown if null.",
    }

    return `You are consolidating US debt-collection enrichment evidence from parallel Apify actor runs.

Known baseline identity facts (do not repeat verbatim as new discoveries unless corroborating):
${JSON.stringify(facts, null, 2)}

FDCPA / statute-of-limitations context (for trace reasoning and compliance tone — not a separate output field):
${JSON.stringify(fdcpaBlock, null, 2)}

Actor evidence bundle:
${JSON.stringify(evidence, null, 2)}

Rules:
- Output ONLY optional enriched fields that are directly supported by the evidence. Omit any field you cannot justify.
- Allowed output keys (each fully optional): phone, address, employer, assets, social_media_hints, income_bracket, email, tax_id.
- Map skip-trace and contact-style data to phone, address, email as appropriate.
- Map employer / company / officer roles to employer.
- Map property, court, bankruptcy, and judgment-style signals to assets and/or income_bracket.
- Map social and profile URLs / handles to social_media_hints.
- Include FDCPA/SOL reasoning inside trace steps where relevant (e.g. time-barred discussion) — do NOT invent a new field name.
- Each populated field must include a non-empty string value and at least one trace step.
- traceSteps must include: stepNumber, agentName, action, reasoning, finding, confidence, durationMs, sources (each source: name, url, type; URLs must be http(s)).
- The server merges your sources with all Apify actor run dashboard URLs for this job so trace rows always persist in the database; still cite the most relevant URLs in your answer.
- Be factual and conservative.
`
  }
}

export const debtorEnrichmentPromptComposer = new DebtorEnrichmentPromptComposer()

export function buildEnrichmentLlmPrompt(args: {
  facts: SubjectFacts
  branches: PipelineBranches
  fdcpa: SolComputation
}): string {
  return debtorEnrichmentPromptComposer.compose(args)
}
