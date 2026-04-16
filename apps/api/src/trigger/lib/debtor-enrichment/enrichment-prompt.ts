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

    const totalItems =
      (evidence.social.google.itemCount ?? 0) +
      (evidence.social.instagram.itemCount ?? 0) +
      (evidence.social.linkedin.itemCount ?? 0) +
      (evidence.social.twitter.itemCount ?? 0) +
      (evidence.bankruptcy.itemCount ?? 0) +
      (evidence.skipTrace.items?.length ?? 0) +
      (evidence.courtRecords.itemCount ?? 0) +
      (evidence.recapDockets.itemCount ?? 0) +
      (evidence.businessEntity.itemCount ?? 0) +
      (evidence.uccNy?.itemCount ?? 0) +
      (evidence.propertyTax.itemCount ?? 0)

    return `You are consolidating US debt-collection enrichment evidence from parallel Apify actor runs.

Known baseline identity facts (CONTEXT ONLY — do NOT repeat these as new discoveries):
${JSON.stringify(facts, null, 2)}

FDCPA / statute-of-limitations context (for trace reasoning only — not a separate output field):
${JSON.stringify(fdcpaBlock, null, 2)}

Actor evidence bundle (${totalItems} total items across all sources):
${JSON.stringify(evidence, null, 2)}

<<<<<<< HEAD
Rules:
- Output ONLY optional enriched fields that are directly supported by the evidence. Omit any field you cannot justify.
- Allowed output keys (each fully optional): phone, address, employer, assets, social_media_hints, income_bracket, email, tax_id.
- Map skip-trace and contact-style data to phone, address, email as appropriate.
- Map employer / company / officer roles to employer.
- Map property, court, bankruptcy, and judgment-style signals to assets and/or income_bracket.
- Map social and profile URLs / handles to social_media_hints.
- Include FDCPA/SOL reasoning inside trace steps where relevant (e.g. time-barred discussion) — do NOT invent a new field name.
- Each populated field must include a non-empty string value and at least one trace step.
- Explainability (Trace Steps) requirements:
  - Use explainability as a list of claim objects.
  - Each claim must have:
    - claim_content: a concise human-readable paragraph that states the claim and why the evidence supports it
    - linked_citations: 1+ source URLs that directly support the claim
    - confidence: exactly one of High, Medium, Low
  - Follow a readable-prose inductive format: identify the evidence, explain the linkage, then state the field conclusion.
  - Every claim must be directly supported by the cited URLs.
  - If you quote evidence in the claim, quote it faithfully and keep it short.
  - Omit weak or unsupported claims instead of stretching the evidence.
  - Prefer a small number of strong claims over verbose narration.
  - When a field is based on multiple actor bundles, make the claim content explicitly connect the evidence to the field.
  - Do not write chain-of-thought, hidden reasoning, or unsupported inference.
- The server merges your sources with all Apify actor run dashboard URLs for this job so trace rows always persist in the database; still cite the most relevant URLs in your answer.
- Be factual and conservative.
=======
RULES — FOLLOW EXACTLY:
1. Return null for ANY field where the evidence bundle does not contain concrete, specific supporting data.
2. If ALL actors returned 0 items (itemCount: 0), you MUST return null for EVERY field. No exceptions.
3. Allowed output keys (each fully optional, all nullable):
   - phone: phone numbers from skip-trace or contact data
   - address: physical addresses from skip-trace, property, or contact data
   - email: email addresses from skip-trace or contact data
   - tax_id: SSN, EIN, or tax identifiers
   - employer: current or recent employer / company / officer roles (from LinkedIn, business entity, skip-trace)
   - income_bracket: estimated income range based on property values, employment, business ownership (e.g. "75k-100k", "100k-150k")
   - assets: summary of known assets — property, vehicles, business equity, judgments owed TO debtor
   - social_media_hints: social media profiles, handles, URLs (from Instagram, LinkedIn, Twitter, Google)
   - bankruptcy_status: active or past bankruptcy filings — chapter, case number, court, status, dates (from bankruptcy + RECAP actors)
   - litigation_history: civil suits, judgments, court cases — case names, courts, outcomes, dates (from court records + RECAP actors)
   - property_ownership: real estate holdings — addresses, assessed values, tax amounts, counties (from property tax actor)
   - business_affiliations: business entities where debtor is officer, agent, or owner — entity names, roles, states (from business entity + UCC actors)
   - relatives_associates: known relatives or associates — names and relationships (from skip-trace actor)
   - date_of_birth: DOB if found (from skip-trace actor)
4. Include FDCPA/SOL reasoning inside trace steps where relevant — do NOT invent a new field name.
5. Each populated field must include a non-empty string value and at least one trace step.
6. traceSteps must include: stepNumber, agentName, action, reasoning, finding, confidence, durationMs, sources (each source: name, url, type).
7. Source URLs MUST come from the evidence bundle above — use real runUrl, item URLs, or profile URLs. NEVER invent URLs.
8. The server merges your sources with Apify run dashboard URLs; still cite the most relevant evidence URLs.
9. confidence levels: "high" = multiple corroborating sources; "medium" = single strong source; "low" = single weak/indirect signal. Do not use "high" for single-source findings.

CRITICAL: When in doubt, return null. A missing field is ALWAYS better than a fabricated one.
>>>>>>> 37cad1f5f8b932ea098a524e809e7d29f5208bcb
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
