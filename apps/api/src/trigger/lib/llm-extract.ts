import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import type { z } from "zod"

import { researchOpenAiModel } from "./openai-model.js"

export type StructuredObjectOptions<T extends Record<string, unknown>> = {
  system: string
  prompt: string
  schema: z.ZodType<T>
  schemaName?: string
}

/**
 * Wraps `ai` `generateObject` with env check and error handling.
 */
export class StructuredOutputService {
  constructor(
    private readonly resolveModel: () => LanguageModel = () => researchOpenAiModel.languageModel,
  ) {}

  async generateObject<T extends Record<string, unknown>>(
    opts: StructuredObjectOptions<T>,
  ): Promise<T | null> {
    if (!process.env.OPENAI_API_KEY) {
      return null
    }
    try {
      const { object } = await generateObject({
        model: this.resolveModel(),
        system: opts.system,
        prompt: opts.prompt,
        schema: opts.schema,
        schemaName: opts.schemaName ?? "Extract",
      })
      return object as T
    } catch (e) {
      console.error("[llm-extract] generateObject failed", e)
      return null
    }
  }
}

export const structuredOutputService = new StructuredOutputService()

export async function safeGenerateObject<T extends Record<string, unknown>>(
  opts: StructuredObjectOptions<T>,
): Promise<T | null> {
  return structuredOutputService.generateObject(opts)
}
