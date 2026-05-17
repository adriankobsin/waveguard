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