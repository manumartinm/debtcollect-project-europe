/** Canonical targets we map CSV columns onto (user-facing names). */
export const CSV_TARGET_FIELDS = [
  "full_name",
  "phone_number",
  "address",
  "email",
  "tax_id",
  "debt_amount",
  "country",
] as const

export type CsvTargetField = (typeof CSV_TARGET_FIELDS)[number]

/** Which CSV header (exact string from file) maps to each target; omit = not mapped. */
export type CsvColumnMapping = Partial<Record<CsvTargetField, string>>

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

/** Auto-match CSV headers to targets when names align (e.g. `full_name`, `Full Name`). */
export function guessColumnMapping(headers: string[]): CsvColumnMapping {
  const m: CsvColumnMapping = {}
  const targets = CSV_TARGET_FIELDS
  for (const t of targets) {
    const hit = headers.find((h) => norm(h) === norm(t))
    if (hit) m[t] = hit
  }
  return m
}

function getCell(
  row: Record<string, string>,
  csvHeader: string | undefined,
): string {
  if (!csvHeader) return ""
  const v = row[csvHeader]
  return typeof v === "string" ? v.trim() : ""
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

function sanitizeCaseRef(raw: string, index: number): string {
  const base = raw.trim() || `IMPORT-${index + 1}`
  const safe = base.replace(/[^\w.\-@+]/g, "-").replace(/-+/g, "-")
  return safe.slice(0, 200) || `IMPORT-${index + 1}`
}

/** Row shape for POST /api/debtors/bulk */
export type CsvBulkRow = {
  caseRef: string
  debtorName: string
  country: string
  debtAmount: number
  callOutcome: string
  legalOutcome: string
  enriched?: Partial<Record<"phone" | "address" | "email" | "tax_id", string>>
}

/**
 * Build one bulk row using the user-selected column mapping.
 * Requires `full_name` mapped and non-empty. Case ref = tax_id, else email, else IMPORT-n.
 */
export function rowToBulkRow(
  row: Record<string, string>,
  index: number,
  mapping: CsvColumnMapping,
): CsvBulkRow | null {
  const debtorName = getCell(row, mapping.full_name)
  if (!debtorName) return null

  const taxId = getCell(row, mapping.tax_id)
  const email = getCell(row, mapping.email)
  const phone = getCell(row, mapping.phone_number)
  const address = getCell(row, mapping.address)
  const debtRaw = mapping.debt_amount ? getCell(row, mapping.debt_amount) : ""
  const countryRaw = mapping.country ? getCell(row, mapping.country) : ""

  const debtAmount = parseDebtAmount(debtRaw) ?? 0
  const country =
    countryRaw.length >= 2
      ? countryRaw.slice(0, 2).toUpperCase()
      : "ES"

  const caseRefSource = taxId || email || `IMPORT-${index + 1}`
  const caseRef = sanitizeCaseRef(caseRefSource, index)

  const enriched: CsvBulkRow["enriched"] = {}
  if (phone) enriched.phone = phone
  if (address) enriched.address = address
  if (email) enriched.email = email
  if (taxId) enriched.tax_id = taxId

  return {
    caseRef,
    debtorName,
    country,
    debtAmount,
    callOutcome: "unknown",
    legalOutcome: "unknown",
    ...(Object.keys(enriched).length > 0 ? { enriched } : {}),
  }
}

export function mappingIsValid(m: CsvColumnMapping): boolean {
  return typeof m.full_name === "string" && m.full_name.length > 0
}
