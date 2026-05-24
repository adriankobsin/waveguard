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
import HelpPage from './pages/HelpPage';
import AutomationPage from './pages/AutomationPage';
import DocumentsPage from './pages/DocumentsPage';
import AssistantPage from './pages/AssistantPage';
import CablesPage from './pages/CablesPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import LightingPage from './pages/LightingPage';
import ScenesPage from './pages/ScenesPage';
import NetworkDiscoveryPage from './pages/NetworkDiscoveryPage';

// Layout
import AppLayout from './components/AppLayout';
import { BrandingProvider } from './contexts/BrandingContext';
import { SiteLocationsProvider } from './contexts/SiteLocationsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PlatformModeProvider } from './contexts/PlatformModeContext';
import { AuthProvider } from './lib/AuthContext';
import { Toaster } from 'sonner';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <ThemeProvider>
      <PlatformModeProvider>
      <AuthProvider>
      <SiteLocationsProvider>
      <BrandingProvider>
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
            <Route path="/help" element={<HelpPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/cables" element={<CablesPage />} />
            <Route path="/equipment" element={<InventoryPage />} />
            <Route path="/inventory" element={<Navigate to="/equipment" replace />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/lighting" element={<LightingPage />} />
            <Route path="/scenes" element={<ScenesPage />} />
            <Route path="/discovery" element={<NetworkDiscoveryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster position="top-right" richColors closeButton />
      </BrandingProvider>
      </SiteLocationsProvider>
      </AuthProvider>
      </PlatformModeProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;