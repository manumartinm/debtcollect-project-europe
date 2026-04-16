import {
  APIFY_ACTORS,
  type ActorRunResult,
  type ApifyActorClient,
  apifyActorClient,
} from "../apify.js"
import type { PipelineBranches, WrappedActorBranch } from "./pipeline-types.js"
import { ApifyDatasetSummarizer, apifyDatasetSummarizer } from "./summarize-items.js"
import { DebtorApifyQueryBuilder, type SubjectFacts } from "./subject-facts.js"

function toWrappedBranch(
  run: ActorRunResult<Record<string, unknown>>,
  query: string,
  summarizedItems: Record<string, unknown>[],
): WrappedActorBranch {
  return {
    ...run,
    query,
    items: summarizedItems,
  }
}

/**
 * Runs all configured Apify actors for one debtor (parallel wave + skip-trace fallback + optional NY UCC).
 */
export class ApifyActorPipeline {
  private readonly queries: DebtorApifyQueryBuilder

  constructor(
    private readonly facts: SubjectFacts,
    private readonly apify: ApifyActorClient = apifyActorClient,
    private readonly summarizer: ApifyDatasetSummarizer = apifyDatasetSummarizer,
  ) {
    this.queries = new DebtorApifyQueryBuilder(facts)
  }

  async run(): Promise<PipelineBranches> {
    const googleQuery = this.queries.googleSearchQuery()
    const linkedinQuery = this.queries.linkedInPeopleSearchInput()
    const twitterQuery = this.queries.twitterUserSearchInput()
    const bankruptcyQuery = this.queries.bankruptcySearchInput()

    const [
      google,
      instagram,
      linkedin,
      twitter,
      bankruptcy,
      skipTracePrimary,
      courtRecords,
      recapDockets,
      businessEntity,
      propertyTax,
    ] = await Promise.all([
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.googleSearch, {
        queries: [googleQuery],
        resultsPerPage: 5,
        maxPagesPerQuery: 1,
      }),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.instagramSearchUsers, {
        query: this.facts.fullName,
      }),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.linkedinPeopleSearch, linkedinQuery),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.twitterSearchUsers, twitterQuery),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.bankruptcy, bankruptcyQuery),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.skipTrace, this.queries.skipTraceInput()),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.courtRecords, this.queries.courtRecordsInput()),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.recapDockets, this.queries.recapDocketsInput()),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.businessEntity, this.queries.businessEntityInput()),
      this.apify.run<Record<string, unknown>>(APIFY_ACTORS.propertyTax, this.queries.propertyTaxInput()),
    ])

    const { skipRun, usedFallback } = await this.resolveSkipTrace(skipTracePrimary)

    const uccNy =
      this.facts.state === "NY"
        ? await this.apify.run<Record<string, unknown>>(APIFY_ACTORS.uccNy, {
            debtorName: this.facts.fullName,
            maxResults: 20,
          })
        : null

    const businessItems = [...businessEntity.items, ...(uccNy?.items ?? [])]
    const s = this.summarizer

    return {
      social: {
        google: toWrappedBranch(google, googleQuery, s.summarizeGoogle(google.items)),
        instagram: toWrappedBranch(instagram, this.facts.fullName, s.summarizeInstagram(instagram.items)),
        linkedin: toWrappedBranch(
          linkedin,
          JSON.stringify(linkedinQuery),
          s.summarizeLinkedIn(linkedin.items),
        ),
        twitter: toWrappedBranch(
          twitter,
          JSON.stringify(twitterQuery),
          s.summarizeTwitter(twitter.items),
        ),
      },
      bankruptcy: toWrappedBranch(
        bankruptcy,
        bankruptcyQuery.searchQuery,
        s.summarizeBankruptcy(bankruptcy.items),
      ),
      skipTrace: {
        actorId: skipRun.actorId,
        runId: skipRun.runId,
        runUrl: skipRun.runUrl,
        query: usedFallback
          ? `${this.facts.fullName} (truepeople fallback)`
          : JSON.stringify(this.queries.skipTraceInput()),
        usedFallback,
        fallbackActorId: usedFallback ? APIFY_ACTORS.truePeopleSearch : undefined,
        items: s.summarizeSkipTrace(skipRun.items),
      },
      courtRecords: toWrappedBranch(
        courtRecords,
        this.facts.fullName,
        s.summarizeCourtRecords(courtRecords.items),
      ),
      recapDockets: toWrappedBranch(
        recapDockets,
        this.facts.fullName,
        s.summarizeRecapDockets(recapDockets.items),
      ),
      businessEntity: toWrappedBranch(
        businessEntity,
        `${this.facts.fullName} ${this.facts.state}${uccNy ? " + UCC NY" : ""}`,
        s.summarizeBusinessEntity(businessItems),
      ),
      uccNy: uccNy ? toWrappedBranch(uccNy, this.facts.fullName, s.summarizeUcc(uccNy.items)) : null,
      propertyTax: toWrappedBranch(
        propertyTax,
        `${this.facts.fullName} ${this.facts.state}`,
        s.summarizeProperty(propertyTax.items),
      ),
    }
  }

  private async resolveSkipTrace(primary: ActorRunResult<Record<string, unknown>>): Promise<{
    skipRun: ActorRunResult<Record<string, unknown>>
    usedFallback: boolean
  }> {
    if (primary.items.length > 0) {
      return { skipRun: primary, usedFallback: false }
    }
    const fallback = await this.apify.run<Record<string, unknown>>(APIFY_ACTORS.truePeopleSearch, {
      name: this.facts.fullName,
      state: this.facts.state,
    })
    return { skipRun: fallback, usedFallback: true }
  }
}
