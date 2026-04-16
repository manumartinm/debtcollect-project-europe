import type { SkipTraceBranch, WrappedActorBranch } from "./pipeline-types.js"

/** Shapes pipeline branches into small JSON payloads for the LLM system prompt. */
export class PromptEvidenceCompactFormatter {
  wrappedActor(b: WrappedActorBranch) {
    return {
      query: b.query,
      actorId: b.actorId,
      runId: b.runId,
      runUrl: b.runUrl,
      itemCount: b.items.length,
      items: b.items.slice(0, 5),
    }
  }

  skipTrace(b: SkipTraceBranch) {
    return {
      ...b,
      items: b.items.slice(0, 5),
    }
  }
}

export const promptEvidenceCompactFormatter = new PromptEvidenceCompactFormatter()
