import { Link, useNavigate } from "react-router"

import { CsvImportPanel } from "@/components/csv-import-panel"
import { useOrg } from "@/context/org-context"

export default function UploadPage() {
  const navigate = useNavigate()
  const { orgId, isLoading: orgLoading } = useOrg()

  if (orgLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading organization…</p>
    )
  }

  if (!orgId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Upload portfolio</h1>
        <p className="text-sm text-muted-foreground">
          You need a workspace before importing.{" "}
          <Link className="font-medium text-foreground underline" to="/onboarding">
            Complete onboarding
          </Link>{" "}
          to create one.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload portfolio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV with a header row. After upload, map your columns to our fields
          (full name, phone, address, email, tax id, optional debt & country).
        </p>
      </div>

      <CsvImportPanel orgId={orgId} onImported={() => navigate("/debtors")} />
    </div>
  )
}
