import { z } from "zod"

export const agentIdSchema = z.enum([
  "skip-trace",
  "court-records",
  "bankruptcy",
  "business-entity",
  "property",
  "social-osint",
  "serp-deep",
])

export type PlanAgentId = z.infer<typeof agentIdSchema>

export const executionPlanSchema = z.object({
  reasoning: z.string(),
  wave1: z.array(agentIdSchema).describe("Critical path — usually skip-trace, bankruptcy, serp-deep"),
  wave2: z.array(agentIdSchema).describe("Enriched wave after Wave 1 results exist"),
  skipAgents: z.array(
    z.object({
      agentId: agentIdSchema,
      reason: z.string(),
    })
  ),
})

export type ExecutionPlan = z.infer<typeof executionPlanSchema>

export const replanSchema = z.object({
  reasoning: z.string(),
  addToWave2: z.array(agentIdSchema),
  removeFromWave2: z.array(agentIdSchema),
  abortRemaining: z.boolean(),
  abortReason: z.string().nullable(),
  propertyCounty: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
})

export type ReplanResult = z.infer<typeof replanSchema>
