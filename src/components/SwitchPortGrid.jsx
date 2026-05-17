import { useState } from "react";

const PORT_STATUS_STYLES = {
  up:       "bg-green-500 hover:bg-green-400 shadow-sm shadow-green-500/40",
  down:     "bg-red-500 hover:bg-red-400 shadow-sm shadow-red-500/30",
  disabled: "bg-secondary hover:bg-muted",
  testing:  "bg-yellow-500 hover:bg-yellow-400",
  unknown:  "bg-gray-600 hover:bg-gray-500",
};

function formatSpeed(speed) {
  if (!speed) return "";
  if (speed >= 1000) return `${speed / 1000}G`;
  return `${speed}M`;
}

export default function SwitchPortGrid({ ports, selectedPort, onSelectPort }) {
  if (!ports?.length) return <p className="text-sm text-muted-foreground">No ports found.</p>;

  // Split into two rows (top/bottom) like a real managed switch
  const half = Math.ceil(ports.length / 2);
  const topPorts = ports.slice(0, half);
  const bottomPorts = ports.slice(half);

  return (
    <div className="space-y-1">
      {/* Top row */}
      <div className="flex gap-1.5 flex-wrap">
        {topPorts.map(port => (
          <PortCell
            key={port.index}
            port={port}
            selected={selectedPort?.index === port.index}
            onClick={() => onSelectPort?.(selectedPort?.index === port.index ? null : port)}
          />
        ))}
      </div>
      {/* Bottom row */}
      {bottomPorts.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {bottomPorts.map(port => (
            <PortCell
              key={port.index}
              port={port}
              selected={selectedPort?.index === port.index}
              onClick={() => onSelectPort?.(selectedPort?.index === port.index ? null : port)}
            />
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-4 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          Up: {ports.filter(p => p.status === "up").length}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          Down: {ports.filter(p => p.status === "down").length}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-secondary" />
          Disabled: {ports.filter(p => p.status === "disabled").length}
        </span>
      </div>
    </div>
  );
}

function PortCell({ port, selected, onClick }) {
  const style = PORT_STATUS_STYLES[port.status] ?? PORT_STATUS_STYLES.unknown;
  const hasTraffic = port.status === "up" && (port.inMbps > 0 || port.outMbps > 0);

  return (
    <button
      onClick={onClick}
      title={`${port.name}${port.connectedDevice ? ` — ${port.connectedDevice}` : ""}`}
      className={`
        relative w-9 h-12 rounded-md transition-all duration-150 cursor-pointer
        ${style}
        ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 z-10" : ""}
      `}
    >
      {/* Port number */}
      <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white/80">
        {port.index}
      </span>
      {/* Activity indicator */}
      {hasTraffic && (
        <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-white/60 animate-pulse" />
      )}
      {/* Speed badge for gigabit */}
      {port.speed === 1000 && port.status === "up" && (
        <span className="absolute top-0.5 left-0 right-0 text-center text-[7px] text-white/50 font-bold">G</span>
      )}
    </button>
  );
}