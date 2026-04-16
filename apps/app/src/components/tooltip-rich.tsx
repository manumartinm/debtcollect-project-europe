import * as React from "react"

import { TooltipContent } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

type TooltipRichProps = React.ComponentProps<typeof TooltipContent> & {
  title: string
  children: React.ReactNode
}

/** Tooltip with a clear heading and lighter supporting text (for dark tooltip surface). */
export function TooltipRich({
  title,
  children,
  className,
  ...props
}: TooltipRichProps) {
  return (
    <TooltipContent
      className={cn(
        "flex max-w-[280px] flex-col items-start gap-1.5 px-3 py-2.5 text-left",
        className
      )}
      {...props}
    >
      <p className="text-sm font-semibold leading-tight text-background">{title}</p>
      <div className="text-[11px] font-normal leading-snug text-background/65">
        {children}
      </div>
    </TooltipContent>
  )
}
