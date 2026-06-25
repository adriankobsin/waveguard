import { useState, useRef } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Network, Activity, Wrench, Settings,
  Wifi, Menu, X, Search, Bell, Share2, Zap,
  BookOpen, Bot, Cable, Package, FileText,   Lightbulb, Music, Radar, HelpCircle, Thermometer,
  Sun, Moon, FlaskConical, Loader2,
} from "lucide-react";
import { useBranding, DEFAULT_BRANDING } from "@/contexts/BrandingContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePlatformMode } from "@/contexts/PlatformModeContext";
import { SystemDataProvider, useSystemDataOptional } from "@/contexts/SystemDataContext";
import { getDiagnosisCounts } from "@/lib/systemData/generateDiagnoses";
import { DiscoveryProvider, useDiscovery } from "@/contexts/DiscoveryContext";

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
  { to: "/audio", icon: Music, label: "Audio DSP" },
  { to: "/automation", icon: Zap, label: "Automation" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/hvac", icon: Thermometer, label: "HVAC" },
  { to: "/help", icon: HelpCircle, label: "Help" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function NotifPanel({ open, onClose, diagnoses, recentEvents }) {
  const ref = useRef(null);

  const critical = diagnoses.filter(d => d.severity === "critical");
  const warnings = diagnoses.filter(d => d.severity === "warning");
  const activeCount = critical.length + warnings.length;

  return (
    <div ref={ref}>
      {open && (
        <>
          <div className="fixed inset-0 z-[9999]" onClick={onClose} />
          <div className="fixed top-14 right-5 w-80 rounded-xl border border-border bg-card shadow-xl z-[10000] max-h-[75vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Notifications</h3>
              {activeCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">{activeCount}</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {critical.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide px-2 py-1 sticky top-0 bg-card/90 backdrop-blur-sm">
                    Critical ({critical.length})
                  </p>
                  {critical.map(d => (
                    <div key={d.id} className="px-2 py-1.5 rounded-lg hover:bg-red-500/5 text-xs text-foreground cursor-pointer transition-colors">
                      <Link to="/diagnoses" onClick={onClose} className="block">{d.summary}</Link>
                    </div>
                  ))}
                </div>
              )}

              {warnings.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide px-2 py-1 sticky top-0 bg-card/90 backdrop-blur-sm">
                    Warnings ({warnings.length})
                  </p>
                  {warnings.map(d => (
                    <div key={d.id} className="px-2 py-1.5 rounded-lg hover:bg-amber-500/5 text-xs text-foreground cursor-pointer transition-colors">
                      <Link to="/diagnoses" onClick={onClose} className="block">{d.summary}</Link>
                    </div>
                  ))}
                </div>
              )}

              {recentEvents.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1 sticky top-0 bg-card/90 backdrop-blur-sm">
                    Recent events
                  </p>
                  {recentEvents.slice(0, 5).map((ev, i) => (
                    <div key={ev.id || i} className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${ev.status === "online" ? "bg-emerald-500" : ev.status === "offline" ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="truncate flex-1">{ev.text}</span>
                      <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">{ev.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {!critical.length && !warnings.length && !recentEvents.length && (
                <div className="py-8 text-center">
                  <Bell size={20} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground/50">No notifications</p>
                </div>
              )}
            </div>

            <Link
              to="/diagnoses"
              onClick={onClose}
              className="block px-4 py-2.5 border-t border-border text-[10px] text-primary hover:text-primary/80 font-medium text-center flex-shrink-0 transition-colors"
            >
              View all diagnoses →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function AppLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const { branding } = useBranding();
  const { theme, setTheme, saveTheme } = useTheme();
  const { isDemo } = usePlatformMode();
  const b = branding ?? DEFAULT_BRANDING;
  const systemData = useSystemDataOptional();
  const diagCounts = systemData ? getDiagnosisCounts(systemData.diagnoses) : { active: 0, critical: 0 };
  const maintenanceOverdue = systemData?.snapshot?.maintenance?.overdue ?? 0;
  const monitoredCount = systemData?.snapshot?.monitoredCount;
  const { scanning, progress, devices, error } = useDiscovery();

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

        {/* Scan progress indicator */}
        {scanning && (
          <div className="mx-4 mb-2 px-3.5 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25">
            <NavLink
              to="/discovery"
              onClick={() => setSidebarOpen(false)}
              className="block"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-cyan-400 flex items-center gap-1.5">
                  <Loader2 size={10} className="animate-spin" />
                  Scanning network
                </span>
                <span className="text-[9px] text-cyan-400/70">{Math.round(progress)}%</span>
              </div>
              <div className="h-1 bg-cyan-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground/70 mt-1.5">
                {devices.length} device{devices.length !== 1 ? "s" : ""} found
              </p>
            </NavLink>
          </div>
        )}

        {error && !scanning && (
          <div className="mx-4 mb-2 px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/25">
            <NavLink
              to="/discovery"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-1.5"
            >
              <span className="text-[10px] text-red-400">Scan error — tap to view</span>
            </NavLink>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
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
              onClick={() => setNotifOpen(v => !v)}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <Bell size={14} />
              {diagCounts.active > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        <NotifPanel
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          diagnoses={systemData?.diagnoses || []}
          recentEvents={systemData?.snapshot?.recentEvents || []}
        />
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
      <DiscoveryProvider>
        <AppLayoutContent />
      </DiscoveryProvider>
    </SystemDataProvider>
  );
}