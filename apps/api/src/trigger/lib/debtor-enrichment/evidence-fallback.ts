import {
  normalizeEnrichedFieldValueText,
  valueUnknownToPlainText,
} from "../../../lib/normalize-enriched-value.js"
import {
  enrichmentFieldOutputSchema,
  type DebtorEnrichmentOutput,
  type EnrichmentFieldOutput,
  type ExplainabilityClaim,
} from "../../types.js"
import type { PipelineBranches } from "./pipeline-types.js"

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

function emptyOutput(): DebtorEnrichmentOutput {
  return {
    phone: null,
    address: null,
    employer: null,
    assets: null,
    social_media_hints: null,
    income_bracket: null,
    email: null,
    tax_id: null,
    bankruptcy_status: null,
    litigation_history: null,
    property_ownership: null,
    business_affiliations: null,
    relatives_associates: null,
    date_of_birth: null,
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function firstNonEmptyString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim()
    if (typeof c === "number" && Number.isFinite(c)) return String(c)
  }
  return null
}

/** One structured field backed only by pipeline evidence (Apify run URL as citation). */
function evidenceField(
  value: string,
  citationUrl: string,
  claim: string,
): EnrichmentFieldOutput {
  const normalized = normalizeEnrichedFieldValueText(value).trim()
  const v = (normalized || value.trim()).slice(0, 4000)
  const url = citationUrl.trim()
  const cite = /^https?:\/\//i.test(url) ? url : "https://console.apify.com/actors"
  return {
    value: v,
    explainability: [
      {
        claim_content: claim.slice(0, 2000),
        linked_citations: [cite],
        confidence: "Medium",
      },
    ],
  }
}

/** Plain text from pipeline rows (format first, then truncate — never partial JSON). */
function plainTextEvidenceSnippet(data: unknown, maxLen: number): string {
  const s = valueUnknownToPlainText(data)
  if (!s) return ""
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1))}…`
}

function plainTextEvidenceItems(items: unknown[], take: number, maxLen: number): string {
  const slice = items.slice(0, take)
  const parts = slice.map((item) => valueUnknownToPlainText(item)).filter(Boolean)
  let text = parts.join("\n\n")
  if (!text) return ""
  return text.length <= maxLen ? text : `${text.slice(0, Math.max(0, maxLen - 1))}…`
}

/**
 * Deterministic enrichment from Apify dataset rows so runs still persist extra fields
 * when the LLM fails, returns null, or hallucinates without valid citations.
 */
export function buildEvidenceFallbackOutput(branches: PipelineBranches): DebtorEnrichmentOutput {
  const out = emptyOutput()

  const st = branches.skipTrace
  if (st.items.length > 0 && st.runUrl) {
    for (const raw of st.items) {
      const item = asRecord(raw)
      const phone = firstNonEmptyString(
        item.phone,
        Array.isArray(item.phones) ? (item.phones[0] as unknown) : undefined,
        typeof item.phones === "object" && item.phones
          ? firstNonEmptyString(...Object.values(asRecord(item.phones)))
          : undefined,
      )
      if (phone && !out.phone) {
        out.phone = evidenceField(
          phone,
          st.runUrl,
          "Phone number surfaced in skip-trace / people-data actor output.",
        )
      }
      const email = firstNonEmptyString(
        item.email,
        Array.isArray(item.emails) ? (item.emails[0] as unknown) : undefined,
      )
      if (email && !out.email) {
        out.email = evidenceField(
          email,
          st.runUrl,
          "Email surfaced in skip-trace actor output.",
        )
      }
      const addr = firstNonEmptyString(item.address, item.city, item.state, item.zip)
      if (addr && !out.address) {
        const parts = [item.address, item.city, item.state, item.zip]
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean)
        out.address = evidenceField(
          parts.join(", ") || addr,
          st.runUrl,
          "Address fields from skip-trace actor output.",
        )
      }
      const dob = firstNonEmptyString(item.dob, item.dateOfBirth)
      if (dob && !out.date_of_birth) {
        out.date_of_birth = evidenceField(
          dob,
          st.runUrl,
          "Date of birth field from skip-trace actor output.",
        )
      }
      const rel = item.relatives
      if (rel != null && !out.relatives_associates) {
        const s = plainTextEvidenceSnippet(rel, 1200)
        if (s) {
          out.relatives_associates = evidenceField(
            s,
            st.runUrl,
            "Relatives / associates data from skip-trace actor output.",
          )
        }
      }
    }
  }

  const socialBits: string[] = []
  const pushSocial = (label: string, items: Record<string, unknown>[], runUrl: string) => {
    if (!items.length || !runUrl) return
    const snippet = plainTextEvidenceItems(items, 3, 800)
    if (snippet) socialBits.push(`${label}: ${snippet}`)
  }
  pushSocial("Instagram", branches.social.instagram.items, branches.social.instagram.runUrl)
  pushSocial("LinkedIn", branches.social.linkedin.items, branches.social.linkedin.runUrl)
  pushSocial("Twitter/X", branches.social.twitter.items, branches.social.twitter.runUrl)
  pushSocial("Google", branches.social.google.items, branches.social.google.runUrl)
  const socialCite =
    branches.social.linkedin.runUrl ||
    branches.social.twitter.runUrl ||
    branches.social.instagram.runUrl ||
    branches.social.google.runUrl
  if (socialBits.length && socialCite) {
    out.social_media_hints = evidenceField(
      socialBits.join("\n\n"),
      socialCite,
      "Consolidated social / web search actor summaries from pipeline output.",
    )
  }

  if (branches.bankruptcy.items.length && branches.bankruptcy.runUrl) {
    const s = plainTextEvidenceItems(branches.bankruptcy.items, 4, 1500)
    if (s) {
      out.bankruptcy_status = evidenceField(
        s,
        branches.bankruptcy.runUrl,
        "Bankruptcy search actor results (titles, snippets, links).",
      )
    }
  }

  const courtParts: string[] = []
  if (branches.courtRecords.items.length && branches.courtRecords.runUrl) {
    courtParts.push(`State / local: ${plainTextEvidenceItems(branches.courtRecords.items, 4, 800)}`)
  }
  if (branches.recapDockets.items.length && branches.recapDockets.runUrl) {
    courtParts.push(`Federal RECAP: ${plainTextEvidenceItems(branches.recapDockets.items, 4, 800)}`)
  }
  const litigationCite = branches.recapDockets.runUrl || branches.courtRecords.runUrl
  if (courtParts.length && litigationCite) {
    out.litigation_history = evidenceField(
      courtParts.join("\n\n"),
      litigationCite,
      "Court records and federal docket excerpts from pipeline actors.",
    )
  }

  if (branches.businessEntity.items.length && branches.businessEntity.runUrl) {
    const s = plainTextEvidenceItems(branches.businessEntity.items, 4, 1500)
    if (s) {
      out.business_affiliations = evidenceField(
        s,
        branches.businessEntity.runUrl,
        "Business entity registry actor output.",
      )
    }
    const first = asRecord(branches.businessEntity.items[0])
    const entityName = firstNonEmptyString(first.entityName, first.name)
    if (entityName) {
      out.employer = evidenceField(
        entityName,
        branches.businessEntity.runUrl,
        "Entity / employer name from business registry actor (first match).",
      )
    }
  }

  if (branches.propertyTax.items.length && branches.propertyTax.runUrl) {
    const s = plainTextEvidenceItems(branches.propertyTax.items, 4, 1500)
    if (s) {
      out.property_ownership = evidenceField(
        s,
        branches.propertyTax.runUrl,
        "Property / tax assessor actor output.",
      )
    }
  }

  if (branches.uccNy?.items.length && branches.uccNy.runUrl) {
    const s = plainTextEvidenceItems(branches.uccNy.items, 4, 1500)
    if (s) {
      out.assets = evidenceField(
        s,
        branches.uccNy.runUrl,
        "UCC / lien filing excerpts from actor output.",
      )
    }
  }

  const hasAny = fieldKeys.some((k) => out[k] != null)
  if (!hasAny && branches.social.google.items.length && branches.social.google.runUrl) {
    const s = plainTextEvidenceItems(branches.social.google.items, 3, 2000)
    if (s) {
      out.social_media_hints = evidenceField(
        s,
        branches.social.google.runUrl,
        "Web search actor output (minimum fallback when other mappers returned nothing).",
      )
    }
  }

  return out
}

const FALLBACK_CITATION = "https://console.apify.com/actors"

/**
 * Accepts strict schema output, or loose model objects (missing explainability, bad citations).
 * {@link persist-enrichment} still normalizes claims before DB write.
 */
function coerceFieldToEnrichmentOutput(field: unknown): EnrichmentFieldOutput | null {
  if (field == null || typeof field !== "object") return null
  const parsed = enrichmentFieldOutputSchema.safeParse(field)
  if (parsed.success) {
    const v = normalizeEnrichedFieldValueText(parsed.data.value)
    if (!v) return null
    return { ...parsed.data, value: v }
  }

  const f = field as Record<string, unknown>
  const value = normalizeEnrichedFieldValueText(f.value)
  if (!value) return null

  const rawExpl = Array.isArray(f.explainability) ? f.explainability : []
  if (rawExpl.length === 0) {
    return {
      value,
      explainability: [
        {
          claim_content:
            "Structured field from model output (citations normalized during persistence).",
          linked_citations: [FALLBACK_CITATION],
          confidence: "Low",
        },
      ],
    }
  }

  const explainability: ExplainabilityClaim[] = rawExpl.map((claim) => {
    const c = claim && typeof claim === "object" ? (claim as Record<string, unknown>) : {}
    const content =
      typeof c.claim_content === "string" && c.claim_content.trim()
        ? c.claim_content.trim()
        : "Evidence claim"
    const cites = Array.isArray(c.linked_citations)
      ? c.linked_citations.map((u) => String(u).trim()).filter(Boolean)
      : []
    const linked_citations =
      cites.length > 0 ? cites : [FALLBACK_CITATION]
    const conf =
      c.confidence === "High" || c.confidence === "Medium" || c.confidence === "Low"
        ? c.confidence
        : "Low"
    return { claim_content: content, linked_citations, confidence: conf }
  })

  return { value, explainability }
}

/**
 * Prefer LLM fields when they carry a non-empty value; evidence fills gaps.
 * Pass raw `generateObject` output — no global Zod parse (it dropped valid fields on any key error).
 */
export function mergeEnrichmentWithEvidenceFallback(
  llmRaw: unknown,
  evidenceFallback: DebtorEnrichmentOutput,
): DebtorEnrichmentOutput {
  const out: DebtorEnrichmentOutput = { ...evidenceFallback }
  if (!llmRaw || typeof llmRaw !== "object") return out
  const obj = llmRaw as Record<string, unknown>
  for (const k of fieldKeys) {
    const coerced = coerceFieldToEnrichmentOutput(obj[k])
    if (coerced) {
      out[k] = coerced
    }
  }
  return out
}
