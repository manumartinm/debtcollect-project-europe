import * as React from "react"

/**
 * Global shortcut helper. Command palette (⌘K) and profile shortcuts
 * are implemented in their respective components.
 */
export function useEscapeBack(onBack: () => void, enabled = true) {
  React.useEffect(() => {
    if (!enabled) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack()
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [enabled, onBack])
}
