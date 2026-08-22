import { useState } from "react";
import {
  RefreshCw,
  Gauge,
  Pencil,
  Star,
  Signal,
  Loader2,
  Trash2,
  Server,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { WAN_PRIORITIES } from "@/lib/wan/wanManagementSettings";
import { formatRelativeTime } from "@/lib/systemData/formatRelativeTime";

const STATUS_DOT = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  warning: "bg-amber-500",
};

function priorityStyle(priority) {
  return WAN_PRIORITIES.find((p) => p.id === priority)?.color || WAN_PRIORITIES[1].color;
}

function speedLabel(mbps, { synthetic, hasTest }) {
  if (synthetic && !hasTest && (mbps == null || mbps === 0 || mbps === "")) return "—";
  if (mbps == null || mbps === "") return "—";
  return `${mbps} Mbps`;
}

/**
 * Compact WAN router group: name / IP / poll + per-link status, ISP, speeds, actions.
 */
export default function WanRouterDetailPanel({
  group,
  profile,
  defaultDashboardLink,
  speedTests,
  testingKey,
  pollingRouterId,
  onPollRouter,
  onSetDefault,
  onSpeedTest,
  onEditLink,
  onDeleteManual,
}) {
  const [expanded, setExpanded] = useState(true);

  const isPolling = pollingRouterId === group.profileId;
  const polledAt = profile?.lastPollAt || profile?.lastPoll?.polledAt;
  const onlineCount = group.links.filter((l) => l.status === "online").length;

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
            <p className="font-semibold text-sm text-foreground truncate">
              {group.routerName}
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                {onlineCount}/{group.links.length} online
              </span>
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {group.routerIp || "No IP"}
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
              {isPolling ? "Polling…" : "Poll"}
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
        <div className="divide-y divide-border">
          {group.links.map((link) => {
            const test = speedTests[link.key];
            const isDefault = defaultDashboardLink === link.key;
            const down = test ? test.downloadMbps : link.downloadMbps;
            const up = test ? test.uploadMbps : link.uploadMbps;
            return (
              <div
                key={link.key}
                className="px-4 py-3 hover:bg-secondary/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${STATUS_DOT[link.status] || STATUS_DOT.warning}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm text-foreground">{link.name}</p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityStyle(link.priority)}`}
                      >
                        {WAN_PRIORITIES.find((p) => p.id === link.priority)?.label || link.priority}
                      </span>
                      {link.type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                          {link.type}
                        </span>
                      )}
                      {isDefault && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 flex items-center gap-1">
                          <Star size={9} /> Dashboard
                        </span>
                      )}
                      {link.synthetic && (
                        <span className="text-[10px] text-amber-500">Preview</span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium capitalize">{link.status}</span>
                      {" · "}
                      <span className="text-foreground font-medium">
                        {link.isp || "No ISP set"}
                      </span>
                      {link.publicIp ? (
                        <span className="font-mono"> · {link.publicIp}</span>
                      ) : null}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">↓ </span>
                        <span className="text-primary font-medium">
                          {speedLabel(down, { synthetic: link.synthetic, hasTest: !!test })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">↑ </span>
                        <span className="text-emerald-500 font-medium">
                          {speedLabel(up, { synthetic: link.synthetic, hasTest: !!test })}
                        </span>
                      </div>
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
                      {(test?.latencyMs ?? link.latencyMs) != null && (
                        <div>
                          <span className="text-muted-foreground">Latency </span>
                          <span className="text-foreground">
                            {test?.latencyMs ?? link.latencyMs} ms
                          </span>
                        </div>
                      )}
                      {test?.testedAt && (
                        <div className="text-muted-foreground">
                          Tested {formatRelativeTime(test.testedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
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
