import { StrictMode } from "react"
import { BrowserRouter } from "react-router"
import { createRoot } from "react-dom/client"
import { AppRoutes } from "@/routes"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
