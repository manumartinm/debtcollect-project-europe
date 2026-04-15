import { generateObject } from "ai"

import { defaultModel } from "./openai-model.js"

export async function safeGenerateObject<T extends Record<string, unknown>>(opts: {
  system: string
  prompt: string
  schema: import("zod").ZodType<T>
  schemaName?: string
}): Promise<T | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  try {
    const { object } = await generateObject({
      model: defaultModel(),
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
