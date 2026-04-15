import { StrictMode } from "react"
import { BrowserRouter } from "react-router"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { AppRoutes } from "@/routes"
import { DebtorsProvider } from "@/context/debtors-context"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { Toaster } from "@workspace/ui/components/sonner"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DebtorsProvider>
          <ThemeProvider defaultTheme="light" storageKey="vexor-theme">
            <TooltipProvider>
              <AppRoutes />
              <Toaster position="top-center" richColors />
            </TooltipProvider>
          </ThemeProvider>
        </DebtorsProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
