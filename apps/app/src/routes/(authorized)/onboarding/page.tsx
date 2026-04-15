import * as React from "react"
import { Navigate, useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { CsvImportPanel } from "@/components/csv-import-panel"
import { useOrg } from "@/context/org-context"
import { hasValidSession, useAuthSession } from "@/hooks/use-auth"
import { useAddMember, useCreateOrg } from "@/hooks/use-orgs-queries"
import { queryKeys } from "@/lib/query-keys"

function slugify(name: string) {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return s || "workspace"
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: session } = useAuthSession()
  const { orgId, orgs, isLoading: orgsLoading, setOrgId } = useOrg()
  const createOrg = useCreateOrg()
  const addMember = useAddMember()

  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [orgName, setOrgName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [slugTouched, setSlugTouched] = React.useState(false)

  const busy = createOrg.isPending || addMember.isPending

  React.useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(orgName))
    }
  }, [orgName, slugTouched])

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!hasValidSession(session)) {
      toast.error("Session missing. Please sign in again.")
      return
    }
    const name = orgName.trim()
    const finalSlug = slug.trim().toLowerCase()
    if (!name || !finalSlug) {
      toast.error("Name and workspace URL are required.")
      return
    }
    try {
      const org = await createOrg.mutateAsync({ name, slug: finalSlug })
      await addMember.mutateAsync({
        orgId: org.id,
        userId: session.user.id,
        role: "admin",
      })
      await qc.refetchQueries({ queryKey: queryKeys.orgs.mine() })
      setOrgId(org.id)
      setStep(3)
      toast.success("Workspace ready.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create workspace.")
    }
  }

  if (orgsLoading) {
    return (
      <div className="min-h-svh bg-background px-4 py-8 md:px-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (orgs.length > 0 && step < 3) {
    return <Navigate to="/" replace />
  }

  const displayName = session?.user?.name ?? "there"
  const displayEmail = session?.user?.email ?? ""

  return (
    <div className="min-h-svh bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-2xl space-y-10">
        <ol className="flex gap-2 text-xs text-muted-foreground">
          <li className={cn(step >= 1 && "font-medium text-foreground")}>
            1. Welcome
          </li>
          <li aria-hidden>·</li>
          <li className={cn(step >= 2 && "font-medium text-foreground")}>
            2. Workspace
          </li>
          <li aria-hidden>·</li>
          <li className={cn(step >= 3 && "font-medium text-foreground")}>
            3. Import
          </li>
        </ol>

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome, {displayName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {displayEmail ? (
                  <>
                    Signed in as{" "}
                    <span className="text-foreground">{displayEmail}</span>. We
                    will set up your workspace and optionally import your first
                    portfolio CSV.
                  </>
                ) : (
                  "Set up your workspace and optionally import your first portfolio CSV."
                )}
              </p>
            </div>
            <Button type="button" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <form className="space-y-6" onSubmit={handleCreateWorkspace}>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Create your workspace
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                A workspace holds your team and portfolio. You can invite others
                later from settings.
              </p>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Workspace name</span>
              <input
                className="rounded-md border bg-background px-3 py-2"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Collections"
                required
                autoComplete="organization"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">URL slug</span>
              <input
                className="rounded-md border bg-background px-3 py-2 font-mono text-sm"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                placeholder="acme-collections"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title="Lowercase letters, numbers, and hyphens only."
              />
              <span className="text-xs text-muted-foreground">
                Used in URLs. Must be unique.
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create workspace"}
              </Button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Import your portfolio
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a CSV with headers. We will ask you to map columns to
                full name, phone, address, email, and tax id. You can finish
                later from Upload.
              </p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/")}
                >
                  Skip for now
                </Button>
              </div>
            </div>

            <CsvImportPanel
              orgId={orgId}
              onImported={() => navigate("/debtors")}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
