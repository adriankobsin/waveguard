import { Link } from "react-router-dom";
import {
  EthernetPort,
  Loader2,
  Zap,
  ExternalLink,
  Server,
  Monitor,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { resolveConnectedEquipment } from "@/lib/snmp/resolveConnectedEquipment";
import { formatSpeedMbps } from "@/lib/snmp/snmpAnalytics";

const STATUS_BADGE = {
  up: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  down: "bg-red-500/15 text-red-400 border-red-500/30",
  disabled: "bg-secondary text-muted-foreground",
  unknown: "bg-secondary text-muted-foreground",
};

function DetailRow({ label, value, mono = false, className = "" }) {
  if (value == null || value === "") return null;
  return (
    <div className={`flex justify-between gap-4 py-2 border-b border-border/50 last:border-0 ${className}`}>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-xs text-foreground text-right break-all ${mono ? "font-mono" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
        {Icon && <Icon size={14} className="text-primary" />}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h4>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

export default function SnmpInterfaceDetailSheet({
  open,
  onOpenChange,
  port,
  sw,
  equipmentList = [],
  testingPort,
  onTestPort,
}) {
  if (!port) return null;

  const connected = resolveConnectedEquipment(equipmentList, port);
  const status = port.status || "unknown";
  const poeLabel =
    port.poeWatts != null
      ? `${port.poeWatts} W${port.poeStatus ? ` (${port.poeStatus})` : ""}`
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left pr-8">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <EthernetPort size={18} className="text-primary" />
            {port.name || `Interface ${port.index}`}
          </SheetTitle>
          <SheetDescription className="text-left">
            {sw?.displayName}
            {sw?.ip ? ` · ${sw.ip}` : ""}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className={STATUS_BADGE[status] || STATUS_BADGE.unknown}>
              {(status || "unknown").toUpperCase()}
            </Badge>
            {port.isUplink && (
              <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
                Uplink
              </Badge>
            )}
            {port.slotEmpty && (
              <Badge variant="outline" className="text-muted-foreground">
                Awaiting poll
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Section title="Interface" icon={EthernetPort}>
            <DetailRow label="Index" value={port.index} mono />
            <DetailRow label="Name" value={port.name} mono />
            <DetailRow label="Alias" value={port.ifAlias} />
            <DetailRow label="Oper status" value={(port.status || "unknown").toUpperCase()} />
            <DetailRow label="Speed" value={formatSpeedMbps(port.speedMbps || port.speed)} />
            <DetailRow label="MTU" value={port.mtu ?? 1500} />
            <DetailRow label="VLAN" value={port.vlan != null ? String(port.vlan) : null} />
            <DetailRow label="Inbound" value={`${(port.inMbps || 0).toFixed(1)} Mbps`} />
            <DetailRow label="Outbound" value={`${(port.outMbps || 0).toFixed(1)} Mbps`} />
            {port.inOctets != null && (
              <DetailRow label="In octets" value={String(port.inOctets)} mono />
            )}
            {port.outOctets != null && (
              <DetailRow label="Out octets" value={String(port.outOctets)} mono />
            )}
            <DetailRow label="PoE" value={poeLabel} />
          </Section>

          <Section title="L2 neighbour" icon={Server}>
            <DetailRow label="Detected name" value={port.connectedDevice} />
            <DetailRow label="MAC address" value={port.macAddr} mono />
            {!port.connectedDevice && !port.macAddr && (
              <p className="text-xs text-muted-foreground py-3">No neighbour learned on this port.</p>
            )}
          </Section>

          <Section title="Connected device" icon={Monitor}>
            {connected ? (
              <>
                <DetailRow label="Name" value={connected.name} />
                <DetailRow label="IP address" value={connected.ip} mono />
                <DetailRow label="MAC address" value={connected.mac || port.macAddr} mono />
                <DetailRow label="Make" value={connected.make || connected.vendor} />
                <DetailRow label="Model" value={connected.model} mono />
                <DetailRow label="Category" value={connected.category} />
                <DetailRow label="Serial" value={connected.serial} mono />
                <DetailRow label="Location" value={connected.location} />
                <DetailRow label="Status" value={connected.status} />
                <DetailRow label="Firmware" value={connected.firmware || connected.firmwareVersion} />
                <Link
                  to="/equipment"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-3 mb-2"
                >
                  <ExternalLink size={12} /> Open in Equipment
                </Link>
              </>
            ) : port.connectedDevice || port.macAddr ? (
              <>
                <p className="text-xs text-muted-foreground py-2">
                  Neighbour seen on this port but not matched to an Equipment record. Register the device in
                  Equipment to link make, model, and IP automatically.
                </p>
                <DetailRow label="Detected name" value={port.connectedDevice} />
                <DetailRow label="MAC address" value={port.macAddr} mono />
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-3">No device connected on this interface.</p>
            )}
          </Section>

          {sw?.lastPoll?.trafficHistory?.length > 0 && (
            <Section title="Switch context" icon={Server}>
              <DetailRow
                label="Last fleet poll"
                value={sw.lastPollAt ? new Date(sw.lastPollAt).toLocaleString() : "—"}
              />
              <DetailRow label="SysName" value={sw.sysName} mono />
            </Section>
          )}

          <button
            type="button"
            onClick={onTestPort}
            disabled={testingPort || port.slotEmpty}
            className="w-full flex items-center justify-center gap-2 text-sm border border-border rounded-xl px-4 py-2.5 hover:bg-secondary/40 disabled:opacity-50"
          >
            {testingPort ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Test interface
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
