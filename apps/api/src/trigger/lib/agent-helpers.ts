import { randomUUID } from "node:crypto"

import type {
  AiTraceStep,
  DebtorAgentPayload,
  FieldProvenance,
} from "../types.js"

export function newTraceStep(partial: Omit<AiTraceStep, "id" | "timestamp">): AiTraceStep {
  return {
    ...partial,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  }
}

export function buildProvenance(
  partial: Omit<FieldProvenance, "timestamp" | "alternativeSources"> & {
    alternativeSources?: FieldProvenance["alternativeSources"]
  }
): FieldProvenance {
  return {
    ...partial,
    alternativeSources: partial.alternativeSources ?? [],
    timestamp: new Date().toISOString(),
  }
}

export function basePayloadLabel(p: DebtorAgentPayload): string {
  return `${p.name} (${p.state}${p.city ? `, ${p.city}` : ""})`
}
