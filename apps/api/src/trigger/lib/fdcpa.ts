/** Written-contract SOL years by state (simplified; verify with counsel for production). */
const SOL_WRITTEN: Record<string, number> = {
  AL: 6,
  AK: 6,
  AZ: 6,
  AR: 5,
  CA: 4,
  CO: 6,
  CT: 6,
  DE: 3,
  FL: 5,
  GA: 6,
  HI: 6,
  ID: 5,
  IL: 10,
  IN: 6,
  IA: 10,
  KS: 5,
  KY: 15,
  LA: 10,
  ME: 6,
  MD: 3,
  MA: 6,
  MI: 6,
  MN: 6,
  MS: 3,
  MO: 10,
  MT: 8,
  NE: 5,
  NV: 6,
  NH: 3,
  NJ: 6,
  NM: 6,
  NY: 6,
  NC: 3,
  ND: 6,
  OH: 8,
  OK: 5,
  OR: 6,
  PA: 4,
  RI: 10,
  SC: 3,
  SD: 6,
  TN: 6,
  TX: 4,
  UT: 6,
  VT: 6,
  VA: 5,
  WA: 6,
  WV: 10,
  WI: 6,
  WY: 10,
  DC: 3,
}

export function statuteOfLimitationsYears(state: string): number | null {
  const s = state.trim().toUpperCase()
  return SOL_WRITTEN[s] ?? null
}

export function computeSolExpirationIso(
  dateOfDelinquencyIso: string | undefined,
  state: string
): { years: number | null; expirationIso: string | null; timeBarred: boolean } {
  const years = statuteOfLimitationsYears(state)
  if (!years || !dateOfDelinquencyIso) {
    return { years, expirationIso: null, timeBarred: false }
  }
  const start = new Date(dateOfDelinquencyIso)
  if (Number.isNaN(start.getTime())) {
    return { years, expirationIso: null, timeBarred: false }
  }
  const exp = new Date(start)
  exp.setFullYear(exp.getFullYear() + years)
  const now = new Date()
  return {
    years,
    expirationIso: exp.toISOString(),
    timeBarred: now > exp,
  }
}
