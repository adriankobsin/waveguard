import { useState } from "react";
import {
  RefreshCw,
  Gauge,
  Pencil,
  Star,
  Wifi,
  WifiOff,
  Signal,
  Loader2,
  Trash2,
  Server,
  ChevronDown,
  ChevronRight,
  Globe,
  Cpu,
  Activity,
} from "lucide-react";
import { WAN_PRIORITIES } from "@/lib/wan/wanManagementSettings";
import { formatRelativeTime } from "@/lib/systemData/formatRelativeTime";
import {
  DEVICE_ROLE_LABELS,
  getVendorInfo,
} from "@/lib/integrations/vendorRegistry";

const STATUS_DOT = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  warning: "bg-amber-500",
};

function priorityStyle(priority) {
  return WAN_PRIORITIES.find((p) => p.id === priority)?.color || WAN_PRIORITIES[1].color;
}

function ParamRow({ label, value, mono }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-foreground font-medium text-right truncate ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Detail panel for a single WAN router group: shows router-level metadata,
 * vendor / role, last poll info, and per-link parameters with action buttons.
 */
export default function WanRouterDetailPanel({
  group,
  profile,
  equipment,
  wanManagement,
  defaultDashboardLink,
  speedTests,
  testingKey,
  pollingRouterId,
  onPollRouter,
  onSelectRouter,
  onSetDefault,
  onSpeedTest,
  onEditLink,
  onDeleteManual,
}) {
  const [expanded, setExpanded] = useState(true);

  const vendor = profile?.integrationVendor || group.routerVendor || "snmp";
  const vendorInfo = getVendorInfo(vendor);
  const roleLabel =
    DEVICE_ROLE_LABELS[profile?.deviceRole] ||
    (group.profileId ? "Device" : "Manual entry");

  const isPolling = pollingRouterId === group.profileId;
  const polledAt = profile?.lastPollAt || profile?.lastPoll?.polledAt;
  const pollSource = profile?.lastPoll?.source;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-secondary/40 border-b border-border hover:bg-secondary/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
            <Server size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate flex items-center gap-2">
              {group.routerName}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {roleLabel}
              </span>
              {vendor && vendor !== "snmp" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                  {vendorInfo?.label || vendor}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {group.routerIp || "No IP"}
              {group.routerModel ? ` · ${group.routerModel}` : ""}
              {polledAt ? ` · Polled ${formatRelativeTime(polledAt)}` : " · Not polled"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {group.profileId && onPollRouter && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPollRouter(group.profileId);
              }}
              disabled={isPolling}
              className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-50 bg-background"
            >
              <RefreshCw size={12} className={isPolling ? "animate-spin" : ""} />
              {isPolling ? "Polling…" : "Poll router"}
            </button>
          )}
          {group.profileId && onSelectRouter && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectRouter(group.profileId);
              }}
              title="Open in Fleet"
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1.5 bg-background"
            >
              Open in Fleet
            </button>
          )}
          {expanded ? (
            <ChevronDown size={16} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-b border-border bg-background/30 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Cpu size={10} /> Hardware
            </p>
            <ParamRow label="Vendor" value={vendorInfo?.label || vendor} />
            <ParamRow label="Model" value={group.routerModel} />
            <ParamRow label="Role" value={roleLabel} />
            <ParamRow label="Serial" value={equipment?.serial} mono />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Globe size={10} /> Network
            </p>
            <ParamRow label="Mgmt IP" value={group.routerIp} mono />
            <ParamRow label="Location" value={equipment?.location || profile?.location} />
            <ParamRow label="Deck" value={equipment?.deckId || profile?.deckId} />
            <ParamRow label="Room" value={equipment?.roomId || profile?.roomId} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Activity size={10} /> Polling
            </p>
            <ParamRow label="Method" value={profile?.pollMethod || "—"} />
            <ParamRow label="SNMP" value={profile?.snmpVersion ? `v${profile.snmpVersion}` : "—"} />
            <ParamRow
              label="Interval"
              value={profile?.pollIntervalSec ? `${profile.pollIntervalSec}s` : "Default"}
            />
            <ParamRow label="Source" value={pollSource} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Server size={10} /> Capabilities
            </p>
            <ParamRow label="Ports" value={group.links.length} />
            <ParamRow label="SNMP" value={profile?.capabilities?.snmp ? "Yes" : "No"} />
            <ParamRow label="REST API" value={profile?.capabilities?.rest ? "Yes" : "No"} />
            <ParamRow label="Cellular" value={profile?.capabilities?.cellular ? "Yes" : "No"} />
          </div>
        </div>
      )}

      {expanded && (
        <div className="divide-y divide-border">
          {group.links.map((link) => {
            const test = speedTests[link.key];
            const isDefault = defaultDashboardLink === link.key;
            const override = wanManagement?.linkOverrides?.[link.key];
            return (
              <div
                key={link.key}
                className="px-4 py-3 hover:bg-secondary/10 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${STATUS_DOT[link.status] || STATUS_DOT.warning}`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm text-foreground">{link.name}</p>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityStyle(link.priority)}`}
                        >
                          {WAN_PRIORITIES.find((p) => p.id === link.priority)?.label || link.priority}
                        </span>
                        {link.type && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {link.type}
                          </span>
                        )}
                        {isDefault && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 flex items-center gap-1">
                            <Star size={9} /> Dashboard default
                          </span>
                        )}
                        {link.synthetic && (
                          <span className="text-[10px] text-amber-500">Preview</span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground font-medium">
                          {link.isp || "No ISP set"}
                        </span>
                        {link.publicIp ? ` · ${link.publicIp}` : ""}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-[11px]">
                        <div className="flex items-center gap-1">
                          {link.status === "online" ? (
                            <Wifi size={10} className="text-emerald-500" />
                          ) : (
                            <WifiOff size={10} className="text-red-500" />
                          )}
                          <span className="text-foreground capitalize">{link.status}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Down </span>
                          <span className="text-primary font-medium">
                            {link.synthetic && !test && !link.downloadMbps ? "—" : `${test ? test.downloadMbps : link.downloadMbps} Mbps`}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Up </span>
                          <span className="text-emerald-500 font-medium">
                            {link.synthetic && !test && !link.uploadMbps ? "—" : `${test ? test.uploadMbps : link.uploadMbps} Mbps`}
                          </span>
                        </div>
                        {link.linkSpeedMbps > 0 && (
                          <div>
                            <span className="text-muted-foreground">Link </span>
                            <span className="text-foreground font-medium">
                              {link.linkSpeedMbps} Mbps
                            </span>
                          </div>
                        )}
                        {link.gateway && (
                          <div>
                            <span className="text-muted-foreground">GW </span>
                            <span className="font-mono text-foreground">{link.gateway}</span>
                          </div>
                        )}
                        {link.dns && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">DNS </span>
                            <span className="font-mono text-foreground">{link.dns}</span>
                          </div>
                        )}
                        {link.carrier && (
                          <div>
                            <span className="text-muted-foreground">Carrier </span>
                            <span className="text-foreground">{link.carrier}</span>
                          </div>
                        )}
                        {link.signalDbm != null && (
                          <div className="flex items-center gap-0.5">
                            <Signal size={10} className="text-muted-foreground" />
                            <span className="text-foreground">{link.signalDbm} dBm</span>
                          </div>
                        )}
                        {link.latencyMs != null && (
                          <div>
                            <span className="text-muted-foreground">Latency </span>
                            <span className="text-foreground">{link.latencyMs} ms</span>
                          </div>
                        )}
                        {link.vpnUp != null && (
                          <div>
                            <span className="text-muted-foreground">VPN </span>
                            <span className={link.vpnUp ? "text-emerald-500" : "text-muted-foreground"}>
                              {link.vpnUp ? "Up" : "Down"}
                            </span>
                          </div>
                        )}
                        {(link.contractDownMbps || link.contractUpMbps) && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Plan </span>
                            <span className="text-foreground">
                              {link.contractDownMbps || "—"}/{link.contractUpMbps || "—"} Mbps
                            </span>
                          </div>
                        )}
                        {link.lastPollAt && (
                          <div>
                            <span className="text-muted-foreground">Polled </span>
                            <span className="text-foreground">
                              {formatRelativeTime(link.lastPollAt)}
                            </span>
                          </div>
                        )}
                        {test?.testedAt && (
                          <div>
                            <span className="text-muted-foreground">Tested </span>
                            <span className="text-foreground">
                              {formatRelativeTime(test.testedAt)}
                            </span>
                          </div>
                        )}
                      </div>

                      {(link.providerAccount || link.providerContact || link.providerPhone || link.providerEmail) && (
                        <div className="mt-1 text-[11px] text-muted-foreground space-x-2">
                          {link.providerAccount && (
                            <span>
                              Account <span className="text-foreground font-mono">{link.providerAccount}</span>
                            </span>
                          )}
                          {link.providerContact && (
                            <span>
                              Contact <span className="text-foreground">{link.providerContact}</span>
                            </span>
                          )}
                          {link.providerPhone && (
                            <span>
                              Phone <span className="text-foreground font-mono">{link.providerPhone}</span>
                            </span>
                          )}
                          {link.providerEmail && (
                            <span>
                              Email <span className="text-foreground font-mono">{link.providerEmail}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {link.notes && (
                        <p className="text-[11px] text-muted-foreground/80 line-clamp-3">
                          {link.notes}
                        </p>
                      )}

                      {override && (
                        <p className="text-[10px] text-primary/80">
                          Custom ISP details applied
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 lg:flex-col lg:items-end">
                    {!isDefault && (
                      <button
                        type="button"
                        title="Set as dashboard default"
                        onClick={() => onSetDefault(link.key)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    {link.profileId && link.portIndex != null && (
                      <button
                        type="button"
                        title="Run speed test"
                        onClick={() => onSpeedTest(link)}
                        disabled={testingKey === link.key || link.status === "offline"}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50"
                      >
                        {testingKey === link.key ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Gauge size={14} />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      title="Edit ISP details"
                      onClick={() => onEditLink(link)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                      <Pencil size={14} />
                    </button>
                    {link.source === "manual" && (
                      <button
                        type="button"
                        title="Delete manual link"
                        onClick={() => onDeleteManual(link.manualId)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
