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

/** Total item count across all branches -- 0 means nothing useful was found. */
export function countPipelineItems(b: PipelineBranches): number {
  return (
    b.social.google.items.length +
    b.social.instagram.items.length +
    b.social.linkedin.items.length +
    b.social.twitter.items.length +
    b.bankruptcy.items.length +
    b.skipTrace.items.length +
    b.courtRecords.items.length +
    b.recapDockets.items.length +
    b.businessEntity.items.length +
    (b.uccNy?.items.length ?? 0) +
    b.propertyTax.items.length
  )
}
