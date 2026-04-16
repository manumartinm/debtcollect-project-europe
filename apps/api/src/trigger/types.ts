import { z } from "zod"

export type AiSource = { name: string; url: string; type: string }

export const explainabilityClaimSchema = z.object({
  claim_content: z.string().min(1),
  linked_citations: z.array(z.string().min(1)).min(1),
  confidence: z.enum(["High", "Medium", "Low"]),
})

export const enrichmentFieldOutputSchema = z.object({
  value: z.string().min(1),
  explainability: z.array(explainabilityClaimSchema).min(1),
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
export type ExplainabilityClaim = z.infer<typeof explainabilityClaimSchema>
export type EnrichmentFieldOutput = z.infer<typeof enrichmentFieldOutputSchema>
export type DebtorEnrichmentOutput = z.infer<typeof debtorEnrichmentOutputSchema>

export type DebtorEnrichmentPayload = {
  debtorId: string
}
