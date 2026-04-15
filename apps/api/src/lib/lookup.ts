import { generateObject, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

const APIFY_API_BASE = "https://api.apify.com/v2"
const DEFAULT_MAX_RESULTS = 5

export const lookupSourceSchema = z.enum([
  "google",
  "instagram",
  "linkedin",
  "twitter",
  "bankruptcy",
  "court",
  "collections",
])

export type LookupSource = z.infer<typeof lookupSourceSchema>

const socialLookupSources = ["google", "instagram", "linkedin", "twitter"] as const
const publicRecordSources = ["bankruptcy", "court", "collections"] as const

export const lookupFamilySchema = z.enum(["social", "public_records"])

export type LookupFamily = z.infer<typeof lookupFamilySchema>

export const lookupSubjectSchema = z.object({
  fullName: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  username: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
})

export const lookupRequestSchema = z.object({
  subject: lookupSubjectSchema,
  maxResults: z.number().int().min(1).max(5).default(DEFAULT_MAX_RESULTS),
})

export type LookupRequest = z.infer<typeof lookupRequestSchema>

export const lookupItemSchema = z.object({
  rank: z.number().int().min(1).max(5),
  score: z.number().min(0).max(1),
  source: lookupSourceSchema,
  displayName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  profileUrl: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  snippet: z.string().nullable(),
  location: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  verified: z.boolean().nullable(),
  mutualEvidence: z.array(z.string()),
  raw: z.record(z.unknown()),
})

export type LookupItem = z.infer<typeof lookupItemSchema>

export const apifyLookupResultSchema = z.object({
  source: lookupSourceSchema,
  actorId: z.string(),
  query: z.string(),
  maxResults: z.number().int().min(1).max(5),
  runId: z.string().nullable(),
  datasetId: z.string().nullable(),
  meta: z
    .object({
      requestedActorId: z.string(),
      fallbackUsed: z.boolean(),
      primaryActorId: z.string().nullable().optional(),
      primaryError: z.string().nullable().optional(),
    })
    .optional(),
  items: z.array(lookupItemSchema).max(5),
  rawItems: z.array(z.record(z.unknown())),
})

export type ApifyLookupResult = z.infer<typeof apifyLookupResultSchema>
type CandidateLike = Omit<LookupItem, "raw">

const selectionCandidateSchema = z.object({
  rank: z.number().int().min(1).max(5),
  score: z.number().min(0).max(1),
  source: lookupSourceSchema,
  displayName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  profileUrl: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  snippet: z.string().nullable(),
  location: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  verified: z.boolean().nullable(),
  mutualEvidence: z.array(z.string()),
})

const judgedCandidateSchema = selectionCandidateSchema.extend({
  reasoning: z.array(z.string()),
})

export const selectionResultSchema = z.object({
  source: lookupSourceSchema,
  query: z.string(),
  selectedItem: judgedCandidateSchema.nullable(),
  notes: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low", "none"]),
})

export type SelectionResult = z.infer<typeof selectionResultSchema>

type ApifyRun = {
  id: string
  defaultDatasetId?: string | null
  status?: string
}

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN ?? process.env.APIFY_API_TOKEN
  if (!token) {
    throw new Error("APIFY_TOKEN or APIFY_API_TOKEN is required to run Apify lookups")
  }
  return token
}

function getOpenAIModel() {
  return openai(process.env.OPENAI_MODEL ?? process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4.1-mini")
}

function normalizeActorId(actorId: string): string {
  if (actorId.includes("~")) return actorId
  const parts = actorId.split("/")
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[0]}~${parts[1]}`
  }
  return actorId
}

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

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).toString()
  } catch {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value
    }
    if (value.startsWith("@")) return value
    return null
  }
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"')
}

function normalizePhone(value: string): string {
  const trimmed = value.trim()
  const digits = trimmed.replace(/[^\d]/g, "")
  if (trimmed.startsWith("+") || trimmed.startsWith("(+")) {
    return `+${digits}`
  }
  return digits ? `+${digits}` : trimmed
}

function summarizeItem(item: CandidateLike) {
  return {
    rank: item.rank,
    score: item.score,
    source: item.source,
    displayName: item.displayName,
    username: item.username,
    profileUrl: item.profileUrl,
    headline: item.headline,
    location: item.location,
    verified: item.verified,
  }
}

function toSelectionCandidate(item: LookupItem): CandidateLike {
  return {
    rank: item.rank,
    score: item.score,
    source: item.source,
    displayName: item.displayName,
    firstName: item.firstName,
    lastName: item.lastName,
    username: item.username,
    profileUrl: item.profileUrl,
    headline: item.headline,
    bio: item.bio,
    snippet: item.snippet,
    location: item.location,
    email: item.email,
    phone: item.phone,
    verified: item.verified,
    mutualEvidence: item.mutualEvidence,
  }
}

type SubjectSignals = {
  fullName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  username: string | null
  company: string | null
  location: string | null
  rawText: string
}

function collectText(value: unknown): string[] {
  const out: string[] = []
  const seen = new Set<unknown>()

  const walk = (current: unknown): void => {
    if (current == null || seen.has(current)) return
    if (typeof current === "string") {
      const trimmed = current.trim()
      if (trimmed) out.push(trimmed)
      return
    }
    if (typeof current === "number" || typeof current === "boolean") {
      out.push(String(current))
      return
    }
    if (Array.isArray(current)) {
      seen.add(current)
      for (const item of current) walk(item)
      return
    }
    if (typeof current === "object") {
      seen.add(current)
      for (const entry of Object.values(current as Record<string, unknown>)) {
        walk(entry)
      }
    }
  }

  walk(value)
  return out
}

function readSignals(subject: unknown): SubjectSignals {
  const record = asRecord(subject)
  const rawText = collectText(subject).slice(0, 32).join(" ")

  const fullName =
    firstString(
      record.fullName,
      record.full_name,
      record.name,
      record.displayName,
      record.display_name
    ) ?? null
  const firstName = firstString(record.firstName, record.first_name) ?? null
  const lastName = firstString(record.lastName, record.last_name) ?? null
  const email = firstString(record.email, record.emailAddress, record.email_address)
  const phoneValue = firstString(record.phone, record.phoneNumber, record.phone_number)
  const phone = phoneValue ? normalizePhone(phoneValue) : null
  const username = firstString(
    record.username,
    record.userName,
    record.handle,
    record.twitterHandle,
    record.instagramHandle,
    record.linkedinHandle
  )
  const company = firstString(record.company, record.employer, record.organization)
  const location = firstString(record.location, record.city, record.country)

  return {
    fullName,
    firstName,
    lastName,
    email,
    phone,
    username,
    company,
    location,
    rawText,
  }
}

function identityQuery(signals: SubjectSignals): string {
  if (signals.fullName) return signals.fullName
  if (signals.firstName && signals.lastName) return `${signals.firstName} ${signals.lastName}`
  if (signals.username) return signals.username.replace(/^@/, "")
  if (signals.email) return signals.email
  if (signals.phone) return signals.phone
  return signals.rawText || "unknown person"
}

function buildGoogleQuery(source: LookupSource, signals: SubjectSignals): string {
  const identity = identityQuery(signals)
  const quoted = `"${escapeQuotes(identity)}"`

  switch (source) {
    case "instagram":
      return collapseSpaces(
        [
          `site:instagram.com/in OR site:instagram.com/p`,
          quoted,
          signals.location ? `"${escapeQuotes(signals.location)}"` : null,
          signals.company ? `"${escapeQuotes(signals.company)}"` : null,
        ]
          .filter(Boolean)
          .join(" ")
      )
    case "linkedin":
      return collapseSpaces(
        [
          `site:linkedin.com/in`,
          quoted,
          signals.location ? `"${escapeQuotes(signals.location)}"` : null,
          signals.company ? `"${escapeQuotes(signals.company)}"` : null,
        ]
          .filter(Boolean)
          .join(" ")
      )
    case "twitter":
      return collapseSpaces(
        [
          `site:x.com OR site:twitter.com`,
          quoted,
          signals.company ? `"${escapeQuotes(signals.company)}"` : null,
          signals.location ? `"${escapeQuotes(signals.location)}"` : null,
        ]
          .filter(Boolean)
          .join(" ")
      )
    case "bankruptcy":
      return collapseSpaces(
        [
          `site:*.gov OR site:*.uscourts.gov OR site:*.court OR site:*.judiciary`,
          `bankruptcy`,
          quoted,
          signals.location ? `"${escapeQuotes(signals.location)}"` : null,
          signals.company ? `"${escapeQuotes(signals.company)}"` : null,
        ]
          .filter(Boolean)
          .join(" ")
      )
    case "court":
      return collapseSpaces(
        [
          `site:*.gov OR site:*.uscourts.gov OR site:*.court OR site:*.judiciary`,
          `court OR docket OR case`,
          quoted,
          signals.location ? `"${escapeQuotes(signals.location)}"` : null,
          signals.company ? `"${escapeQuotes(signals.company)}"` : null,
        ]
          .filter(Boolean)
          .join(" ")
      )
    case "collections":
      return collapseSpaces(
        [
          `site:*.gov OR site:*.court OR site:*.judiciary`,
          `collections OR judgment OR debt`,
          quoted,
          signals.location ? `"${escapeQuotes(signals.location)}"` : null,
          signals.company ? `"${escapeQuotes(signals.company)}"` : null,
        ]
          .filter(Boolean)
          .join(" ")
      )
    default:
      return collapseSpaces([quoted, signals.location ? `"${escapeQuotes(signals.location)}"` : null]
        .filter(Boolean)
        .join(" "))
  }
}

function buildGoogleInput(query: string) {
  return {
    queries: query,
    resultsPerPage: DEFAULT_MAX_RESULTS,
    maxPagesPerQuery: 1,
  }
}

function buildLinkedInInput(signals: SubjectSignals, maxResults: number) {
  const identity = identityQuery(signals)
  return {
    nameSearchKeywords: identity,
    firstName: signals.firstName ?? undefined,
    lastName: signals.lastName ?? undefined,
    company: signals.company ?? undefined,
    geocodeLocation: signals.location ?? undefined,
    maxResults,
  }
}

function buildTwitterInput(signals: SubjectSignals, maxResults: number) {
  const identity = identityQuery(signals)
  return {
    searchTerms: [identity],
    searchType: "users",
    maxItems: maxResults,
    scrapeProfileInfo: true,
    proxyConfiguration: {
      useApifyProxy: true,
    },
  }
}

function buildInstagramDiscoveryQuery(signals: SubjectSignals): string {
  const identity = identityQuery(signals)
  return collapseSpaces(
    [
      `site:instagram.com`,
      `"${escapeQuotes(identity)}"`,
      signals.email ? `"${escapeQuotes(signals.email)}"` : null,
      signals.phone ? `"${escapeQuotes(signals.phone)}"` : null,
    ]
      .filter(Boolean)
      .join(" ")
  )
}

function buildPublicRecordQuery(source: Exclude<LookupSource, "google" | "instagram" | "linkedin" | "twitter">, signals: SubjectSignals): string {
  return buildGoogleQuery(source, signals)
}

function extractGoogleItems(items: unknown[]): LookupItem[] {
  return items
    .map((item, index) => {
      const record = asRecord(item)
      const profileUrl = normalizeUrl(
        firstString(record.url, record.link, record.canonicalUrl, record.canonical_url)
      )
      const title = firstString(record.title, record.name)
      const snippet = firstString(
        record.description,
        record.snippet,
        record.text,
        record.titleSnippet
      )
      return {
        rank: index + 1,
        score: 0,
        source: "google" as const,
        displayName: title,
        firstName: null,
        lastName: null,
        username: null,
        profileUrl,
        headline: title,
        bio: null,
        snippet,
        location: firstString(record.location, record.country) ?? null,
        email: firstString(record.email) ?? null,
        phone: firstString(record.phone) ?? null,
        verified: null,
        mutualEvidence: [snippet, profileUrl].filter(Boolean) as string[],
        raw: record,
      }
    })
    .filter((item) => item.profileUrl || item.displayName || item.snippet)
    .slice(0, DEFAULT_MAX_RESULTS)
}

function extractInstagramItems(items: unknown[]): LookupItem[] {
  const flattened = items.flatMap((item) => {
    const record = asRecord(item)
    const wrapper = asRecord(record.result)
    const users = Array.isArray(wrapper.users)
      ? wrapper.users
      : Array.isArray(record.users)
        ? record.users
        : []

    if (users.length === 0) {
      return [record]
    }

    return users.map((user) => {
      const userRecord = asRecord(user)
      return {
        ...record,
        ...userRecord,
        sourceQuery: firstString(record.query, wrapper.query),
      }
    })
  })

  return flattened
    .map((item, index) => {
      const record = asRecord(item)
      const username = firstString(
        record.username,
        record.userName,
        record.handle,
        record.original_username,
        record.unique_id,
        record.pk_id
      )
      const profileUrl = normalizeUrl(
        firstString(record.profileUrl, record.url, record.instagramUrl, record.profile_url)
      ) ?? (username ? `https://www.instagram.com/${username.replace(/^@/, "")}/` : null)
      const fullName = firstString(record.fullName, record.full_name, record.name, record.displayName)
      const bio = firstString(record.bio, record.biography, record.description)
      const snippet = firstString(record.caption, record.latestPost, record.latest_post)
      const emails = Array.isArray(record.all_emails) ? record.all_emails : []
      const phones = Array.isArray(record.all_phone_numbers) ? record.all_phone_numbers : []
      const verified =
        typeof record.is_verified === "boolean"
          ? record.is_verified
          : typeof record.isVerified === "boolean"
            ? record.isVerified
            : null

      return {
        rank: index + 1,
        score: 0,
        source: "instagram" as const,
        displayName: fullName,
        firstName: firstString(record.firstName, record.first_name) ?? null,
        lastName: firstString(record.lastName, record.last_name) ?? null,
        username,
        profileUrl,
        headline: firstString(record.category, record.business_category) ?? bio,
        bio,
        snippet,
        location: firstString(record.location, record.country, record.geo) ?? null,
        email: firstString(record.email, emails[0]) ?? null,
        phone: firstString(record.phone, phones[0]) ?? null,
        verified,
        mutualEvidence: [fullName, username, bio, profileUrl].filter(Boolean) as string[],
        raw: record,
      }
    })
    .filter((item) => item.profileUrl || item.username || item.displayName)
    .slice(0, DEFAULT_MAX_RESULTS)
}

function extractLinkedInItems(items: unknown[]): LookupItem[] {
  return items
    .map((item, index) => {
      const record = asRecord(item)
      const firstName = firstString(record.firstName, record.first_name)
      const lastName = firstString(record.lastName, record.last_name)
      const derivedName = [firstName, lastName].filter(Boolean).join(" ")
      const fullName =
        firstString(record.fullName, record.full_name, record.name) ??
        (derivedName ? derivedName : null)
      const profileUrl = normalizeUrl(
        firstString(record.profileUrl, record.url, record.publicProfileUrl, record.public_url)
      )
      const headline = firstString(record.headline, record.jobTitle, record.position)
      const location = firstString(record.geoRegion, record.location, record.countryCode)
      const email = firstString(record.email)
      const phone = firstString(record.phone)

      return {
        rank: index + 1,
        score: 0,
        source: "linkedin" as const,
        displayName: fullName,
        firstName,
        lastName,
        username: firstString(record.publicIdentifier, record.username, record.handle),
        profileUrl,
        headline,
        bio: firstString(record.summary, record.about, record.description),
        snippet: firstString(record.snippet, record.previewText),
        location,
        email,
        phone,
        verified: typeof record.verified === "boolean" ? record.verified : null,
        mutualEvidence: [fullName, headline, location, profileUrl].filter(Boolean) as string[],
        raw: record,
      }
    })
    .filter((item) => item.profileUrl || item.displayName || item.headline)
    .slice(0, DEFAULT_MAX_RESULTS)
}

function extractTwitterItems(items: unknown[]): LookupItem[] {
  return items
    .map((item, index) => {
      const record = asRecord(item)
      const username = firstString(
        record.userName,
        record.username,
        record.handle,
        record.screenName
      )
      const profileUrl = normalizeUrl(
        firstString(record.twitterUrl, record.profileUrl, record.url)
      ) ?? (username ? `https://x.com/${username.replace(/^@/, "")}` : null)
      const fullName = firstString(record.name, record.fullName, record.displayName)
      const headline = firstString(record.description, record.bio, record.location)
      const verified = typeof record.isVerified === "boolean"
        ? record.isVerified
        : typeof record.verified === "boolean"
          ? record.verified
          : null

      return {
        rank: index + 1,
        score: 0,
        source: "twitter" as const,
        displayName: fullName,
        firstName: null,
        lastName: null,
        username,
        profileUrl,
        headline,
        bio: firstString(record.description, record.bio),
        snippet: firstString(record.text, record.latestTweet, record.latest_tweet),
        location: firstString(record.location, record.geo, record.geoRegion) ?? null,
        email: firstString(record.email) ?? null,
        phone: firstString(record.phone) ?? null,
        verified,
        mutualEvidence: [fullName, username, headline, profileUrl].filter(Boolean) as string[],
        raw: record,
      }
    })
    .filter((item) => item.profileUrl || item.displayName || item.username)
    .slice(0, DEFAULT_MAX_RESULTS)
}

function scoreItemAgainstSubject(item: LookupItem, subject: unknown): number {
  const signals = readSignals(subject)
  const identity = identityQuery(signals).toLowerCase()
  const candidates = [
    item.displayName,
    item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : null,
    item.username,
    item.headline,
    item.bio,
    item.snippet,
    item.profileUrl,
    item.email,
    item.phone,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  let score = 0
  if (signals.email && candidates.some((value) => value.includes(signals.email!.toLowerCase()))) {
    score += 0.35
  }
  if (signals.phone && candidates.some((value) => value.includes(signals.phone!.toLowerCase()))) {
    score += 0.25
  }
  if (signals.username) {
    const uname = signals.username.replace(/^@/, "").toLowerCase()
    if (candidates.some((value) => value.includes(uname))) score += 0.2
  }
  if (identity && candidates.some((value) => value.includes(identity))) {
    score += 0.2
  }
  if (signals.company && candidates.some((value) => value.includes(signals.company!.toLowerCase()))) {
    score += 0.05
  }
  if (signals.location && candidates.some((value) => value.includes(signals.location!.toLowerCase()))) {
    score += 0.05
  }
  return Math.min(1, score)
}

function rankItems(items: LookupItem[], subject: unknown): LookupItem[] {
  return [...items]
    .map((item) => ({
      ...item,
      score: scoreItemAgainstSubject(item, subject),
    }))
    .sort((a, b) => b.score - a.score || a.rank - b.rank)
    .slice(0, DEFAULT_MAX_RESULTS)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }))
}

async function runApifyActor(actorId: string, input: Record<string, unknown>): Promise<ApifyRun> {
  const normalizedActorId = normalizeActorId(actorId)
  const token = getApifyToken()
  const url = new URL(`${APIFY_API_BASE}/acts/${normalizedActorId}/runs`)
  url.searchParams.set("token", token)
  url.searchParams.set("waitForFinish", "120")

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Apify actor ${normalizedActorId} failed: ${response.status} ${text}`)
  }

  const payload = (await response.json()) as { data?: ApifyRun }
  if (payload.data) {
    return payload.data
  }

  return payload as ApifyRun
}

async function getDatasetItems(datasetId: string, limit: number): Promise<unknown[]> {
  const token = getApifyToken()
  const url = new URL(`${APIFY_API_BASE}/datasets/${datasetId}/items`)
  url.searchParams.set("token", token)
  url.searchParams.set("clean", "true")
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", String(limit))

  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Apify dataset ${datasetId} read failed: ${response.status} ${text}`)
  }

  const payload = (await response.json()) as unknown
  return Array.isArray(payload) ? payload : []
}

function makeResult(
  source: LookupSource,
  actorId: string,
  query: string,
  run: ApifyRun,
  rawItems: unknown[],
  subject: unknown,
  meta?: ApifyLookupResult["meta"]
): ApifyLookupResult {
  const normalized =
    source === "google"
      ? extractGoogleItems(rawItems)
      : source === "instagram"
        ? extractInstagramItems(rawItems)
        : source === "linkedin"
          ? extractLinkedInItems(rawItems)
          : extractTwitterItems(rawItems)

  const ranked = rankItems(normalized, subject)

  return {
    source,
    actorId,
    query,
    maxResults: DEFAULT_MAX_RESULTS,
    runId: run.id ?? null,
    datasetId: run.defaultDatasetId ?? null,
    meta,
    items: ranked,
    rawItems: rawItems.slice(0, DEFAULT_MAX_RESULTS).map(asRecord),
  }
}

async function runGoogleLookup(subject: unknown, maxResults: number): Promise<ApifyLookupResult> {
  const signals = readSignals(subject)
  const query = buildGoogleQuery("google", signals)
  const actorId = process.env.APIFY_GOOGLE_ACTOR_ID ?? "apify/google-search-scraper"
  const run = await runApifyActor(actorId, buildGoogleInput(query))
  const datasetId = run.defaultDatasetId ?? null
  const rawItems = datasetId ? await getDatasetItems(datasetId, maxResults) : []
  return makeResult("google", actorId, query, run, rawItems, subject)
}

async function runPublicRecordLookup(
  source: Exclude<LookupSource, "google" | "instagram" | "linkedin" | "twitter">,
  subject: unknown,
  maxResults: number
): Promise<ApifyLookupResult> {
  const signals = readSignals(subject)
  const query = buildPublicRecordQuery(source, signals)
  const actorId = process.env.APIFY_GOOGLE_ACTOR_ID ?? "apify/google-search-scraper"
  const run = await runApifyActor(actorId, buildGoogleInput(query))
  const datasetId = run.defaultDatasetId ?? null
  const rawItems = datasetId ? await getDatasetItems(datasetId, maxResults) : []
  return makeResult(source, actorId, query, run, rawItems, subject)
}

async function runInstagramLookup(subject: unknown, maxResults: number): Promise<ApifyLookupResult> {
  const signals = readSignals(subject)
  const query = identityQuery(signals)
  const actorId =
    process.env.APIFY_INSTAGRAM_ACTOR_ID ??
    "nkactors/instagram-search-users-api-no-cookies-fast-reliable"
  const run = await runApifyActor(actorId, {
    query,
  })
  const rawItems = run.defaultDatasetId ? await getDatasetItems(run.defaultDatasetId, maxResults) : []
  return makeResult("instagram", actorId, query, run, rawItems, subject)
}

async function runLinkedInLookup(subject: unknown, maxResults: number): Promise<ApifyLookupResult> {
  const signals = readSignals(subject)
  const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID ??
    "unlimitedleadtestinbox/linkedin-people-search-scraper-no-cookie"
  const input = buildLinkedInInput(signals, maxResults)
  try {
    const run = await runApifyActor(actorId, input)
    const rawItems = run.defaultDatasetId ? await getDatasetItems(run.defaultDatasetId, maxResults) : []

    if (rawItems.length === 0) {
      throw new Error("LinkedIn actor returned no results")
    }

    return makeResult("linkedin", actorId, JSON.stringify(input), run, rawItems, subject, {
      requestedActorId: actorId,
      fallbackUsed: false,
    })
  } catch (error) {
    const fallbackQuery = buildGoogleQuery("linkedin", signals)
    const googleActorId = process.env.APIFY_GOOGLE_ACTOR_ID ?? "apify/google-search-scraper"
    const fallbackRun = await runApifyActor(googleActorId, buildGoogleInput(fallbackQuery))
    const fallbackItems = fallbackRun.defaultDatasetId
      ? await getDatasetItems(fallbackRun.defaultDatasetId, maxResults)
      : []
    return makeResult("linkedin", googleActorId, fallbackQuery, fallbackRun, fallbackItems, subject, {
      requestedActorId: actorId,
      fallbackUsed: true,
      primaryActorId: actorId,
      primaryError: error instanceof Error ? error.message : String(error),
    })
  }
}

async function runTwitterLookup(subject: unknown, maxResults: number): Promise<ApifyLookupResult> {
  const signals = readSignals(subject)
  const actorId = process.env.APIFY_TWITTER_ACTOR_ID ?? "forge-api/x-scraper"
  const input = buildTwitterInput(signals, maxResults)
  const run = await runApifyActor(actorId, input)
  const rawItems = run.defaultDatasetId ? await getDatasetItems(run.defaultDatasetId, maxResults) : []
  return makeResult("twitter", actorId, JSON.stringify(input), run, rawItems, subject)
}

async function selectBestLookupItem(
  source: LookupSource,
  subject: unknown,
  result: ApifyLookupResult
): Promise<SelectionResult> {
  if (!process.env.OPENAI_API_KEY) {
    const rankedMatches = [...result.items]
      .sort((a, b) => b.score - a.score || a.rank - b.rank)
      .map((item, index) => ({
        ...toSelectionCandidate(item),
        rank: index + 1,
        reasoning: item.mutualEvidence.length > 0 ? item.mutualEvidence : ["rule-based match"],
      }))
    const confidence: SelectionResult["confidence"] =
      rankedMatches[0]?.score && rankedMatches[0].score >= 0.5 ? "medium" : "low"
    const selection = {
      source,
      query: result.query,
      selectedItem: rankedMatches[0] ?? null,
      notes: ["OPENAI_API_KEY not set; used deterministic fallback ranking."],
      confidence,
    }
    return selection
  }

  const model = getOpenAIModel()
  const subjectSignals = readSignals(subject)

  const { object } = await generateObject({
    model,
    schema: selectionResultSchema,
    system:
      "You are a strict identity-resolution judge. Choose exactly one candidate from the provided top-5 Apify results, or null if none match with confidence. Prefer exact name, username, email, or phone overlap. Do not return ranked lists.",
    prompt: [
      `Subject JSON: ${JSON.stringify(subject, null, 2)}`,
      `Extracted signals: ${JSON.stringify(subjectSignals, null, 2)}`,
      `Tool source: ${source}`,
      `Apify result envelope: ${JSON.stringify(result, null, 2)}`,
      "Return a structured result with selectedItem set to one of the five candidates, or null if no candidate is a credible match. Do not invent new records.",
    ].join("\n\n"),
  })

  return object
}

async function runLookupPipeline(source: LookupSource, subject: unknown, maxResults: number) {
  let result: ApifyLookupResult
  if (source === "google") {
    result = await runGoogleLookup(subject, maxResults)
  } else if (source === "instagram") {
    result = await runInstagramLookup(subject, maxResults)
  } else if (source === "linkedin") {
    result = await runLinkedInLookup(subject, maxResults)
  } else if (source === "bankruptcy" || source === "court" || source === "collections") {
    result = await runPublicRecordLookup(source, subject, maxResults)
  } else {
    result = await runTwitterLookup(subject, maxResults)
  }

  const selection = await selectBestLookupItem(source, subject, result)
  return {
    result,
    selection,
    debug: {
      source,
      actorId: result.actorId,
      query: result.query,
      fallbackUsed: result.meta?.fallbackUsed ?? false,
      primaryActorId: result.meta?.primaryActorId ?? null,
      primaryError: result.meta?.primaryError ?? null,
      rawCount: result.rawItems.length,
      candidateCount: result.items.length,
      topCandidates: result.items.map(summarizeItem),
      selectedItem: selection.selectedItem ? summarizeItem(selection.selectedItem) : null,
    },
  }
}

async function runMultiSourcePipeline(subject: unknown, maxResults: number) {
  const sources: LookupSource[] = [...socialLookupSources]
  type SuccessfulToolRun = Awaited<ReturnType<typeof runLookupPipeline>> & {
    source: LookupSource
    ok: true
  }
  type FailedToolRun = {
    source: LookupSource
    ok: false
    error: string
  }
  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const output = await runLookupPipeline(source, subject, maxResults)
      return { source, ...output }
    })
  )

  const toolRuns = settled.map<SuccessfulToolRun | FailedToolRun>((entry, index) => {
    if (entry.status === "fulfilled") {
      return { ok: true, ...entry.value }
    }
    return {
      source: sources[index],
      ok: false,
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    }
  })

  console.log(
    "[lookup] match-flow complete",
    JSON.stringify(
      {
        sources: toolRuns.map((entry) =>
          entry.ok
            ? {
                source: entry.source,
                confidence: entry.selection.confidence,
                selectedItem: entry.selection.selectedItem
                  ? summarizeItem(entry.selection.selectedItem)
                  : null,
              }
            : {
                source: entry.source,
                error: entry.error,
              }
        ),
      },
      null,
      2
    )
  )

  return {
    toolRuns,
  }
}

async function runSocialIngestionPipeline(subject: unknown, maxResults: number) {
  return runMultiSourcePipeline(subject, maxResults)
}

async function runPublicRecordIngestionPipeline(subject: unknown, maxResults: number) {
  const sources: LookupSource[] = [...publicRecordSources]
  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const output = await runLookupPipeline(source, subject, maxResults)
      return { source, ...output }
    })
  )

  const toolRuns = settled.map((entry, index) => {
    if (entry.status === "fulfilled") {
      return { ok: true as const, ...entry.value }
    }
    return {
      source: sources[index],
      ok: false as const,
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    }
  })

  return {
    toolRuns,
  }
}

async function runUnifiedIngestionPipeline(subject: unknown, maxResults: number) {
  const [social, publicRecords] = await Promise.all([
    runSocialIngestionPipeline(subject, maxResults),
    runPublicRecordIngestionPipeline(subject, maxResults),
  ])

  return {
    families: {
      social,
      publicRecords,
    },
    toolRuns: [...social.toolRuns, ...publicRecords.toolRuns],
  }
}

export const lookupTools = {
  google: tool({
    description:
      "Search Google and scrape the top 5 public results for a subject, returning structured JSON.",
    inputSchema: lookupRequestSchema,
    execute: async (input) => runLookupPipeline("google", input.subject, input.maxResults),
  }),
  instagram: tool({
    description:
      "Find likely Instagram profiles for a subject using public search, then scrape the top 5 profiles.",
    inputSchema: lookupRequestSchema,
    execute: async (input) => runLookupPipeline("instagram", input.subject, input.maxResults),
  }),
  linkedin: tool({
    description:
      "Find likely LinkedIn profiles for a subject using public search and return structured profile matches.",
    inputSchema: lookupRequestSchema,
    execute: async (input) => runLookupPipeline("linkedin", input.subject, input.maxResults),
  }),
  twitter: tool({
    description:
      "Find likely Twitter/X profiles for a subject using public search and return structured profile matches.",
    inputSchema: lookupRequestSchema,
    execute: async (input) => runLookupPipeline("twitter", input.subject, input.maxResults),
  }),
  bankruptcy: tool({
    description:
      "Search public bankruptcy records and web-indexed bankruptcy references for a subject.",
    inputSchema: lookupRequestSchema,
    execute: async (input) => runLookupPipeline("bankruptcy", input.subject, input.maxResults),
  }),
  court: tool({
    description:
      "Search court docket and public case references for a subject.",
    inputSchema: lookupRequestSchema,
    execute: async (input) => runLookupPipeline("court", input.subject, input.maxResults),
  }),
  collections: tool({
    description:
      "Search public collections, judgment, and debt-related references for a subject.",
    inputSchema: lookupRequestSchema,
    execute: async (input) => runLookupPipeline("collections", input.subject, input.maxResults),
  }),
} as const

export const lookupAgentApi = {
  runLookupPipeline,
  runMultiSourcePipeline,
  runSocialIngestionPipeline,
  runPublicRecordIngestionPipeline,
  runUnifiedIngestionPipeline,
  runGoogleLookup,
  runPublicRecordLookup,
  runInstagramLookup,
  runLinkedInLookup,
  runTwitterLookup,
  selectBestLookupItem,
  lookupTools,
  lookupRequestSchema,
  lookupItemSchema,
  apifyLookupResultSchema,
  selectionResultSchema,
}
