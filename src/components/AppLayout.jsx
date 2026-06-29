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
        bg-card border-r border-border
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {b.logoUrl ? (
                <img src={b.logoUrl} alt="" className="max-w-full max-h-full object-contain p-0.5" />
              ) : (
                <Wifi size={14} className="text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">
                {b.appTitle || DEFAULT_BRANDING.appTitle}
              </p>
              {(b.appSubtitle ?? DEFAULT_BRANDING.appSubtitle) ? (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {b.appSubtitle || DEFAULT_BRANDING.appSubtitle}
                </p>
              ) : null}
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X size={15} />
          </button>
        </div>

        {/* Vessel badge */}
        <div className="mx-4 mt-4 mb-2 px-3.5 py-3 rounded-lg bg-secondary border border-border">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500/50" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            <p className="text-xs font-medium text-foreground">{b.name || DEFAULT_BRANDING.name}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 ml-4">
            {monitoredCount != null ? `${monitoredCount} devices monitored` : "Loading…"}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollbar-hide">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={13} />
                  <span>{item.label}</span>
                  {item.to === "/diagnoses" && diagCounts.active > 0 && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
                      {diagCounts.active}
                    </span>
                  )}
                  {item.to === "/maintenance" && maintenanceOverdue > 0 && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                      {maintenanceOverdue}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border">
          <p className="text-[10px] text-muted-foreground">v1.0.0 · Wave Guard</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-5 py-3 flex-shrink-0 bg-card/80 backdrop-blur-xl border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Menu size={15} />
          </button>
          <div className="flex-1 flex items-center gap-2.5 max-w-sm min-w-0 bg-secondary border border-border rounded-lg px-3 py-1.5">
            <Search size={12} className="text-muted-foreground flex-shrink-0" />
            <input
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
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
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              aria-label="Notifications"
              className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <Bell size={14} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
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