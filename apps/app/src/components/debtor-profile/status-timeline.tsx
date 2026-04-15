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

import type { CaseStatus, Debtor } from "@/data/mock"
import { CASE_STATUS_LABELS } from "@/data/mock"

export function StatusTimeline({
  debtor,
  onStatusChange,
}: {
  debtor: Debtor
  onStatusChange: (status: CaseStatus, note: string) => void
}) {
  const [status, setStatus] = React.useState<CaseStatus>(debtor.caseStatus)
  const [note, setNote] = React.useState("")

  React.useEffect(() => {
    setStatus(debtor.caseStatus)
  }, [debtor.caseStatus])

  const ordered = [...debtor.statusHistory].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  )

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Case timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as CaseStatus)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {CASE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label className="text-xs">Note</Label>
            <Textarea
              placeholder="Optional note for this update…"
              className="min-h-[80px] resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex sm:pb-0.5">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                onStatusChange(status, note)
                setNote("")
              }}
            >
              Save
            </Button>
          </div>
        </div>

        <ul className="space-y-3 border-t border-border pt-4">
          {ordered.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <div className="mt-0.5 size-2 shrink-0 rounded-full bg-primary/40" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {CASE_STATUS_LABELS[e.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">· {e.author}</span>
                </div>
                {e.note ? (
                  <p className="mt-1 text-muted-foreground">{e.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
