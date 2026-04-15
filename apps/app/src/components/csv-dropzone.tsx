import * as React from "react"
import { Upload } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function CsvDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void
  disabled?: boolean
}) {
  const [drag, setDrag] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      onFile(f)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        "flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-12 text-center transition-colors",
        drag && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <Upload className="size-10 text-muted-foreground" strokeWidth={1.25} />
      <div>
        <p className="font-medium text-foreground">Drop a CSV here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse — case id, country, debt, outcomes
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
