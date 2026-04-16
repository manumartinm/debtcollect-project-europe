/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { VEXOR_THEME_STORAGE_KEY } from "@/lib/client-storage"

type ThemeProviderProps = {
  children: React.ReactNode
}

/**
 * Vexor is light-theme only. Applies `light` on <html> and ignores any stored dark/system preference.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark")
    root.classList.add("light")
    try {
      localStorage.removeItem(VEXOR_THEME_STORAGE_KEY)
    } catch {
      /* private mode */
    }
  }, [])

  return <>{children}</>
}
