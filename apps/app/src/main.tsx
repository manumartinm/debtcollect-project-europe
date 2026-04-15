import { StrictMode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router"
import { createRoot } from "react-dom/client"
import { AppRoutes } from "@/routes"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
