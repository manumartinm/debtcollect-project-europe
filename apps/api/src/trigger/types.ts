import { z } from "zod"

export type AiSource = { name: string; url: string; type: string }

export const enrichmentTraceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  agentName: z.string().min(1),
  action: z.string().min(1),
  reasoning: z.string().min(1),
  finding: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  durationMs: z.number().int().min(0),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
})

export const enrichmentFieldOutputSchema = z.object({
  value: z.string().min(1),
  traceSteps: z.array(enrichmentTraceStepSchema).min(1),
})

/** Maps to `enriched_fields.field_name` check constraint — all keys nullable in LLM output.
 * OpenAI structured output requires every property in `required`, so we use `.nullable()` instead of `.optional()`. */
export const debtorEnrichmentOutputSchema = z.object({
  phone: enrichmentFieldOutputSchema.nullable(),
  address: enrichmentFieldOutputSchema.nullable(),
  employer: enrichmentFieldOutputSchema.nullable(),
  assets: enrichmentFieldOutputSchema.nullable(),
  social_media_hints: enrichmentFieldOutputSchema.nullable(),
  income_bracket: enrichmentFieldOutputSchema.nullable(),
  email: enrichmentFieldOutputSchema.nullable(),
  tax_id: enrichmentFieldOutputSchema.nullable(),
  bankruptcy_status: enrichmentFieldOutputSchema.nullable(),
  litigation_history: enrichmentFieldOutputSchema.nullable(),
  property_ownership: enrichmentFieldOutputSchema.nullable(),
  business_affiliations: enrichmentFieldOutputSchema.nullable(),
  relatives_associates: enrichmentFieldOutputSchema.nullable(),
  date_of_birth: enrichmentFieldOutputSchema.nullable(),
})

export type EnrichmentTraceStep = z.infer<typeof enrichmentTraceStepSchema>
export type EnrichmentFieldOutput = z.infer<typeof enrichmentFieldOutputSchema>
export type DebtorEnrichmentOutput = z.infer<typeof debtorEnrichmentOutputSchema>

export type DebtorEnrichmentPayload = {
  debtorId: string
}
