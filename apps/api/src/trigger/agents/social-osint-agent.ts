import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"

import { APIFY_ACTORS, runActor } from "../lib/apify.js"
import { basePayloadLabel, buildProvenance, newTraceStep } from "../lib/agent-helpers.js"
import { safeGenerateObject } from "../lib/llm-extract.js"
import type { AgentResult, DebtorAgentPayload, EnrichedFieldKey } from "../types.js"

const profileSchema = z.object({
  reasoning: z.string(),
  employer: z.string().nullable(),
  jobTitle: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  socialMediaProfiles: z.array(z.string()),
  socialMediaHints: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sources: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })),
})

export const socialOsintAgent = task({
  id: "social-osint-agent",
  maxDuration: 300,
  run: async (payload: DebtorAgentPayload): Promise<AgentResult> => {
    const start = Date.now()
    const stepNumber = payload.stepIndex ?? 1

    const serpLinkedIn = await runActor<Record<string, unknown>>(APIFY_ACTORS.googleSearch, {
      queries: [`"${payload.name}" site:linkedin.com/in ${payload.state}`],
      maxPagesPerQuery: 1,
      resultsPerPage: 5,
    })

    let linkedInUrl =
      (payload.overrides?.linkedinUrl as string | undefined) ??
      extractFirstLinkedInUrl(serpLinkedIn.items)

    let liItems: Record<string, unknown>[] = []
    let liRun = serpLinkedIn

    if (linkedInUrl) {
      const li = await runActor<Record<string, unknown>>(APIFY_ACTORS.linkedIn, {
        profileUrls: [linkedInUrl],
      })
      liItems = li.items
      liRun = li
    }

    const fb = await runActor<Record<string, unknown>>(APIFY_ACTORS.facebookPeople, {
      name: payload.name,
      city: payload.city ?? payload.state,
      maxResults: 10,
    })

    const bundle = {
      googleSearch: serpLinkedIn.items,
      linkedInProfile: liItems,
      facebookSearch: fb.items,
    }

    const llm = await safeGenerateObject({
      system:
        "You summarize public LinkedIn/Facebook search outputs for compliant collections use. Neutral, non-accusatory tone.",
      prompt: `Debtor: ${basePayloadLabel(payload)}.\n\nBundled social data:\n${JSON.stringify(bundle).slice(0, 14000)}`,
      schema: profileSchema,
    })

    const reasoning =
      llm?.reasoning ??
      "Social/OSINT data limited or LLM unavailable; verify manually before use."

    const trace = newTraceStep({
      stepNumber,
      agentName: "Social/OSINT Agent",
      action: "scraped",
      reasoning,
      sources: llm?.sources ?? [
        { name: "Apify social runs", url: liRun.runUrl, type: "social" },
      ],
      finding: llm?.employer ?? socialHintFromLlM(llm),
      confidence: llm?.confidence ?? "low",
      durationMs: Date.now() - start,
    })

    const extractedFields: AgentResult["extractedFields"] = {
      employer: llm?.employer ?? null,
      jobTitle: llm?.jobTitle ?? null,
      linkedinUrl: llm?.linkedinUrl ?? linkedInUrl ?? null,
      socialMediaProfiles: llm?.socialMediaProfiles ?? [],
      socialMediaHints: llm?.socialMediaHints ?? null,
    }

    const provenance: AgentResult["provenance"] = []
    const keys: EnrichedFieldKey[] = [
      "employer",
      "jobTitle",
      "linkedinUrl",
      "socialMediaProfiles",
      "socialMediaHints",
    ]
    for (const key of keys) {
      provenance.push(
        buildProvenance({
          fieldKey: key,
          value: extractedFields[key],
          agentName: trace.agentName,
          traceStepId: trace.id,
          stepNumber,
          apifyActorId: `${APIFY_ACTORS.googleSearch}+${APIFY_ACTORS.linkedIn}+${APIFY_ACTORS.facebookPeople}`,
          apifyRunUrl: liRun.runUrl,
          rawDataSnapshot: bundle,
          aiModel: process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4o-mini",
          aiPromptSummary: "Extract employment + social URLs from Apify actors",
          aiReasoning: reasoning.slice(0, 2000),
          confidence: trace.confidence,
          sources: trace.sources,
          durationMs: trace.durationMs,
        })
      )
    }

    logger.log("social-osint-agent done", { caseRef: payload.caseRef })
    return { trace, extractedFields, provenance }
  },
})

function extractFirstLinkedInUrl(items: Record<string, unknown>[]): string | null {
  for (const item of items) {
    const url =
      (item.url as string | undefined) ||
      (item.link as string | undefined) ||
      (item.href as string | undefined)
    if (url && url.includes("linkedin.com/in/")) {
      return url.split("?")[0] ?? url
    }
  }
  return null
}

function socialHintFromLlM(
  llm: z.infer<typeof profileSchema> | null
): string | null {
  if (!llm) return null
  return [llm.jobTitle, llm.employer].filter(Boolean).join(" @ ") || null
}
