import { Route, Routes } from "react-router"

import RootLayout from "@/routes/layout"
import HomePage from "@/routes/page"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>
  )
}
