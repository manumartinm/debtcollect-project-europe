import type { Debtor } from "@/data/mock"
import { leverageExplanation } from "@/data/mock"

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
export function buildCallInsightBlocks(debtor: Debtor): InsightBlock[] {
  const blocks: InsightBlock[] = []

  blocks.push({
    title: "Account snapshot",
    points: [
      `Outstanding balance ${formatMoney(debtor.debtAmount)} · jurisdiction ${debtor.country}.`,
      `Case ref ${debtor.caseRef} — use when debtor asks for reference.`,
      `Portfolio call outcome (CSV): ${debtor.callOutcome}.`,
      `Legal / asset line (CSV): ${debtor.legalOutcome}.`,
    ],
  })

  blocks.push({
    title: "Leverage & tone",
    points: [
      leverageExplanation(debtor.leverageScore),
      postureLine(debtor.leverageScore),
    ],
  })

  if (debtor.enrichmentStatus === "complete" && debtor.enriched) {
    const e = debtor.enriched
    const signalPoints: string[] = []
    if (e.phone && e.phone !== "Not found") {
      signalPoints.push(`Phone on file (enrichment): ${e.phone} — verify live before quoting.`)
    }
    if (e.employer && e.employer !== "Not found") {
      signalPoints.push(`Employer signal: ${e.employer} — optional angle for schedule/plan discussion if verified.`)
    }
    if (e.address && e.address !== "Unknown" && e.address !== "Not found") {
      signalPoints.push(`Location context: ${e.address}.`)
    }
    if (e.assets && e.assets !== "Not found" && e.assets !== "None in public sweep") {
      signalPoints.push(`Public asset hint: ${e.assets} — use only if consistent with policy.`)
    }
    if (e.socialMediaHints && e.socialMediaHints !== "Not found") {
      signalPoints.push(`Open-web signal: ${e.socialMediaHints} — low weight; never accusatory.`)
    }
    if (e.incomeBracket && e.incomeBracket !== "Unknown") {
      signalPoints.push(`Income bracket (estimate): ${e.incomeBracket}.`)
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
        "Enrichment not run yet — run AI enrichment before leaning on public-signal angles in the call.",
      ],
    })
  }

  blocks.push({
    title: "Key points on the call",
    points: [
      "State who you represent and why you are calling; offer a written summary if requested.",
      "Anchor on balance and options (plan, settlement window) — avoid speculative threats.",
      "If the debtor disputes the debt: log details and follow your dispute workflow.",
      "End with a clear next step (callback time, email, or payment link) and compliance disclaimer as required.",
    ],
  })

  return blocks
}

function postureLine(score: Debtor["leverageScore"]): string {
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
