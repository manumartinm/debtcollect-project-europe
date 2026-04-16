import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

/** Default chat model for enrichment (override with `OPENAI_RESEARCH_MODEL`). */
export class ResearchOpenAiModel {
  constructor(private readonly modelId = process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini") {}

  get languageModel(): LanguageModel {
    return openai(this.modelId)
  }
}

export const researchOpenAiModel = new ResearchOpenAiModel()

/** @deprecated Prefer `researchOpenAiModel.languageModel` */
export function defaultModel(): LanguageModel {
  return researchOpenAiModel.languageModel
}
