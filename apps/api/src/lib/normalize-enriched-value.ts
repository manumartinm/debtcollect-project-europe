/**
 * Ensures enriched field `value` stored and returned to clients is plain text,
 * never a JSON blob or stringified object/array from the model.
 */
function stripCodeFences(s: string): string {
  const t = s.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t)
  if (fenced?.[1]) return fenced[1].trim()
  return t
}

function formatRecordAsPlainText(obj: Record<string, unknown>, depth = 0): string {
  const indent = depth > 0 ? "  ".repeat(depth) : ""
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      lines.push(`${indent}${k}:`)
      lines.push(formatRecordAsPlainText(v as Record<string, unknown>, depth + 1))
    } else if (Array.isArray(v)) {
      lines.push(`${indent}${k}: ${v.map((x) => String(x)).join(", ")}`)
    } else {
      lines.push(`${indent}${k}: ${String(v)}`)
    }
  }
  return lines.join("\n").trim()
}

function jsonValueToPlainText(parsed: unknown): string {
  if (parsed == null) return ""
  if (typeof parsed === "string") return parsed.trim()
  if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed)
  if (Array.isArray(parsed)) {
    const parts = parsed.map((x) => jsonValueToPlainText(x)).filter(Boolean)
    return parts.join("\n\n")
  }
  if (typeof parsed === "object") {
    const o = parsed as Record<string, unknown>
    if (typeof o.value === "string" && o.value.trim()) {
      if (Object.keys(o).length === 1 || (Object.keys(o).length <= 3 && "explainability" in o)) {
        return o.value.trim()
      }
    }
    return formatRecordAsPlainText(o)
  }
  return String(parsed)
}

/** Converts structured pipeline or parsed JSON values to a single plain-text block (no `{…}` JSON syntax). */
export function valueUnknownToPlainText(parsed: unknown): string {
  return jsonValueToPlainText(parsed).trim()
}

/**
 * Coerces model/DB input to a single human-readable string (no JSON syntax).
 */
export function normalizeEnrichedFieldValueText(raw: unknown): string {
  if (raw == null) return ""
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw)
  if (typeof raw === "object") {
    return jsonValueToPlainText(raw).trim()
  }
  let s = stripCodeFences(String(raw))
  s = s.trim()
  if (!s) return ""

  for (let depth = 0; depth < 4; depth++) {
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try {
        const parsed = JSON.parse(s) as unknown
        s = jsonValueToPlainText(parsed).trim()
        continue
      } catch {
        return s
      }
    }
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        const parsed = JSON.parse(s) as unknown
        if (typeof parsed === "string") {
          s = parsed.trim()
          continue
        }
        s = jsonValueToPlainText(parsed).trim()
        continue
      } catch {
        return s
      }
    }
    break
  }
  return s
}
