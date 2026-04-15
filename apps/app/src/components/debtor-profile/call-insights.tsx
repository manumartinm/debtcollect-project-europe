import type { ApiDebtor } from "@/lib/api"
import { buildCallInsightBlocks } from "@/lib/call-insights"

export function CallInsights({ debtor }: { debtor: ApiDebtor }) {
  const blocks = buildCallInsightBlocks(debtor)

  return (
    <div className="space-y-8">
      {blocks.map((block) => (
        <section key={block.title}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {block.title}
          </h3>
          <ul className="mt-3 list-none space-y-2.5 border-l-2 border-primary/25 pl-4">
            {block.points.map((p, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-foreground">
                {p}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
