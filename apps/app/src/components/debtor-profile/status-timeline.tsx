import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { ApiDebtor } from "@/lib/api"
import type { CaseStatus } from "@/types/debtor"
import { CASE_STATUS_LABELS, caseStatusLabel } from "@/types/debtor"

export function StatusTimeline({
  debtor,
  onStatusChange,
}: {
  debtor: ApiDebtor
  onStatusChange: (status: CaseStatus, note: string) => void
}) {
  const [status, setStatus] = React.useState<CaseStatus>(
    debtor.caseStatus as CaseStatus
  )
  const [note, setNote] = React.useState("")

  React.useEffect(() => {
    setStatus(debtor.caseStatus as CaseStatus)
  }, [debtor.caseStatus])

  const ordered = [...debtor.statusEvents].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt)
  )

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-sm font-semibold">Case timeline</CardTitle>
        <p className="text-[12px] leading-snug text-muted-foreground">
          Log status changes and optional notes. History is newest first.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add an update
          </h3>
          <div className="mt-4 flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="case-status-select" className="text-[13px] font-medium">
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CaseStatus)}
              >
                <SelectTrigger
                  id="case-status-select"
                  className="h-11 w-full max-w-full bg-background text-[15px] sm:max-w-md"
                >
                  <SelectValue>
                    {(v) =>
                      v == null || v === ""
                        ? null
                        : caseStatusLabel(String(v))
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[min(60vh,320px)]">
                  {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
                    <SelectItem key={s} value={s} className="text-[15px]">
                      {CASE_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-status-note" className="text-[13px] font-medium">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="case-status-note"
                placeholder="What happened on the call, next step, or context for the team…"
                className={cn(
                  "min-h-[100px] w-full resize-y bg-background text-[15px] leading-relaxed",
                  "placeholder:text-muted-foreground/70"
                )}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full sm:w-auto sm:min-w-28"
                disabled={!note.trim() && status === debtor.caseStatus}
                onClick={() => {
                  setNote("")
                  setStatus(debtor.caseStatus as CaseStatus)
                }}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="h-11 w-full sm:w-auto sm:min-w-32"
                onClick={() => {
                  onStatusChange(status, note)
                  setNote("")
                }}
              >
                Save update
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h3>
          <ul className="mt-3 space-y-3">
            {ordered.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-border/80 bg-card px-3 py-3 sm:px-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <Badge
                      variant="outline"
                      className="font-normal text-[12px] leading-none"
                    >
                      {caseStatusLabel(e.status)}
                    </Badge>
                    {e.note ? (
                      <p className="mt-2.5 wrap-break-word text-[14px] leading-relaxed text-foreground">
                        {e.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-[11px] leading-tight text-muted-foreground sm:text-right">
                    <time dateTime={e.occurredAt} className="block sm:whitespace-nowrap">
                      {new Date(e.occurredAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    <span className="mt-0.5 block text-[11px]">{e.author}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
