import type { CaseStatus, Debtor } from "@/data/mock"
import { buildDefaultTraceTemplate } from "@/data/mock"

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "_")
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const k of keys) {
    const found = Object.keys(row).find((x) => norm(x) === norm(k))
    if (found && row[found]) return row[found].trim()
  }
  return ""
}

/** Parses currency-style amounts: US (1,234.56), EU (1.234,56 or 1234,56), plain digits. */
function parseDebtAmount(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  let s = t.replace(/[^\d,.-]/g, "")
  if (!s || s === "-" || s === "." || s === ",") return null
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".")
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "")
  } else if (lastComma >= 0) {
    s = s.replace(",", ".")
  }
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export function rowToDebtor(
  row: Record<string, string>,
  index: number
): Debtor | null {
  const caseId =
    pick(row, ["case_id", "caseid", "id", "case"]) || `IMPORT-${index}`
  const country = pick(row, ["country", "ctry"]) || "ES"
  const debtRaw = pick(row, [
    "debt_amount",
    "debt",
    "amount",
    "balance",
    "importe",
    "saldo",
    "deuda",
    "principal",
    "outstanding",
    "total",
  ])
  const debtAmount = parseDebtAmount(debtRaw)
  if (debtAmount === null) return null

  const callOutcome = pick(row, ["call_outcome", "call", "phone_outcome"]) || "unknown"
  const legalOutcome =
    pick(row, ["legal_outcome", "legal", "asset_report"]) || "unknown"
  const name =
    pick(row, ["name", "debtor", "full_name"]) || `Debtor ${caseId}`

  const traceTemplate = buildDefaultTraceTemplate(caseId)

  return {
    caseId,
    country: country.slice(0, 2).toUpperCase(),
    debtAmount,
    callOutcome,
    legalOutcome,
    name,
    leverageScore: "none",
    enrichmentStatus: "pending",
    caseStatus: "new" as CaseStatus,
    traces: [],
    traceTemplate,
    statusHistory: [
      {
        id: `${caseId}-import`,
        timestamp: new Date().toISOString(),
        status: "new",
        note: "Imported from CSV.",
        author: "System",
      },
    ],
  }
}
