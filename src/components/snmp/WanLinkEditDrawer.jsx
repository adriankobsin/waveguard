import { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import {
  WAN_PRIORITIES,
  WAN_LINK_TYPES,
  DEFAULT_WAN_LINK_OVERRIDE,
} from "@/lib/wan/wanManagementSettings";

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40";

export default function WanLinkEditDrawer({ link, onSave, onClose }) {
  const isManual = link.source === "manual";
  const base = isManual ? link.manual || link : link.override || {};

  const [form, setForm] = useState(() => ({
    ...DEFAULT_WAN_LINK_OVERRIDE,
    label: base.label || link.name || "",
    isp: base.isp || link.isp || "",
    providerAccount: base.providerAccount || link.providerAccount || "",
    providerContact: base.providerContact || link.providerContact || "",
    providerPhone: base.providerPhone || link.providerPhone || "",
    providerEmail: base.providerEmail || link.providerEmail || "",
    priority: base.priority || link.priority || "backup",
    enabled: base.enabled !== false,
    notes: base.notes || link.notes || "",
    publicIpOverride: base.publicIpOverride || base.publicIp || link.publicIp || "",
    gatewayOverride: base.gatewayOverride || base.gateway || link.gateway || "",
    dnsOverride: base.dnsOverride || base.dns || link.dns || "",
    contractDownMbps: base.contractDownMbps ?? link.contractDownMbps ?? "",
    contractUpMbps: base.contractUpMbps ?? link.contractUpMbps ?? "",
    ...(isManual
      ? {
          routerName: base.routerName || link.routerName || "",
          name: base.name || link.name || "",
          type: base.type || link.type || "wan",
          status: base.status || link.status || "online",
          downloadMbps: base.downloadMbps ?? link.downloadMbps ?? "",
          uploadMbps: base.uploadMbps ?? link.uploadMbps ?? "",
          linkSpeedMbps: base.linkSpeedMbps ?? link.linkSpeedMbps ?? "",
          carrier: base.carrier || link.carrier || "",
        }
      : {}),
  }));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isManual) {
        await onSave({
          routerName: form.routerName,
          name: form.name,
          type: form.type,
          isp: form.isp,
          providerAccount: form.providerAccount,
          providerContact: form.providerContact,
          providerPhone: form.providerPhone,
          providerEmail: form.providerEmail,
          priority: form.priority,
          enabled: form.enabled,
          notes: form.notes,
          publicIp: form.publicIpOverride,
          gateway: form.gatewayOverride,
          dns: form.dnsOverride,
          contractDownMbps: form.contractDownMbps === "" ? null : Number(form.contractDownMbps),
          contractUpMbps: form.contractUpMbps === "" ? null : Number(form.contractUpMbps),
          status: form.status,
          downloadMbps: form.downloadMbps === "" ? 0 : Number(form.downloadMbps),
          uploadMbps: form.uploadMbps === "" ? 0 : Number(form.uploadMbps),
          linkSpeedMbps: form.linkSpeedMbps === "" ? 0 : Number(form.linkSpeedMbps),
          carrier: form.carrier,
        });
      } else {
        await onSave({
          label: form.label,
          isp: form.isp,
          providerAccount: form.providerAccount,
          providerContact: form.providerContact,
          providerPhone: form.providerPhone,
          providerEmail: form.providerEmail,
          priority: form.priority,
          enabled: form.enabled,
          notes: form.notes,
          publicIpOverride: form.publicIpOverride,
          gatewayOverride: form.gatewayOverride,
          dnsOverride: form.dnsOverride,
          contractDownMbps: form.contractDownMbps === "" ? null : Number(form.contractDownMbps),
          contractUpMbps: form.contractUpMbps === "" ? null : Number(form.contractUpMbps),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">Edit WAN link</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isManual ? "Manual ISP entry" : `${link.routerName} · ${link.portName}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isManual && (
            <>
              <Field label="Router / device name">
                <input className={inputCls} value={form.routerName} onChange={(e) => set({ routerName: e.target.value })} />
              </Field>
              <Field label="Link name">
                <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label="Link type">
                <select className={inputCls} value={form.type} onChange={(e) => set({ type: e.target.value })}>
                  {WAN_LINK_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {!isManual && (
            <Field label="Display label" hint="Overrides the port name on dashboards">
              <input className={inputCls} value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder={link.portName} />
            </Field>
          )}

          <Field label="ISP / provider">
            <input className={inputCls} value={form.isp} onChange={(e) => set({ isp: e.target.value })} placeholder="e.g. Starlink Maritime" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select className={inputCls} value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                {WAN_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Monitoring">
              <select
                className={inputCls}
                value={form.enabled ? "enabled" : "disabled"}
                onChange={(e) => set({ enabled: e.target.value === "enabled" })}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </Field>
          </div>

          <div className="rounded-xl border border-border p-3 space-y-3">
            <p className="text-xs font-semibold text-foreground">Network details</p>
            <Field label="Public IP">
              <input className={`${inputCls} font-mono`} value={form.publicIpOverride} onChange={(e) => set({ publicIpOverride: e.target.value })} />
            </Field>
            <Field label="Gateway">
              <input className={`${inputCls} font-mono`} value={form.gatewayOverride} onChange={(e) => set({ gatewayOverride: e.target.value })} />
            </Field>
            <Field label="DNS">
              <input className={`${inputCls} font-mono`} value={form.dnsOverride} onChange={(e) => set({ dnsOverride: e.target.value })} />
            </Field>
          </div>

          <div className="rounded-xl border border-border p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Provider / contract</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Stored with the link — not shown on the main WAN list
              </p>
            </div>
            <Field label="Account / circuit ID">
              <input className={inputCls} value={form.providerAccount} onChange={(e) => set({ providerAccount: e.target.value })} />
            </Field>
            <Field label="Contact name">
              <input className={inputCls} value={form.providerContact} onChange={(e) => set({ providerContact: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input className={inputCls} value={form.providerPhone} onChange={(e) => set({ providerPhone: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className={inputCls} type="email" value={form.providerEmail} onChange={(e) => set({ providerEmail: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contract ↓ Mbps">
                <input className={inputCls} type="number" min={0} value={form.contractDownMbps} onChange={(e) => set({ contractDownMbps: e.target.value })} />
              </Field>
              <Field label="Contract ↑ Mbps">
                <input className={inputCls} type="number" min={0} value={form.contractUpMbps} onChange={(e) => set({ contractUpMbps: e.target.value })} />
              </Field>
            </div>
          </div>

          {isManual && (
            <div className="rounded-xl border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground">Manual readings</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Download Mbps">
                  <input className={inputCls} type="number" min={0} step={0.1} value={form.downloadMbps} onChange={(e) => set({ downloadMbps: e.target.value })} />
                </Field>
                <Field label="Upload Mbps">
                  <input className={inputCls} type="number" min={0} step={0.1} value={form.uploadMbps} onChange={(e) => set({ uploadMbps: e.target.value })} />
                </Field>
              </div>
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="warning">Warning</option>
                </select>
              </Field>
            </div>
          )}

          <Field label="Notes">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="SIM ICCID, shore handover, contract renewal, etc."
            />
          </Field>
        </form>

        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save link"}
          </button>
        </div>
      </div>
    </div>
  );
}
