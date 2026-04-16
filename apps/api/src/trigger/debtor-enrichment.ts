import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import {
  DebtorModel,
  EnrichedFieldModel,
  type TraceStepInput,
} from "../models/debtor.model.js"
import { safeGenerateObject } from "./lib/llm-extract.js"
import { APIFY_ACTORS, runActor } from "./lib/apify.js"
import {
  debtorEnrichmentOutputSchema,
  type DebtorEnrichmentOutput,
  type DebtorEnrichmentPayload,
  type EnrichmentTraceStep,
} from "./types.js"

type DbDebtor = NonNullable<Awaited<ReturnType<typeof DebtorModel.findById>>>
type ActorRunSummary = {
  source: string
  actorId: string
  query: string
  runId: string
  runUrl: string
  items: Record<string, unknown>[]
}

const fieldKeys = [
  "employer",
  "assets",
  "social_media_hints",
  "income_bracket",
] as const

const inputFactsSchema = z.object({
  debtorId: z.string().min(1),
  caseRef: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  email: z.string().nullable(),
  taxId: z.string().nullable(),
  locationHint: z.string().nullable(),
})

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }
  return null
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"')
}

function normalizeUrl(value: unknown): string | null {
  const text = firstString(value)
  if (!text) return null
  try {
    return new URL(text).toString()
  } catch {
    return text.startsWith("http://") || text.startsWith("https://") ? text : null
  }
}

function mapSources(sources: unknown): EnrichmentTraceStep["sources"] {
  if (!Array.isArray(sources)) return []
  return sources
    .map((source) => asRecord(source))
    .map((source) => ({
      name: firstString(source.name) ?? "source",
      url: firstString(source.url) ?? "",
      type: firstString(source.type) ?? "evidence",
    }))
    .filter((source) => source.url.length > 0)
}

function compactRecord(record: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const value = record[key]
    if (value == null) continue
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed) out[key] = trimmed
      continue
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value
      continue
    }
    if (Array.isArray(value)) {
      const list = value.slice(0, 5).map((entry) =>
        typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"
          ? entry
          : asRecord(entry)
      )
      if (list.length) out[key] = list
      continue
    }
    if (typeof value === "object") {
      out[key] = asRecord(value)
    }
  }
  return out
}

function summarizeGoogle(rawItems: Record<string, unknown>[]) {
  return rawItems.slice(0, 2).map((item) => {
    const searchQuery = asRecord(item.searchQuery)
    const organicResults = Array.isArray(item.organicResults) ? item.organicResults : []
    const suggestedResults = Array.isArray(item.suggestedResults) ? item.suggestedResults : []
    return {
      query: firstString(searchQuery.term, searchQuery.url) ?? null,
      searchUrl: normalizeUrl(item.url),
      organicResults: organicResults.slice(0, 5).map((result) =>
        compactRecord(asRecord(result), ["title", "url", "displayedUrl", "description", "date"])
      ),
      suggestedResults: suggestedResults.slice(0, 5).map((result) =>
        compactRecord(asRecord(result), ["title", "url", "displayedUrl", "description"])
      ),
    }
  })
}

function summarizeInstagram(rawItems: Record<string, unknown>[]) {
  return rawItems.slice(0, 2).map((item) => {
    const result = asRecord(item.result)
    const users = Array.isArray(result.users) ? result.users : []
    return {
      query: firstString(item.query),
      numResults: firstString(result.num_results),
      users: users.slice(0, 5).map((user) =>
        compactRecord(asRecord(user), [
          "full_name",
          "username",
          "is_verified",
          "is_private",
          "profile_pic_url",
          "social_context",
          "search_social_context",
        ])
      ),
    }
  })
}

function summarizeLinkedIn(rawItems: Record<string, unknown>[]) {
  return rawItems.slice(0, 5).map((item) =>
    compactRecord(item, [
      "name",
      "fullName",
      "title",
      "headline",
      "jobTitle",
      "companyName",
      "company",
      "location",
      "url",
      "profileUrl",
      "description",
      "followersAmount",
      "personalInfo",
    ])
  )
}

function summarizeTwitter(rawItems: Record<string, unknown>[]) {
  return rawItems.slice(0, 5).map((item) =>
    compactRecord(item, [
      "name",
      "username",
      "url",
      "profileUrl",
      "description",
      "bio",
      "verified",
      "followersCount",
      "followers",
      "location",
      "full_name",
    ])
  )
}

function summarizeBankruptcy(rawItems: Record<string, unknown>[]) {
  return rawItems.slice(0, 5).map((item) =>
    compactRecord(item, [
      "title",
      "url",
      "link",
      "description",
      "snippet",
      "court",
      "jurisdiction",
      "caseNumber",
      "case_number",
      "status",
      "date",
    ])
  )
}

function buildSubjectFacts(debtor: DbDebtor) {
  const enriched = new Map(
    debtor.enrichedFields.map((row) => [row.fieldName, row.value?.trim() ? row.value.trim() : null]),
  )
  return {
    debtorId: debtor.id,
    caseRef: debtor.caseRef,
    fullName: debtor.debtorName,
    phone: enriched.get("phone") ?? null,
    address: enriched.get("address") ?? null,
    email: enriched.get("email") ?? null,
    taxId: enriched.get("tax_id") ?? null,
    locationHint: enriched.get("address") ?? debtor.country ?? null,
  }
}

function buildGoogleQuery(facts: z.infer<typeof inputFactsSchema>): string {
  const parts = [`"${escapeQuotes(facts.fullName)}"`]
  if (facts.address) parts.push(`"${escapeQuotes(facts.address)}"`)
  if (facts.locationHint && facts.locationHint !== facts.address) {
    parts.push(`"${escapeQuotes(facts.locationHint)}"`)
  }
  return collapseSpaces(parts.join(" "))
}

function buildLinkedInQuery(facts: z.infer<typeof inputFactsSchema>): Record<string, unknown> {
  const [firstName, ...rest] = facts.fullName.split(/\s+/).filter(Boolean)
  const lastName = rest.length ? rest[rest.length - 1] : ""
  const query: Record<string, unknown> = {
    nameSearchKeywords: [facts.fullName],
    maxResults: 5,
  }
  if (firstName) query.firstName = firstName
  if (lastName) query.lastName = lastName
  if (facts.locationHint) query.geocodeLocation = facts.locationHint
  return query
}

function buildTwitterQuery(facts: z.infer<typeof inputFactsSchema>): Record<string, unknown> {
  return {
    searchTerms: [facts.fullName],
    searchType: "users",
    maxItems: 5,
    scrapeProfileInfo: true,
    proxyConfiguration: {
      useApifyProxy: true,
    },
  }
}

function buildBankruptcyQuery(
  facts: z.infer<typeof inputFactsSchema>,
): { searchQuery: string; maxResults: number } {
  return {
    searchQuery: facts.fullName,
    maxResults: 5,
  }
}

async function runSocialBranch(facts: z.infer<typeof inputFactsSchema>) {
  const queries = {
    google: buildGoogleQuery(facts),
    instagram: facts.fullName,
    linkedin: buildLinkedInQuery(facts),
    twitter: buildTwitterQuery(facts),
  }

  const [google, instagram, linkedin, twitter] = await Promise.all([
    runActor<Record<string, unknown>>(APIFY_ACTORS.googleSearch, {
      queries: [queries.google],
      resultsPerPage: 5,
      maxPagesPerQuery: 1,
    }),
    runActor<Record<string, unknown>>(APIFY_ACTORS.instagramSearchUsers, {
      query: queries.instagram,
    }),
    runActor<Record<string, unknown>>(APIFY_ACTORS.linkedinPeopleSearch, queries.linkedin),
    runActor<Record<string, unknown>>(APIFY_ACTORS.twitterSearchUsers, queries.twitter),
  ])

  return {
    google: {
      ...google,
      query: queries.google,
      items: summarizeGoogle(google.items),
    },
    instagram: {
      ...instagram,
      query: queries.instagram,
      items: summarizeInstagram(instagram.items),
    },
    linkedin: {
      ...linkedin,
      query: JSON.stringify(queries.linkedin),
      items: summarizeLinkedIn(linkedin.items),
    },
    twitter: {
      ...twitter,
      query: JSON.stringify(queries.twitter),
      items: summarizeTwitter(twitter.items),
    },
  }
}

async function runBankruptcyBranch(facts: z.infer<typeof inputFactsSchema>) {
  const query: { searchQuery: string; maxResults: number } = buildBankruptcyQuery(facts)
  const run = await runActor<Record<string, unknown>>(APIFY_ACTORS.bankruptcy, query)
  return {
    ...run,
    query: query.searchQuery,
    items: summarizeBankruptcy(run.items),
  }
}

function compactBranchOutput(branch: {
  query: string
  actorId: string
  runId: string
  runUrl: string
  items: unknown[]
}) {
  return {
    query: branch.query,
    actorId: branch.actorId,
    runId: branch.runId,
    runUrl: branch.runUrl,
    itemCount: branch.items.length,
    items: branch.items.slice(0, 5),
  }
}

function buildFinalPrompt(args: {
  facts: z.infer<typeof inputFactsSchema>
  social: Awaited<ReturnType<typeof runSocialBranch>>
  bankruptcy: Awaited<ReturnType<typeof runBankruptcyBranch>>
}) {
  return `You are consolidating debtor enrichment evidence from parallel Apify actor runs.

Known baseline identity facts:
${JSON.stringify(args.facts, null, 2)}

You must NOT output any of the known baseline facts unless you are normalizing them internally; only emit new enrichment values.

Actor evidence bundle:
${JSON.stringify(
  {
    social: {
      google: compactBranchOutput(args.social.google),
      instagram: compactBranchOutput(args.social.instagram),
      linkedin: compactBranchOutput(args.social.linkedin),
      twitter: compactBranchOutput(args.social.twitter),
    },
    bankruptcy: compactBranchOutput(args.bankruptcy),
  },
  null,
  2,
)}

Rules:
- Emit only optional enriched fields that are directly supported by the evidence.
- Supported output keys are: employer, assets, social_media_hints, income_bracket.
- Each populated field must include a non-empty string value and traceSteps.
- traceSteps must mirror field_trace_steps structure:
  stepNumber, agentName, action, reasoning, finding, confidence, durationMs, sources.
- Trace steps should explain how the combined actor evidence supports the field.
- Keep reasoning factual and conservative. Do not invent missing facts.
- If evidence is weak, omit the field entirely.
`
}

async function persistEnrichment(
  debtorId: string,
  output: DebtorEnrichmentOutput,
): Promise<Array<{ fieldName: string; value: string }>> {
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
      sources: step.sources,
      durationMs: step.durationMs,
    }))
    await EnrichedFieldModel.upsert(debtorId, fieldName, value, traceSteps)
    persisted.push({ fieldName, value })
  }
  return persisted
}

export const debtorEnrichmentTask = task({
  id: "debtor-enrichment",
  maxDuration: 1800,
  run: async (payload: DebtorEnrichmentPayload) => {
    const debtor = await DebtorModel.findById(payload.debtorId)
    if (!debtor) {
      throw new Error(`Debtor ${payload.debtorId} not found`)
    }

    const facts = inputFactsSchema.parse(buildSubjectFacts(debtor))
    logger.log("debtor-enrichment start", {
      debtorId: facts.debtorId,
      caseRef: facts.caseRef,
      fullName: facts.fullName,
    })

    const [social, bankruptcy] = await Promise.all([
      runSocialBranch(facts),
      runBankruptcyBranch(facts),
    ])

    const llm = await safeGenerateObject({
      system:
        "You consolidate social and public-record evidence into structured debtor enrichment. Be conservative and only emit directly supported enrichment values.",
      prompt: buildFinalPrompt({ facts, social, bankruptcy }),
      schema: debtorEnrichmentOutputSchema,
      schemaName: "DebtorEnrichment",
    })

    const finalOutput: DebtorEnrichmentOutput = llm ?? {}
    const persisted = await persistEnrichment(debtor.id, finalOutput)

    await DebtorModel.update(debtor.id, {
      enrichmentStatus: "complete",
    })

    logger.log("debtor-enrichment complete", {
      debtorId: debtor.id,
      caseRef: debtor.caseRef,
      persisted: persisted.map((row) => row.fieldName),
    })

    return {
      debtorId: debtor.id,
      caseRef: debtor.caseRef,
      facts,
      branches: {
        social,
        bankruptcy,
      },
      finalOutput,
      persisted,
    }
  },
})
