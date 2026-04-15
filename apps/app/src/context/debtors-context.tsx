/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import {
  type Debtor,
  type StatusEvent,
  type CaseStatus,
  INITIAL_DEBTORS,
  computeLeverageFromTraces,
  type EnrichmentStatus,
} from "@/data/mock"

type DebtorsContextValue = {
  debtors: Debtor[]
  setDebtors: React.Dispatch<React.SetStateAction<Debtor[]>>
  upsertDebtor: (d: Debtor) => void
  updateDebtor: (debtorId: string, patch: Partial<Debtor>) => void
  appendDebtorsFromImport: (rows: Debtor[]) => void
  addStatusEvent: (debtorId: string, event: StatusEvent) => void
  setCaseStatus: (debtorId: string, status: CaseStatus, note?: string) => void
  runEnrichmentState: (
    debtorId: string,
    patch: Partial<Debtor> & {
      enrichmentStatus?: EnrichmentStatus
      traces?: Debtor["traces"]
    }
  ) => void
}

const DebtorsContext = React.createContext<DebtorsContextValue | null>(null)

export function DebtorsProvider({ children }: { children: React.ReactNode }) {
  const [debtors, setDebtors] = React.useState<Debtor[]>(() => [...INITIAL_DEBTORS])

  const upsertDebtor = React.useCallback((d: Debtor) => {
    setDebtors((prev) => {
      const i = prev.findIndex((x) => x.debtorId === d.debtorId)
      if (i === -1) return [...prev, d]
      const next = [...prev]
      next[i] = d
      return next
    })
  }, [])

  const updateDebtor = React.useCallback((debtorId: string, patch: Partial<Debtor>) => {
    setDebtors((prev) =>
      prev.map((d) => (d.debtorId === debtorId ? { ...d, ...patch } : d))
    )
  }, [])

  const appendDebtorsFromImport = React.useCallback((rows: Debtor[]) => {
    setDebtors((prev) => {
      const seen = new Set(prev.map((d) => d.caseRef))
      const merged = [...prev]
      for (const r of rows) {
        if (!seen.has(r.caseRef)) {
          seen.add(r.caseRef)
          merged.push(r)
        } else {
          const i = merged.findIndex((d) => d.caseRef === r.caseRef)
          if (i !== -1) merged[i] = { ...merged[i], ...r }
        }
      }
      return merged
    })
  }, [])

  const addStatusEvent = React.useCallback((debtorId: string, event: StatusEvent) => {
    setDebtors((prev) =>
      prev.map((d) =>
        d.debtorId === debtorId
          ? { ...d, statusHistory: [event, ...d.statusHistory] }
          : d
      )
    )
  }, [])

  const setCaseStatus = React.useCallback(
    (debtorId: string, status: CaseStatus, note?: string) => {
      const event: StatusEvent = {
        id: `${debtorId}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status,
        note,
        author: "You",
      }
      setDebtors((prev) =>
        prev.map((d) =>
          d.debtorId === debtorId
            ? {
                ...d,
                caseStatus: status,
                statusHistory: [event, ...d.statusHistory],
              }
            : d
        )
      )
    },
    []
  )

  const runEnrichmentState = React.useCallback(
    (
      debtorId: string,
      patch: Partial<Debtor> & {
        enrichmentStatus?: EnrichmentStatus
        traces?: Debtor["traces"]
      }
    ) => {
      setDebtors((prev) =>
        prev.map((d) => {
          if (d.debtorId !== debtorId) return d
          const nextTraces = patch.traces ?? d.traces
          const leverageScore =
            patch.leverageScore ??
            (nextTraces.length
              ? computeLeverageFromTraces(nextTraces)
              : d.leverageScore)
          return {
            ...d,
            ...patch,
            traces: nextTraces,
            leverageScore,
          }
        })
      )
    },
    []
  )

  const value = React.useMemo(
    () => ({
      debtors,
      setDebtors,
      upsertDebtor,
      updateDebtor,
      appendDebtorsFromImport,
      addStatusEvent,
      setCaseStatus,
      runEnrichmentState,
    }),
    [
      debtors,
      upsertDebtor,
      updateDebtor,
      appendDebtorsFromImport,
      addStatusEvent,
      setCaseStatus,
      runEnrichmentState,
    ]
  )

  return (
    <DebtorsContext.Provider value={value}>{children}</DebtorsContext.Provider>
  )
}

export function useDebtors() {
  const ctx = React.useContext(DebtorsContext)
  if (!ctx) throw new Error("useDebtors must be used within DebtorsProvider")
  return ctx
}
