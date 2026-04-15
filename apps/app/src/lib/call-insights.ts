import type { ApiDebtor } from "@/lib/api"
import {
  enrichedFieldValue,
  flattenTraceSteps,
  parseDebtAmountString,
} from "@/lib/debtor-traces"
import { leverageExplanation } from "@/lib/leverage"
import type { LeverageLevel } from "@/types/debtor"

export type InsightBlock = { title: string; points: string[] }

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Structured talking points for the debt manager on outbound calls — derived from case + enrichment.
 */
export function buildCallInsightBlocks(debtor: ApiDebtor): InsightBlock[] {
  const blocks: InsightBlock[] = []
  const debt = parseDebtAmountString(debtor.debtAmount)
  const lev = debtor.leverageScore as LeverageLevel

  blocks.push({
    title: "Account snapshot",
    points: [
      `Outstanding balance ${formatMoney(debt)} · jurisdiction ${debtor.country}.`,
      `Case ref ${debtor.caseRef} — use when debtor asks for reference.`,
      `Portfolio call outcome (CSV): ${debtor.callOutcome}.`,
      `Legal / asset line (CSV): ${debtor.legalOutcome}.`,
    ],
  })

  blocks.push({
    title: "Leverage & tone",
    points: [leverageExplanation(lev), postureLine(lev)],
  })

  if (debtor.enrichmentStatus === "complete" && debtor.enrichedFields.length > 0) {
    const phone = enrichedFieldValue(debtor, "phone")
    const employer = enrichedFieldValue(debtor, "employer")
    const address = enrichedFieldValue(debtor, "address")
    const assets = enrichedFieldValue(debtor, "assets")
    const social = enrichedFieldValue(debtor, "social_media_hints")
    const income = enrichedFieldValue(debtor, "income_bracket")

    const signalPoints: string[] = []
    if (phone && phone !== "Not found") {
      signalPoints.push(
        `Phone on file (enrichment): ${phone} — verify live before quoting.`
      )
    }
    if (employer && employer !== "Not found") {
      signalPoints.push(
        `Employer signal: ${employer} — optional angle for schedule/plan discussion if verified.`
      )
    }
    if (address && address !== "Unknown" && address !== "Not found") {
      signalPoints.push(`Location context: ${address}.`)
    }
    if (assets && assets !== "Not found" && assets !== "None in public sweep") {
      signalPoints.push(
        `Public asset hint: ${assets} — use only if consistent with policy.`
      )
    }
    if (social && social !== "Not found") {
      signalPoints.push(
        `Open-web signal: ${social} — low weight; never accusatory.`
      )
    }
    if (income && income !== "Unknown") {
      signalPoints.push(`Income bracket (estimate): ${income}.`)
    }
    if (signalPoints.length > 0) {
      blocks.push({
        title: "Signals to use carefully",
        points: signalPoints,
      })
    }
  } else if (debtor.enrichmentStatus === "pending") {
    blocks.push({
      title: "Enrichment",
      points: [
        "Enrichment not completed yet — pipeline may still process this case.",
      ],
    })
  }

  blocks.push({
    title: "Key points on the call",
    points: buildKeyPointsOnCall(debtor),
  })

  return blocks
}

/**
 * Real talking points only: enrichment trace findings, then status notes.
 * No generic placeholder copy.
 */
function buildKeyPointsOnCall(debtor: ApiDebtor): string[] {
  const points: string[] = []
  const seen = new Set<string>()

  const add = (s: string) => {
    const t = s.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    points.push(t)
  }

  const steps = flattenTraceSteps(debtor)
  for (const step of steps) {
    if (step.finding?.trim()) {
      add(step.finding.trim())
    }
  }

  const events = [...(debtor.statusEvents ?? [])].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  )
  for (const ev of events.slice(0, 6)) {
    if (ev.note?.trim()) {
      const date = new Date(ev.occurredAt).toLocaleString()
      add(`[${ev.status}] ${date} — ${ev.note.trim()} (${ev.author})`)
    }
  }

  if (points.length === 0) {
    for (const step of steps) {
      if (step.reasoning?.trim() && step.reasoning.length <= 500) {
        add(`${step.agentName}: ${step.reasoning.trim()}`)
      }
    }
  }

  if (points.length === 0) {
    return [
      "No enrichment findings or collector notes yet. Key points will appear here after agents write findings or you add status notes.",
    ]
  }

  return points.slice(0, 14)
}

function postureLine(score: LeverageLevel): string {
  switch (score) {
    case "high":
      return "Posture: prepared and specific — cite only verified facts; document the conversation."
    case "medium":
      return "Posture: balanced — combine firm repayment expectation with flexibility on method/timing."
    case "low":
      return "Posture: cautious — verify claims live; avoid implying certainty from weak signals."
    default:
      return "Posture: neutral — focus on balance clarity and lawful options; acknowledge information gaps."
  }
}

