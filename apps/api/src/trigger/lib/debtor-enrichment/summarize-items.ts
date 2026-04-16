/** Normalizes Apify dataset rows into compact JSON for LLM context. */

export class ApifyDatasetSummarizer {
  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    return {}
  }

  private firstString(...values: unknown[]): string | null {
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

  private normalizeUrl(value: unknown): string | null {
    const text = this.firstString(value)
    if (!text) return null
    try {
      return new URL(text).toString()
    } catch {
      return text.startsWith("http://") || text.startsWith("https://") ? text : null
    }
  }

  private compactRecord(record: Record<string, unknown>, keys: string[]) {
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
            : this.asRecord(entry)
        )
        if (list.length) out[key] = list
        continue
      }
      if (typeof value === "object") {
        out[key] = this.asRecord(value)
      }
    }
    return out
  }

  summarizeGoogle(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 2).map((item) => {
      const searchQuery = this.asRecord(item.searchQuery)
      const organicResults = Array.isArray(item.organicResults) ? item.organicResults : []
      const suggestedResults = Array.isArray(item.suggestedResults) ? item.suggestedResults : []
      return {
        query: this.firstString(searchQuery.term, searchQuery.url) ?? null,
        searchUrl: this.normalizeUrl(item.url),
        organicResults: organicResults.slice(0, 5).map((result) =>
          this.compactRecord(this.asRecord(result), ["title", "url", "displayedUrl", "description", "date"])
        ),
        suggestedResults: suggestedResults.slice(0, 5).map((result) =>
          this.compactRecord(this.asRecord(result), ["title", "url", "displayedUrl", "description"])
        ),
      }
    })
  }

  summarizeInstagram(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 2).map((item) => {
      const result = this.asRecord(item.result)
      const users = Array.isArray(result.users) ? result.users : []
      return {
        query: this.firstString(item.query),
        numResults: this.firstString(result.num_results),
        users: users.slice(0, 5).map((user) =>
          this.compactRecord(this.asRecord(user), [
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

  summarizeLinkedIn(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 5).map((item) =>
      this.compactRecord(item, [
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

  summarizeTwitter(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 5).map((item) =>
      this.compactRecord(item, [
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

  summarizeBankruptcy(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 5).map((item) =>
      this.compactRecord(item, [
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

  summarizeSkipTrace(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 8).map((item) =>
      this.compactRecord(item, [
        "phone",
        "phones",
        "email",
        "emails",
        "address",
        "addresses",
        "city",
        "state",
        "zip",
        "name",
        "fullName",
        "relatives",
        "dob",
        "dateOfBirth",
        "age",
      ])
    )
  }

  summarizeCourtRecords(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 8).map((item) =>
      this.compactRecord(item, [
        "title",
        "caseNumber",
        "case_number",
        "court",
        "jurisdiction",
        "date",
        "status",
        "url",
        "description",
        "parties",
      ])
    )
  }

  summarizeRecapDockets(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 8).map((item) =>
      this.compactRecord(item, [
        "caseName",
        "caseId",
        "court",
        "dateFiled",
        "partyName",
        "url",
        "docketNumber",
        "description",
      ])
    )
  }

  summarizeBusinessEntity(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 8).map((item) =>
      this.compactRecord(item, [
        "entityName",
        "name",
        "status",
        "officers",
        "registeredAgent",
        "formationDate",
        "state",
        "url",
      ])
    )
  }

  summarizeUcc(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 6).map((item) =>
      this.compactRecord(item, ["debtorName", "securedParty", "filingDate", "description", "url"])
    )
  }

  summarizeProperty(rawItems: Record<string, unknown>[]) {
    return rawItems.slice(0, 8).map((item) =>
      this.compactRecord(item, [
        "ownerName",
        "parcelId",
        "address",
        "assessedValue",
        "taxAmount",
        "county",
        "state",
        "url",
      ])
    )
  }
}

export const apifyDatasetSummarizer = new ApifyDatasetSummarizer()
