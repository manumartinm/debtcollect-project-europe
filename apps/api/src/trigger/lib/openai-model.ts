import { openai } from "@ai-sdk/openai"

/** Default model for planning + extraction (override via env). */
export function defaultModel() {
  const id = process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini"
  return openai(id)
}
