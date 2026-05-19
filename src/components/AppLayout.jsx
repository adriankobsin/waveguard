import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Network, Activity, Wrench, Settings,
  Wifi, Menu, X, Search, Bell, Share2, Zap,
  BookOpen, Bot, Cable, Package, FileText, Lightbulb, Radar, HelpCircle
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/topology", icon: Share2, label: "Topology" },
  { to: "/snmp", icon: Network, label: "SNMP" },
  { to: "/discovery", icon: Radar, label: "Discovery" },
  { to: "/diagnoses", icon: Activity, label: "Diagnoses" },
  { to: "/maintenance", icon: Wrench, label: "Maintenance" },
  { to: "/inventory", icon: Package, label: "Inventory" },
  { to: "/cables", icon: Cable, label: "Cables" },
  { to: "/documents", icon: BookOpen, label: "Documents" },
  { to: "/assistant", icon: Bot, label: "AI Assistant" },
  { to: "/lighting", icon: Lightbulb, label: "Lighting" },
  { to: "/automation", icon: Zap, label: "Automation" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/help", icon: HelpCircle, label: "Help" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Don't show layout on setup wizard or mobile page
  if (location.pathname === "/setup" || location.pathname === "/mobile") {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-60 bg-card border-r border-border flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/12 flex items-center justify-center ring-1 ring-cyan-500/20">
              <Wifi size={15} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none tracking-tight">Guardian AI</p>
              <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">Wave-AVI</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Vessel badge */}
        <div className="mx-4 mt-3 mb-2 px-3 py-2.5 bg-secondary rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500/50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className="text-xs font-semibold text-white">M/Y Horizon</p>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 ml-4">47 devices monitored</p>
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`
              }
            >
              <item.icon size={15} />
              {item.label}
              {item.to === "/diagnoses" && (
                <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">2</span>
              )}
              {item.to === "/maintenance" && (
                <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">2</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">v1.0.0 · Wave-AVI</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-xl flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <Menu size={16} />
          </button>
          <div className="flex-1 flex items-center gap-2 max-w-sm bg-secondary border border-border rounded-xl px-3 py-1.5">
            <Search size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              placeholder="Search devices, alarms…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
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