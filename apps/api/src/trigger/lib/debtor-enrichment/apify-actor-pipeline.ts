import {
  APIFY_ACTORS,
  type ActorRunResult,
  type ApifyActorClient,
  apifyActorClient,
} from "../apify.js"
import { enrichRecapDocketItems } from "../courtlistener.js"
import { debtorEnrichmentLog } from "../task-logger.js"
import type { PipelineBranches, WrappedActorBranch } from "./pipeline-types.js"
import { apifyRunSummary } from "./apify-actor-summary.js"
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
 * Runs all configured Apify actors for one debtor (parallel wave + optional NY UCC).
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
    const t0 = Date.now()
    debtorEnrichmentLog.info("Apify pipeline: starting parallel wave (10 actors)", {
      fullName: this.facts.fullName,
      state: this.facts.state,
    })

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
        queries: googleQuery,
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

    const waveMs = Date.now() - t0
    debtorEnrichmentLog.info("Apify pipeline: parallel wave finished", {
      durationMs: waveMs,
      actors: {
        googleSearch: apifyRunSummary(google),
        instagram: apifyRunSummary(instagram),
        linkedin: apifyRunSummary(linkedin),
        twitter: apifyRunSummary(twitter),
        bankruptcy: apifyRunSummary(bankruptcy),
        skipTrace: apifyRunSummary(skipTracePrimary),
        courtRecords: apifyRunSummary(courtRecords),
        recapDockets: apifyRunSummary(recapDockets),
        businessEntity: apifyRunSummary(businessEntity),
        propertyTax: apifyRunSummary(propertyTax),
      },
    })

    if (recapDockets.items.length > 0) {
      recapDockets.items = await enrichRecapDocketItems(recapDockets.items)
    }

    const skipRun = skipTracePrimary

    let uccNy: ActorRunResult<Record<string, unknown>> | null = null
    if (this.facts.state === "NY") {
      debtorEnrichmentLog.info("Apify pipeline: running NY UCC actor", { state: "NY" })
      uccNy = await this.apify.run<Record<string, unknown>>(APIFY_ACTORS.uccNy, {
        debtorName: this.facts.fullName,
        maxResults: 20,
      })
      debtorEnrichmentLog.info("Apify pipeline: NY UCC finished", apifyRunSummary(uccNy))
    } else {
      debtorEnrichmentLog.debug("Apify pipeline: skipping UCC (not NY)", { state: this.facts.state })
    }

    const businessItems = [...businessEntity.items, ...(uccNy?.items ?? [])]
    const s = this.summarizer

    debtorEnrichmentLog.info("Apify pipeline: summarizing datasets + building branches", {
      totalDurationMs: Date.now() - t0,
    })

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
        query: JSON.stringify(this.queries.skipTraceInput()),
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
}
