import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';

// Pages
import Dashboard from './pages/Dashboard';
import MobileDashboard from './pages/MobileDashboard';
import FirstBootWizard from './pages/FirstBootWizard';
import DiagnosesPage from './pages/DiagnosesPage';
import MaintenancePage from './pages/MaintenancePage';
import SnmpPage from './pages/SnmpPage';
import SettingsPage from './pages/SettingsPage';
import TopologyPage from './pages/TopologyPage';
import EquipmentDetailPage from './pages/EquipmentDetailPage';
import CommitVelocityPage from './pages/CommitVelocityPage';
import AutomationPage from './pages/AutomationPage';
import DocumentsPage from './pages/DocumentsPage';
import AssistantPage from './pages/AssistantPage';
import CablesPage from './pages/CablesPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';

// Layout
import AppLayout from './components/AppLayout';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          {/* Setup wizard — standalone, no layout */}
          <Route path="/setup" element={<FirstBootWizard />} />

          {/* Mobile dashboard — standalone, no sidebar */}
          <Route path="/mobile" element={<MobileDashboard />} />

          {/* Main app with sidebar layout */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/snmp" element={<SnmpPage />} />
            <Route path="/diagnoses" element={<DiagnosesPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/topology" element={<TopologyPage />} />
            <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
            <Route path="/commit-velocity" element={<CommitVelocityPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/cables" element={<CablesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;