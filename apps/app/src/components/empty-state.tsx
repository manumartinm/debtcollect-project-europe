import type { LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-4 py-16 text-center",
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-b from-muted/80 to-muted/40 shadow-[var(--shadow-clay-sm)] ring-1 ring-black/[0.04]">
        <Icon className="size-8 text-muted-foreground/90" strokeWidth={1.15} />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actionLabel && onAction ? (
        <Button type="button" onClick={onAction} className="min-h-11 min-w-44">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
