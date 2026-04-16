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

/** Maps to `enriched_fields.field_name` check constraint — all keys optional in LLM output. */
export const debtorEnrichmentOutputSchema = z.object({
  phone: enrichmentFieldOutputSchema.optional(),
  address: enrichmentFieldOutputSchema.optional(),
  employer: enrichmentFieldOutputSchema.optional(),
  assets: enrichmentFieldOutputSchema.optional(),
  social_media_hints: enrichmentFieldOutputSchema.optional(),
  income_bracket: enrichmentFieldOutputSchema.optional(),
  email: enrichmentFieldOutputSchema.optional(),
  tax_id: enrichmentFieldOutputSchema.optional(),
})

export type EnrichmentTraceStep = z.infer<typeof enrichmentTraceStepSchema>
export type EnrichmentFieldOutput = z.infer<typeof enrichmentFieldOutputSchema>
export type DebtorEnrichmentOutput = z.infer<typeof debtorEnrichmentOutputSchema>

export type DebtorEnrichmentPayload = {
  debtorId: string
}
