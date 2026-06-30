import { useMemo, useState } from "react";
import {
  Globe,
  Plus,
  Server,
  X,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { buildWanLinks } from "@/lib/wan/wanManagementSettings";
import { formatSpeedMbps } from "@/lib/snmp/snmpAnalytics";
import { runWanSpeedTest } from "@/api/wanApi";
import {
  getEquipmentIp,
  detectIntegrationVendor,
  detectDeviceRole,
} from "@/lib/snmp/snmpSwitchProfiles";
import { DEVICE_ROLE_LABELS, getVendorInfo } from "@/lib/integrations/vendorRegistry";
import WanLinkEditDrawer from "./WanLinkEditDrawer";
import WanRouterDetailPanel from "./WanRouterDetailPanel";

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function SnmpWanManagementPanel({
  snmpState,
  equipment,
  wanManagement,
  onSaveWanManagement,
  onAssignRouter,
  onUnassignRouter,
  onPollRouter,
  pollingRouterId,
  onSelectRouter,
}) {
  const [editLink, setEditLink] = useState(null);
  const [testingKey, setTestingKey] = useState(null);
  const [speedTests, setSpeedTests] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const wan = useMemo(
    () => buildWanLinks(snmpState, equipment, wanManagement),
    [snmpState, equipment, wanManagement]
  );

  const assignedIds = wanManagement?.assignedRouterEquipmentIds || [];
  const equipmentById = useMemo(
    () => new Map((equipment || []).map((e) => [e.id, e])),
    [equipment]
  );

  const assignedEquipment = useMemo(
    () =>
      assignedIds
        .map((id) => equipmentById.get(id))
        .filter(Boolean),
    [assignedIds, equipmentById]
  );

  const grouped = useMemo(() => {
    const map = new Map();
    for (const link of wan.links) {
      const groupKey = link.profileId || link.routerName || "manual";
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          profileId: link.profileId,
          equipmentId: link.equipmentId,
          routerName: link.routerName,
          routerIp: link.routerIp,
          routerModel: link.routerModel,
          routerVendor: link.routerVendor,
          links: [],
        });
      }
      map.get(groupKey).links.push(link);
    }
    return [...map.values()];
  }, [wan.links]);

  const profilesById = useMemo(
    () => new Map((snmpState?.profiles || []).map((p) => [p.id, p])),
    [snmpState]
  );

  const handleSaveLink = async (linkKey, patch, isManual) => {
    const next = { ...wanManagement, linkOverrides: { ...wanManagement.linkOverrides } };

    if (isManual) {
      const manualId = linkKey.replace(/^manual:/, "");
      next.manualLinks = (wanManagement.manualLinks || []).map((m) =>
        m.id === manualId ? { ...m, ...patch } : m
      );
    } else {
      next.linkOverrides[linkKey] = {
        ...(wanManagement.linkOverrides[linkKey] || {}),
        ...patch,
      };
    }

    await onSaveWanManagement(next);
    setEditLink(null);
    toast.success("WAN link saved");
  };

  const handleAddManual = async () => {
    const id = `manual-${Date.now()}`;
    const next = {
      ...wanManagement,
      manualLinks: [
        ...(wanManagement.manualLinks || []),
        {
          id,
          routerName: "Manual router",
          name: "New WAN",
          type: "wan",
          isp: "",
          priority: "backup",
          status: "online",
          enabled: true,
        },
      ],
    };
    await onSaveWanManagement(next);
    setEditLink({ key: `manual:${id}`, source: "manual", manualId: id, isNew: true });
  };

  const handleDeleteManual = async (manualId) => {
    const next = {
      ...wanManagement,
      manualLinks: (wanManagement.manualLinks || []).filter((m) => m.id !== manualId),
    };
    await onSaveWanManagement(next);
    toast.success("Manual WAN link removed");
  };

  const handleSetDefault = async (linkKey) => {
    await onSaveWanManagement({
      ...wanManagement,
      defaultDashboardLink: linkKey,
    });
    toast.success("Default dashboard WAN updated");
  };

  const handleSpeedTest = async (link) => {
    if (!link.profileId || link.portIndex == null) {
      toast.error("Speed test requires a polled router link");
      return;
    }
    setTestingKey(link.key);
    try {
      const result = await runWanSpeedTest({
        profileId: link.profileId,
        portIndex: link.portIndex,
        portName: link.portName || link.name,
      });
      setSpeedTests((prev) => ({ ...prev, [link.key]: result }));
      toast.success(`Speed test: ↓${result.downloadMbps} ↑${result.uploadMbps} Mbps`);
    } catch (err) {
      toast.error(err.message || "Speed test failed");
    } finally {
      setTestingKey(null);
    }
  };

  const openEditor = (link) => {
    const override = wanManagement.linkOverrides?.[link.key] || {};
    const manual =
      link.source === "manual"
        ? wanManagement.manualLinks?.find((m) => m.id === link.manualId)
        : null;
    setEditLink({
      ...link,
      override,
      manual,
    });
  };

  const handleAssignRouter = async (eq) => {
    if (!onAssignRouter) {
      toast.error("Router assignment not available");
      return;
    }
    try {
      await onAssignRouter(eq);
      toast.success(`${eq.name} assigned as WAN router`);
      setPickerOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to assign router");
    }
  };

  const handleUnassignRouter = async (equipmentId) => {
    if (!onUnassignRouter) return;
    const eq = equipmentById.get(equipmentId);
    if (!window.confirm(`Unassign ${eq?.name || equipmentId} from WAN management?`)) return;
    try {
      await onUnassignRouter(equipmentId);
      toast.success("Router unassigned from WAN management");
    } catch (err) {
      toast.error(err.message || "Failed to unassign router");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Globe size={18} className="text-primary" />
            WAN management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign routers from Equipment, then manage ISP details, priorities, and live telemetry
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground rounded-xl px-3 py-2 hover:opacity-90"
          >
            <Plus size={14} /> Assign WAN router
          </button>
          <button
            type="button"
            onClick={handleAddManual}
            className="flex items-center gap-1.5 text-sm border border-border rounded-xl px-3 py-2 hover:border-primary/40"
          >
            <Plus size={14} /> Add manual link
          </button>
        </div>
      </div>

      <AssignedRoutersBar
        assigned={assignedEquipment}
        profilesById={profilesById}
        onUnassign={handleUnassignRouter}
        onSelect={onSelectRouter}
        onAdd={() => setPickerOpen(true)}
      />

      {wan.synthetic && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Preview data — poll the assigned WAN routers in Fleet to capture live readings.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="WAN links" value={wan.summary.total} sub={`${wan.summary.online} online`} />
        <KpiCard
          label="Offline"
          value={wan.summary.offline}
          accent={wan.summary.offline > 0 ? "text-red-400" : "text-emerald-400"}
        />
        <KpiCard label="Primary ISP" value={wan.summary.primaryIsp} sub="Active primary path" />
        <KpiCard
          label="Live download"
          value={formatSpeedMbps(wan.summary.aggregateDownMbps)}
          sub="Sum of online links"
          accent="text-primary"
        />
        <KpiCard
          label="Live upload"
          value={formatSpeedMbps(wan.summary.aggregateUpMbps)}
          sub="Sum of online links"
          accent="text-emerald-400"
        />
      </div>

      {wan.links.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center border border-border">
          <Globe size={40} className="mx-auto text-muted-foreground mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground">No WAN links yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Assign one or more routers from your Equipment list, or add a manual WAN link for shore
            circuits, VSAT, or LTE providers managed outside the platform.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus size={14} /> Assign WAN router
            </button>
            <button
              type="button"
              onClick={handleAddManual}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:border-primary/40"
            >
              <Plus size={14} /> Add manual WAN link
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => {
            const profile = group.profileId ? profilesById.get(group.profileId) : null;
            const eq = group.equipmentId ? equipmentById.get(group.equipmentId) : null;
            return (
              <WanRouterDetailPanel
                key={group.profileId || group.routerName}
                group={group}
                profile={profile}
                equipment={eq}
                wanManagement={wanManagement}
                defaultDashboardLink={wan.defaultDashboardLink}
                speedTests={speedTests}
                testingKey={testingKey}
                pollingRouterId={pollingRouterId}
                onPollRouter={onPollRouter}
                onSelectRouter={onSelectRouter}
                onSetDefault={handleSetDefault}
                onSpeedTest={handleSpeedTest}
                onEditLink={openEditor}
                onDeleteManual={handleDeleteManual}
              />
            );
          })}
        </div>
      )}

      {editLink && (
        <WanLinkEditDrawer
          link={editLink}
          onSave={(patch) =>
            handleSaveLink(
              editLink.key,
              patch,
              editLink.source === "manual"
            )
          }
          onClose={() => setEditLink(null)}
        />
      )}

      {pickerOpen && (
        <WanRouterPickerModal
          equipment={equipment}
          assignedIds={assignedIds}
          onPick={handleAssignRouter}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function AssignedRoutersBar({ assigned, profilesById, onUnassign, onSelect, onAdd }) {
  if (!assigned.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">No WAN routers assigned yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick a router from your Equipment inventory to start monitoring WAN links.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 text-sm bg-primary text-primary-foreground rounded-xl px-3 py-2 hover:opacity-90 self-start sm:self-auto"
        >
          <Plus size={14} /> Assign router
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Assigned WAN routers ({assigned.length})
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {assigned.map((eq) => {
          const profile = [...profilesById.values()].find((p) => p.equipmentId === eq.id);
          const polled = !!profile?.lastPoll;
          return (
            <div
              key={eq.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5"
            >
              <Server size={12} className={polled ? "text-emerald-400" : "text-muted-foreground"} />
              <button
                type="button"
                onClick={() => profile && onSelect?.(profile.id)}
                className="text-xs font-medium text-foreground hover:text-primary truncate max-w-[180px]"
                title={`${eq.name} · ${eq.model || "no model"} · ${eq.ip || "no IP"}`}
              >
                {eq.name}
              </button>
              <span className="text-[10px] text-muted-foreground">
                {eq.make || detectIntegrationVendor(eq)}
              </span>
              <button
                type="button"
                title="Unassign router"
                onClick={() => onUnassign(eq.id)}
                className="text-muted-foreground hover:text-red-400"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WanRouterPickerModal({ equipment, assignedIds, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const assignedSet = new Set(assignedIds || []);

  const candidates = (equipment || [])
    .filter((eq) => !assignedSet.has(eq.id))
    .filter((eq) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const blob = `${eq.name} ${eq.model} ${eq.make} ${getEquipmentIp(eq)} ${eq.category}`.toLowerCase();
      return blob.includes(q);
    })
    .sort((a, b) => {
      const aNet = (a.category || "").toLowerCase() === "network";
      const bNet = (b.category || "").toLowerCase() === "network";
      if (aNet !== bNet) return aNet ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Assign WAN router</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick equipment to manage as a WAN uplink. Auto-registers in Core Network fleet.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Equipment by name, model, IP, vendor…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-secondary/30 text-foreground"
            />
          </div>
        </div>
        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {assignedSet.size === (equipment || []).length
                ? "Every equipment row is already assigned."
                : "No matching equipment. Try a different search."}
            </p>
          ) : (
            candidates.map((eq) => {
              const ip = getEquipmentIp(eq);
              const role = detectDeviceRole(eq);
              const vendor = detectIntegrationVendor(eq);
              const vendorInfo = getVendorInfo(vendor);
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => onPick(eq)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{eq.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                      {DEVICE_ROLE_LABELS[role] || eq.category || "Device"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {ip || "No IP — add in Equipment before polling"}
                  </p>
                  {(eq.model || vendorInfo?.label) && (
                    <p className="text-xs text-muted-foreground">
                      {eq.model || vendorInfo.label}
                      {vendorInfo?.label && eq.model && (
                        <span className="text-muted-foreground/70"> · {vendorInfo.label}</span>
                      )}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
