import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Loading } from './components/States'
import OverviewPage from './pages/OverviewPage'
import InspectionPage from './pages/inspection/InspectionPage'
import ObservationDetailPage from './pages/inspection/ObservationDetailPage'
import MachineDetailPage from './pages/monitoring/MachineDetailPage'
import MonitoringPage from './pages/monitoring/MonitoringPage'
import PlaceholderPage from './pages/PlaceholderPage'

// three.js is large: load the twin only when visited.
const TwinPage = lazy(() => import('./twin/TwinPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="twin" element={<Suspense fallback={<Loading label="Loading 3D twin…" />}><TwinPage /></Suspense>} />
        <Route path="inspection" element={<InspectionPage />} />
        <Route path="inspection/:id" element={<ObservationDetailPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="monitoring/:id" element={<MachineDetailPage />} />
        <Route path="tile-quality" element={<PlaceholderPage title="Tile Quality Inspection" milestone={9} />} />
        <Route path="predictive" element={<PlaceholderPage title="Predictive Maintenance" milestone={6} />} />
        <Route path="assistant" element={<PlaceholderPage title="AI Assistant" milestone={8} />} />
        <Route path="knowledge" element={<PlaceholderPage title="Knowledge Centre" milestone={10} />} />
        <Route path="reports" element={<PlaceholderPage title="Reports" milestone={7} />} />
        <Route path="admin" element={<PlaceholderPage title="Administration" milestone={11} />} />
        <Route path="*" element={<PlaceholderPage title="Page not found" />} />
      </Route>
    </Routes>
  )
}
