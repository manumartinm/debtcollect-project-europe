import * as React from "react"
import type { AiTraceStep } from "@/data/mock"

const STEP_GAP_MS = 1600

/**
 * Plays back trace template steps with delays. Caller handles persistence on onDone.
 */
export function useEnrichmentRun() {
  const [running, setRunning] = React.useState(false)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = React.useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  React.useEffect(() => () => clearTimers(), [clearTimers])

  const run = React.useCallback(
    (
      template: AiTraceStep[],
      onStep: (partial: AiTraceStep[], stepIndex: number) => void,
      onDone: () => void
    ) => {
      clearTimers()
      setRunning(true)
      let i = 0

      const tick = () => {
        if (i >= template.length) {
          setRunning(false)
          onDone()
          return
        }
        i += 1
        onStep(template.slice(0, i), i - 1)
        const t = setTimeout(tick, STEP_GAP_MS)
        timers.current.push(t)
      }

      const t0 = setTimeout(tick, 500)
      timers.current.push(t0)
    },
    [clearTimers]
  )

  return { run, running }
}
