import { logger } from "@trigger.dev/sdk"
import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import type { z } from "zod"

import { researchOpenAiModel } from "./openai-model.js"
import { debtorEnrichmentLog } from "./task-logger.js"

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
      logger.warn("[llm-extract] skipped: OPENAI_API_KEY not set")
      debtorEnrichmentLog.warn("openai: generateObject skipped (no OPENAI_API_KEY)", {
        schemaName: opts.schemaName ?? "Extract",
      })
      return null
    }

    const schemaName = opts.schemaName ?? "Extract"
    debtorEnrichmentLog.info("openai: generateObject request", {
      schemaName,
      systemChars: opts.system.length,
      promptChars: opts.prompt.length,
    })

    try {
      const { object } = await generateObject({
        model: this.resolveModel(),
        system: opts.system,
        prompt: opts.prompt,
        schema: opts.schema,
        schemaName,
      })
      const keys = object && typeof object === "object" ? Object.keys(object as object) : []
      debtorEnrichmentLog.info("openai: generateObject response ok", {
        schemaName,
        outputKeyCount: keys.length,
        outputKeys: keys.slice(0, 20),
      })
      return object as T
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error("[llm-extract] generateObject failed", { error: message })
      debtorEnrichmentLog.error("openai: generateObject failed", {
        schemaName,
        error: message,
      })
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
