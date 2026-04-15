import { Route, Routes } from "react-router"

import { AnimatedOutlet } from "@/components/animated-outlet"
import { AppLayout } from "@/components/app-layout"
import DashboardPage from "@/pages/dashboard"
import DebtorProfilePage from "@/pages/debtor-profile"
import DebtorsPage from "@/pages/debtors"
import SettingsPage from "@/pages/settings"
import UploadPage from "@/pages/upload"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route element={<AnimatedOutlet />}>
          <Route index element={<DashboardPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="debtors" element={<DebtorsPage />} />
          <Route path="debtors/:caseId" element={<DebtorProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
