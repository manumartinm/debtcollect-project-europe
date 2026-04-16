import type { ActorRunResult } from "../apify.js"

/** One actor run plus human-readable query label and summarized dataset rows for the LLM. */
export type WrappedActorBranch = ActorRunResult<Record<string, unknown>> & {
  query: string
  items: Record<string, unknown>[]
}

export type SkipTraceBranch = {
  actorId: string
  runId: string
  runUrl: string
  query: string
  usedFallback: boolean
  fallbackActorId?: string
  items: Record<string, unknown>[]
}

/** Full output of all Apify calls for one debtor enrichment run. */
export type PipelineBranches = {
  social: {
    google: WrappedActorBranch
    instagram: WrappedActorBranch
    linkedin: WrappedActorBranch
    twitter: WrappedActorBranch
  }
  bankruptcy: WrappedActorBranch
  skipTrace: SkipTraceBranch
  courtRecords: WrappedActorBranch
  recapDockets: WrappedActorBranch
  businessEntity: WrappedActorBranch
  uccNy: WrappedActorBranch | null
  propertyTax: WrappedActorBranch
}

export type TraceSourceRow = { name: string; url: string; type: string }
