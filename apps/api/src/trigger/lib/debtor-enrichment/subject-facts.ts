import { z } from "zod"

import { DebtorModel } from "../../../models/debtor.model.js"

export type DbDebtor = NonNullable<Awaited<ReturnType<typeof DebtorModel.findById>>>

export const inputFactsSchema = z.object({
  debtorId: z.string().min(1),
  caseRef: z.string().min(1),
  fullName: z.string().min(1),
  state: z.string().min(2),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  email: z.string().nullable(),
  taxId: z.string().nullable(),
  locationHint: z.string().nullable(),
})

export type SubjectFacts = z.infer<typeof inputFactsSchema>

/** Builds {@link SubjectFacts} from a DB debtor row. */
export class SubjectFactsFactory {
  static normalizeUsState(country: string): string {
    const t = country.trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(t)) return t
    const m = t.match(/(?:^|-)([A-Z]{2})$/)
    if (m) return m[1]
    return "CA"
  }

  static fromDebtor(debtor: DbDebtor): SubjectFacts {
    const enriched = new Map(
      debtor.enrichedFields.map((row) => [row.fieldName, row.value?.trim() ? row.value.trim() : null]),
    )
    return {
      debtorId: debtor.id,
      caseRef: debtor.caseRef,
      fullName: debtor.debtorName,
      state: SubjectFactsFactory.normalizeUsState(debtor.country),
      phone: enriched.get("phone") ?? null,
      address: enriched.get("address") ?? null,
      email: enriched.get("email") ?? null,
      taxId: enriched.get("tax_id") ?? null,
      locationHint: enriched.get("address") ?? debtor.country ?? null,
    }
  }
}

export function normalizeUsState(country: string): string {
  return SubjectFactsFactory.normalizeUsState(country)
}

export function buildSubjectFacts(debtor: DbDebtor): SubjectFacts {
  return SubjectFactsFactory.fromDebtor(debtor)
}

/**
 * Apify actor input payloads derived from a fixed {@link SubjectFacts} snapshot.
 * One instance per enrichment run.
 */
export class DebtorApifyQueryBuilder {
  constructor(private readonly facts: SubjectFacts) {}

  googleSearchQuery(): string {
    const parts = [`"${escapeQuotes(this.facts.fullName)}"`]
    if (this.facts.address) parts.push(`"${escapeQuotes(this.facts.address)}"`)
    if (this.facts.locationHint && this.facts.locationHint !== this.facts.address) {
      parts.push(`"${escapeQuotes(this.facts.locationHint)}"`)
    }
    return collapseSpaces(parts.join(" "))
  }

  linkedInPeopleSearchInput(): Record<string, unknown> {
    const [firstName, ...rest] = this.facts.fullName.split(/\s+/).filter(Boolean)
    const lastName = rest.length ? rest[rest.length - 1] : ""
    const query: Record<string, unknown> = {
      nameSearchKeywords: [this.facts.fullName],
      maxResults: 5,
    }
    if (firstName) query.firstName = firstName
    if (lastName) query.lastName = lastName
    if (this.facts.locationHint) query.geocodeLocation = this.facts.locationHint
    return query
  }

  twitterUserSearchInput(): Record<string, unknown> {
    return {
      searchTerms: [this.facts.fullName],
      searchType: "users",
      maxItems: 5,
      scrapeProfileInfo: true,
      proxyConfiguration: {
        useApifyProxy: true,
      },
    }
  }

  bankruptcySearchInput(): { searchQuery: string; maxResults: number } {
    return {
      searchQuery: this.facts.fullName,
      maxResults: 5,
    }
  }

  skipTraceInput(): Record<string, unknown> {
    return {
      searchQueries: [
        {
          query: `${this.facts.fullName} ${this.facts.state}`,
          state: this.facts.state,
        },
      ],
    }
  }

  courtRecordsInput(): Record<string, unknown> {
    return {
      searchQuery: this.facts.fullName,
      mode: "dockets",
      maxResults: 25,
    }
  }

  recapDocketsInput(): Record<string, unknown> {
    return {
      partyName: this.facts.fullName,
      maxResults: 25,
    }
  }

  businessEntityInput(): Record<string, unknown> {
    return {
      searchQuery: this.facts.fullName,
      state: this.facts.state,
      maxResults: 30,
    }
  }

  propertyTaxInput(): Record<string, unknown> {
    return {
      ownerName: this.facts.fullName,
      state: this.facts.state,
      maxResults: 50,
    }
  }
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"')
}
