/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import type { ApiOrganization } from "@/lib/api"
import { VEXOR_ACTIVE_ORG_ID_KEY } from "@/lib/client-storage"
import { useOrgsList } from "@/hooks/use-orgs-queries"

type OrgContextValue = {
  orgId: string | null
  setOrgId: (id: string) => void
  orgs: ApiOrganization[]
  isLoading: boolean
  error: Error | null
}

const OrgContext = React.createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { data: orgs, isLoading, isFetching, error } = useOrgsList()
  const [orgId, setOrgIdState] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Avoid clearing active org while /mine is refetching (e.g. after create org).
    if (isLoading || isFetching) return
    if (!orgs?.length) {
      setOrgIdState(null)
      localStorage.removeItem(VEXOR_ACTIVE_ORG_ID_KEY)
      return
    }
    const stored = localStorage.getItem(VEXOR_ACTIVE_ORG_ID_KEY)
    const valid = stored && orgs.some((o) => o.id === stored)
    if (valid) {
      setOrgIdState(stored)
      return
    }
    const first = orgs[0].id
    localStorage.setItem(VEXOR_ACTIVE_ORG_ID_KEY, first)
    setOrgIdState(first)
  }, [orgs, isLoading, isFetching])

  const setOrgId = React.useCallback((id: string) => {
    localStorage.setItem(VEXOR_ACTIVE_ORG_ID_KEY, id)
    setOrgIdState(id)
  }, [])

  const value = React.useMemo(
    () => ({
      orgId,
      setOrgId,
      orgs: orgs ?? [],
      isLoading,
      error: error ?? null,
    }),
    [orgId, setOrgId, orgs, isLoading, error]
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const ctx = React.useContext(OrgContext)
  if (!ctx) throw new Error("useOrg must be used within OrgProvider")
  return ctx
}
