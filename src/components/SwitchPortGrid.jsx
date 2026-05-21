import { Zap } from "lucide-react";

const PORT_STATUS_STYLES = {
  up: "bg-green-500 hover:bg-green-400 shadow-sm shadow-green-500/40",
  down: "bg-red-500 hover:bg-red-400 shadow-sm shadow-red-500/30",
  disabled: "bg-secondary hover:bg-muted",
  testing: "bg-yellow-500 hover:bg-yellow-400",
  unknown: "bg-zinc-700/80 hover:bg-zinc-600 border border-dashed border-zinc-500/40",
};

function portTooltip(port) {
  const parts = [port.name || `Port ${port.index}`];
  if (port.isUplink) parts.push("Uplink");
  if (port.ifAlias) parts.push(port.ifAlias);
  if (port.connectedDevice) parts.push(`→ ${port.connectedDevice}`);
  if (port.macAddr) parts.push(port.macAddr);
  if (port.poeWatts != null) parts.push(`PoE ${port.poeWatts}W`);
  if (port.inMbps || port.outMbps) {
    parts.push(`↓${(port.inMbps || 0).toFixed(1)} ↑${(port.outMbps || 0).toFixed(1)} Mbps`);
  }
  if (port.slotEmpty) parts.push("(no data — poll switch)");
  return parts.join(" · ");
}

function PortCell({ port, selected, onClick, compact = false }) {
  const style = PORT_STATUS_STYLES[port.status] ?? PORT_STATUS_STYLES.unknown;
  const hasTraffic = port.status === "up" && (port.inMbps > 0 || port.outMbps > 0);
  const hasPoe = port.poeWatts != null && port.poeWatts > 0;
  const w = compact ? "w-8" : "w-9";
  const h = compact ? "h-10" : port.isUplink ? "h-10 w-8" : "h-12";

  return (
    <button
      type="button"
      onClick={onClick}
      title={portTooltip(port)}
      className={`
        relative ${w} ${h} rounded-md transition-all duration-150 cursor-pointer
        ${style}
        ${port.isUplink ? "ring-1 ring-cyan-500/30" : ""}
        ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 z-10" : ""}
      `}
    >
      <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] font-bold text-white/80">
        {port.index}
      </span>
      {hasTraffic && (
        <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-white/60 animate-pulse" />
      )}
      {hasPoe && (
        <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-amber-300/90" />
      )}
      {port.isUplink && (
        <span className="absolute top-0.5 left-0 right-0 text-center text-[7px] text-cyan-200/80 font-bold">
          S+
        </span>
      )}
      {!port.isUplink && (port.speed === 1000 || port.speedMbps >= 1000) && port.status === "up" && (
        <span className="absolute top-0.5 left-0 right-0 text-center text-[7px] text-white/50 font-bold">
          G
        </span>
      )}
    </button>
  );
}

function PortRow({ ports, selectedPort, onSelectPort, label }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>}
      <div className="flex gap-1.5 flex-wrap items-end">
        {ports.map((port) => (
          <PortCell
            key={port.index}
            port={port}
            selected={selectedPort?.index === port.index}
            onClick={() => onSelectPort?.(selectedPort?.index === port.index ? null : port)}
          />
        ))}
      </div>
    </div>
  );
}

function layoutPortGroups(ports, chassis) {
  const copper = chassis?.copperPorts || ports.filter((p) => !p.isUplink).length;
  const uplink = chassis?.uplinkPorts || 0;
  const copperPorts = ports.filter((p) => !p.isUplink && p.index <= copper);
  const uplinkPorts = ports.filter((p) => p.isUplink || (uplink > 0 && p.index > copper));

  switch (chassis?.layout) {
    case "access-uplink": {
      const half = Math.ceil(copper / 2);
      return {
        type: "access-uplink",
        rows: [
          { label: `RJ45 1–${half}`, ports: copperPorts.slice(0, half) },
          { label: `RJ45 ${half + 1}–${copper}`, ports: copperPorts.slice(half) },
        ],
        uplinks: uplinkPorts,
      };
    }
    case "rack-48": {
      const half = 24;
      return {
        type: "rack-48",
        rows: [
          { label: "Ports 1–24", ports: copperPorts.slice(0, half) },
          { label: "Ports 25–48", ports: copperPorts.slice(half, 48) },
        ],
        uplinks: uplinkPorts,
      };
    }
    case "single-row":
      return { type: "single-row", rows: [{ label: null, ports: copperPorts }], uplinks: uplinkPorts };
    case "dual-row":
    default: {
      const half = Math.ceil(copperPorts.length / 2) || Math.ceil(ports.length / 2);
      const all = copperPorts.length ? copperPorts : ports;
      return {
        type: "dual-row",
        rows: [
          { label: null, ports: all.slice(0, half) },
          { label: null, ports: all.slice(half) },
        ],
        uplinks: uplinkPorts,
      };
    }
  }
}

export default function SwitchPortGrid({ ports, chassis, selectedPort, onSelectPort }) {
  if (!ports?.length && !chassis) {
    return <p className="text-sm text-muted-foreground">No chassis model — set model in Equipment.</p>;
  }

  const layout = layoutPortGroups(ports || [], chassis);

  return (
    <div className="space-y-3">
      {chassis && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pb-1 border-b border-border/60">
          <span className="font-mono font-medium text-foreground">{chassis.model}</span>
          <span>·</span>
          <span>{chassis.series}</span>
          {chassis.poe && (
            <span className="inline-flex items-center gap-0.5 text-amber-400/90">
              <Zap size={10} /> PoE
            </span>
          )}
          <span className="ml-auto">{chassis.portCount} port chassis</span>
        </div>
      )}

      <div
        className={
          layout.type === "access-uplink"
            ? "flex flex-col lg:flex-row gap-4 lg:items-start"
            : "space-y-2"
        }
      >
        <div className="flex-1 space-y-2 min-w-0">
          {layout.rows.map((row, i) => (
            <PortRow
              key={i}
              label={row.label}
              ports={row.ports}
              selectedPort={selectedPort}
              onSelectPort={onSelectPort}
            />
          ))}
        </div>

        {layout.uplinks?.length > 0 && (
          <div className="lg:border-l lg:border-border lg:pl-4">
            <PortRow
              label={`Uplink / SFP+ (${layout.uplinks.length})`}
              ports={layout.uplinks}
              selectedPort={selectedPort}
              onSelectPort={onSelectPort}
            />
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          Up: {ports.filter((p) => p.status === "up").length}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          Down: {ports.filter((p) => p.status === "down").length}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-zinc-600 border border-dashed border-zinc-500" />
          No data: {ports.filter((p) => p.slotEmpty).length}
        </span>
      </div>
    </div>
  );
}
