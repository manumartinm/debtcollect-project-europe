import type { LeverageLevel } from "@/types/debtor"

export function leverageExplanation(score: LeverageLevel): string {
  switch (score) {
    case "high":
      return "High — multiple strong public signals (employment, assets, or social) align for negotiation leverage."
    case "medium":
      return "Medium — some corroborated public signals; worth a prepared call with documented angles."
    case "low":
      return "Low — limited or weak public signals; proceed with caution and verify verbally."
    default:
      return "None — no actionable public information discovered; honesty about gaps is the default."
  }
}
