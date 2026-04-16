import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

/** Resolves model id; empty `OPENAI_RESEARCH_MODEL` is treated as unset (use default). */
export function resolveOpenAiResearchModelId(): string {
  const raw = process.env.OPENAI_RESEARCH_MODEL
  const t = typeof raw === "string" ? raw.trim() : ""
  return t || "gpt-4o-mini"
}

/** Default chat model for enrichment (override with `OPENAI_RESEARCH_MODEL`). */
export class ResearchOpenAiModel {
  constructor(private readonly modelId = resolveOpenAiResearchModelId()) {}

  get languageModel(): LanguageModel {
    return openai(this.modelId)
  }
}

export const researchOpenAiModel = new ResearchOpenAiModel()

/** @deprecated Prefer `researchOpenAiModel.languageModel` */
export function defaultModel(): LanguageModel {
  return researchOpenAiModel.languageModel
}
