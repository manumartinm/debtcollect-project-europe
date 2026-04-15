import * as React from "react"

/** Matches Tailwind `lg` (1024px) */
export function useMinLg() {
  const [matches, setMatches] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
  )

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const fn = () => setMatches(mq.matches)
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])

  return matches
}
