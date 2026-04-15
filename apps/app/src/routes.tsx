import { Route, Routes } from "react-router"

import { AnimatedOutlet } from "@/components/animated-outlet"
import { AppLayout } from "@/components/app-layout"
import DashboardPage from "@/pages/dashboard"
import DebtorProfilePage from "@/pages/debtor-profile"
import DebtorsPage from "@/pages/debtors"
import SettingsPage from "@/pages/settings"
import UploadPage from "@/pages/upload"
import RootLayout from "@/routes/(authorized)/layout"
import AuthorizedLayout from "@/routes/(authorized)/layout"
import UnauthorizedLayout from "@/routes/(unauthorized)/layout"
import SignInPage from "@/routes/(unauthorized)/signin/page"
import SignUpPage from "@/routes/(unauthorized)/signup/page"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route element={<AuthorizedLayout />}>
          <Route element={<AppLayout />}>
            <Route element={<AnimatedOutlet />}>
              <Route index element={<DashboardPage />} />
              <Route path="upload" element={<UploadPage />} />
              <Route path="debtors" element={<DebtorsPage />} />
              <Route path="debtors/:caseId" element={<DebtorProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<UnauthorizedLayout />}>
          <Route path="signin" element={<SignInPage />} />
          <Route path="signup" element={<SignUpPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
