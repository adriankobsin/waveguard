import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';

// Pages — each route is loaded on demand so the first load stays small on vessel Wi-Fi.
import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MobileDashboard = lazy(() => import('./pages/MobileDashboard'));
const FirstBootWizard = lazy(() => import('./pages/FirstBootWizard'));
const DiagnosesPage = lazy(() => import('./pages/DiagnosesPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const SnmpPage = lazy(() => import('./pages/SnmpPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TopologyPage = lazy(() => import('./pages/TopologyPage'));
const EquipmentDetailPage = lazy(() => import('./pages/EquipmentDetailPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const CablesPage = lazy(() => import('./pages/CablesPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const LightingPage = lazy(() => import('./pages/LightingPage'));
const ScenesPage = lazy(() => import('./pages/ScenesPage'));
const NetworkDiscoveryPage = lazy(() => import('./pages/NetworkDiscoveryPage'));
const AudioPage = lazy(() => import('./pages/AudioPage'));
const HVACPage = lazy(() => import('./pages/HVACPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const NetworkToolsPage = lazy(() => import('./pages/NetworkToolsPage'));

// Layout
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { BrandingProvider } from './contexts/BrandingContext';
import { SiteLocationsProvider } from './contexts/SiteLocationsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PlatformModeProvider } from './contexts/PlatformModeContext';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'sonner';

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function RedirectToLogin() {
  const next = window.location.pathname + window.location.search;
  return <Navigate to={`/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <ThemeProvider>
      <PlatformModeProvider>
      <AuthProvider>
      <SiteLocationsProvider>
      <BrandingProvider>
      <Router>
        <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Everything else requires a signed-in user */}
          <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
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
            <Route path="/help" element={<Navigate to="/settings?section=help" replace />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/cables" element={<CablesPage />} />
            <Route path="/equipment" element={<InventoryPage />} />
            <Route path="/inventory" element={<Navigate to="/equipment" replace />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/lighting" element={<LightingPage />} />
            <Route path="/scenes" element={<ScenesPage />} />
            <Route path="/cisco-switches" element={<Navigate to="/snmp?tab=cisco" replace />} />
            <Route path="/discovery" element={<NetworkDiscoveryPage />} />
            <Route path="/audio" element={<AudioPage />} />
            <Route path="/hvac" element={<HVACPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/tools" element={<NetworkToolsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
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