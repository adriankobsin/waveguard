import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Network, Activity, Wrench, Settings,
  Wifi, Menu, X, Search, Bell, Share2, Zap,
  BookOpen, Bot, Cable, Package, FileText, Lightbulb, Radar, HelpCircle,
  Sun, Moon, FlaskConical,
} from "lucide-react";
import { useBranding, DEFAULT_BRANDING } from "@/contexts/BrandingContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePlatformMode } from "@/contexts/PlatformModeContext";
import { SystemDataProvider, useSystemDataOptional } from "@/contexts/SystemDataContext";
import { getDiagnosisCounts } from "@/lib/systemData/generateDiagnoses";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/topology", icon: Share2, label: "Topology" },
  { to: "/snmp", icon: Network, label: "Core Network" },
  { to: "/discovery", icon: Radar, label: "Discovery" },
  { to: "/diagnoses", icon: Activity, label: "Diagnoses" },
  { to: "/maintenance", icon: Wrench, label: "Maintenance" },
  { to: "/equipment", icon: Package, label: "Equipment" },
  { to: "/cables", icon: Cable, label: "Cables" },
  { to: "/documents", icon: BookOpen, label: "Documents" },
  { to: "/assistant", icon: Bot, label: "AI Assistant" },
  { to: "/lighting", icon: Lightbulb, label: "Lights and Shades" },
  { to: "/automation", icon: Zap, label: "Automation" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/help", icon: HelpCircle, label: "Help" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function AppLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { branding } = useBranding();
  const { theme, setTheme, saveTheme } = useTheme();
  const { isDemo } = usePlatformMode();
  const b = branding ?? DEFAULT_BRANDING;
  const systemData = useSystemDataOptional();
  const diagCounts = systemData ? getDiagnosisCounts(systemData.diagnoses) : { active: 0, critical: 0 };
  const maintenanceOverdue = systemData?.snapshot?.maintenance?.overdue ?? 0;
  const monitoredCount = systemData?.snapshot?.monitoredCount;

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    saveTheme(next);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-60 flex flex-col
        transition-transform duration-300
        border-r border-border
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `} style={{ background: "linear-gradient(180deg, hsl(24,14%,6%) 0%, hsl(24,12%,4%) 100%)" }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid hsl(42 40% 20% / 0.4)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(42 50% 18%), hsl(42 40% 12%))", border: "1px solid hsl(42 65% 40% / 0.5)" }}>
              {b.logoUrl ? (
                <img src={b.logoUrl} alt="" className="max-w-full max-h-full object-contain p-0.5" />
              ) : (
                <Wifi size={14} style={{ color: "hsl(42 65% 58%)" }} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold leading-none tracking-wide" style={{ color: "hsl(42 55% 88%)", fontFamily: "'Playfair Display', serif" }}>
                {b.appTitle || DEFAULT_BRANDING.appTitle}
              </p>
              {(b.appSubtitle ?? DEFAULT_BRANDING.appSubtitle) ? (
                <p className="text-[9px] mt-1 uppercase tracking-[0.18em]" style={{ color: "hsl(42 30% 45%)" }}>
                  {b.appSubtitle || DEFAULT_BRANDING.appSubtitle}
                </p>
              ) : null}
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden transition-colors" style={{ color: "hsl(42 30% 45%)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Vessel badge */}
        <div className="mx-4 mt-4 mb-2 px-3.5 py-3 rounded-lg"
          style={{ background: "hsl(42 20% 8%)", border: "1px solid hsl(42 40% 18% / 0.8)" }}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full" style={{ background: "hsl(145 55% 42% / 0.5)" }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "hsl(145 55% 42%)" }} />
            </span>
            <p className="text-xs font-medium" style={{ color: "hsl(42 40% 78%)" }}>{b.name || DEFAULT_BRANDING.name}</p>
          </div>
          <p className="text-[10px] mt-1 ml-4" style={{ color: "hsl(42 20% 40%)" }}>
            {monitoredCount != null ? `${monitoredCount} devices monitored` : "Loading…"}
          </p>
        </div>

        {/* Thin gold rule */}
        <div className="mx-4 my-2 divider-gold" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto scrollbar-hide">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive ? "nav-active" : "nav-inactive"
                }`
              }
              style={({ isActive }) => isActive
                ? { background: "linear-gradient(90deg, hsl(42 65% 52% / 0.12), transparent)", color: "hsl(42 65% 68%)", borderLeft: "2px solid hsl(42 65% 52%)", paddingLeft: "10px" }
                : { color: "hsl(42 20% 45%)", borderLeft: "2px solid transparent" }
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={13} style={isActive ? { color: "hsl(42 65% 58%)" } : {}} />
                  <span className="tracking-wide">{item.label}</span>
                  {item.to === "/diagnoses" && diagCounts.active > 0 && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: "hsl(38 90% 50% / 0.15)", color: "hsl(38 90% 60%)" }}>
                      {diagCounts.active}
                    </span>
                  )}
                  {item.to === "/maintenance" && maintenanceOverdue > 0 && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: "hsl(0 72% 51% / 0.15)", color: "hsl(0 72% 65%)" }}>
                      {maintenanceOverdue}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3.5" style={{ borderTop: "1px solid hsl(42 30% 12% / 0.8)" }}>
          <p className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "hsl(42 20% 32%)" }}>v1.0.0 · Wave Guard</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-5 py-3 flex-shrink-0 backdrop-blur-xl"
          style={{ borderBottom: "1px solid hsl(42 30% 12% / 0.7)", background: "hsl(24 12% 5% / 0.85)" }}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "hsl(42 30% 50%)" }}
          >
            <Menu size={15} />
          </button>
          <div className="flex-1 flex items-center gap-2.5 max-w-sm min-w-0 rounded-lg px-3 py-1.5"
            style={{ background: "hsl(42 15% 8%)", border: "1px solid hsl(42 30% 14% / 0.8)" }}>
            <Search size={12} style={{ color: "hsl(42 30% 40%)", flexShrink: 0 }} />
            <input
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm focus:outline-none min-w-0"
              style={{ color: "hsl(42 30% 80%)", fontFamily: "'Inter', sans-serif" }}
            />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            {isDemo && (
              <NavLink
                to="/settings"
                title="Demo mode active"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide transition-colors"
                style={{ background: "hsl(270 50% 50% / 0.12)", border: "1px solid hsl(270 50% 50% / 0.25)", color: "hsl(270 70% 75%)" }}
              >
                <FlaskConical size={11} />
                Demo
              </NavLink>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "hsl(42 30% 42%)" }}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              aria-label="Notifications"
              className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "hsl(42 30% 42%)" }}
            >
              <Bell size={14} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "hsl(0 72% 55%)" }} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();

  if (location.pathname === "/setup" || location.pathname === "/mobile") {
    return <Outlet />;
  }

  return (
    <SystemDataProvider>
      <AppLayoutContent />
    </SystemDataProvider>
  );
}