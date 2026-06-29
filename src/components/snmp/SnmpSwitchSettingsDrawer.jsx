import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings, Trash2, X, ExternalLink, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import LocationPicker from "@/components/location/LocationPicker";
import { parseSwitchModel, resolveSwitchChassis } from "@/lib/snmp/switchModelCatalog";
import {
  resolveDeviceChassis,
  getEquipmentIp,
  DEVICE_ROLES,
  INTEGRATION_VENDORS,
  POLL_METHODS,
} from "@/lib/snmp/snmpSwitchProfiles";
import { resolveEquipmentModelString } from "@/lib/snmp/networkDeviceCatalog";
import { getVendorInfo, DEVICE_ROLE_LABELS, VENDOR_REGISTRY } from "@/lib/integrations/vendorRegistry";
import { testPeplinkConnection } from "@/api/snmpSwitchApi";
import { listCredentials } from "@/api/credentialsApi";
import { findCredentialForEquipment } from "@/lib/credentials/credentialsVault";
import { matchPeplinkDevice, getPeplinkDefaultLogin } from "@/lib/integrations/peplink/peplinkDeviceCatalog";

function equipmentToDraft(eq) {
  if (!eq) {
    return { name: "", make: "", model: "", ip: "", mac: "", serial: "", category: "Network" };
  }
  return {
    name: eq.name || "",
    make: eq.make || eq.vendor || "",
    model: eq.model || "",
    ip: getEquipmentIp(eq),
    mac: eq.mac || "",
    serial: eq.serial || "",
    category: eq.category || "Network",
  };
}

export default function SnmpSwitchSettingsDrawer({
  profile,
  equipment,
  discovery,
  onSave,
  onRemove,
  onClose,
}) {
  const [draft, setDraft] = useState(profile);
  const [eqDraft, setEqDraft] = useState(() => equipmentToDraft(equipment));
  const [testingPeplink, setTestingPeplink] = useState(false);
  useEffect(() => {
    setDraft(profile);
    setEqDraft(equipmentToDraft(equipment));
    if (!profile?.equipmentId) return;
    listCredentials().then((creds) => {
      const linked = findCredentialForEquipment(
        creds,
        profile.equipmentId,
        profile.integrationVendor === "peplink" ? "peplink" : "web"
      );
      if (linked) {
        setDraft((d) => ({
          ...d,
          browserLogin: {
            loginUrl: linked.loginUrl || d.browserLogin?.loginUrl,
            username: linked.username || d.browserLogin?.username,
            password: linked.password || d.browserLogin?.password,
            credentialId: linked.id,
          },
        }));
      } else if (!profile.browserLogin?.username && equipment) {
        const pep = matchPeplinkDevice(equipment);
        if (pep) {
          const login = getPeplinkDefaultLogin(pep);
          const ip = getEquipmentIp(equipment);
          setDraft((d) => ({
            ...d,
            browserLogin: {
              loginUrl: ip ? `https://${ip}/` : "",
              username: login.username,
              password: login.password,
              credentialId: "",
            },
          }));
        }
      }
    });
  }, [profile, equipment]);
  if (!draft) return null;

  const mergedEq = equipment ? { ...equipment, ...eqDraft, ip: eqDraft.ip } : { ...eqDraft };
  const chassis = resolveDeviceChassis(mergedEq, draft) || resolveSwitchChassis(mergedEq, draft);
  const resolvedModel = resolveEquipmentModelString(mergedEq);
  const modelSpec = parseSwitchModel(resolvedModel || mergedEq.model);
  const pepCatalog = matchPeplinkDevice(mergedEq);
  const vendorInfo = getVendorInfo(draft.integrationVendor);
  const isPeplink = draft.integrationVendor === "peplink";
  const isStubVendor = vendorInfo?.comingSoon;

  const runPeplinkTest = async () => {
    setTestingPeplink(true);
    try {
      const res = await testPeplinkConnection(draft.equipmentId, draft);
      if (res.success) {
        toast.success(
          `Peplink OK — ${res.portCount} interface(s) via ${res.source}${res.online === false ? " (offline)" : ""}`
        );
      } else {
        toast.error(res.error || "Peplink test failed");
      }
    } catch (err) {
      toast.error(err.message || "Peplink test failed");
    } finally {
      setTestingPeplink(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Settings size={16} /> Device configuration
        </h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled !== false}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-foreground">Include in scheduled / fleet polls</span>
        </label>

        <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Integration
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              Vendor
              <select
                value={draft.integrationVendor || "snmp"}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    integrationVendor: e.target.value,
                    pollMethod:
                      e.target.value === "peplink"
                        ? "peplink_hybrid"
                        : e.target.value === "cisco"
                        ? "cisco_ssh"
                        : "snmp",
                  }))
                }
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-sm"
              >
                {INTEGRATION_VENDORS.map((v) => {
                  const info = VENDOR_REGISTRY[v];
                  return (
                    <option key={v} value={v}>
                      {info?.label || v}
                      {info?.comingSoon ? " (preview)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Device role
              <select
                value={draft.deviceRole || "switch"}
                onChange={(e) => setDraft((d) => ({ ...d, deviceRole: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-sm"
              >
                {DEVICE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {DEVICE_ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Poll method
              <select
                value={draft.pollMethod || "snmp"}
                onChange={(e) => setDraft((d) => ({ ...d, pollMethod: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-sm"
              >
                {POLL_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm === "peplink_hybrid"
                      ? "Peplink hybrid (SNMP + REST)"
                      : pm === "cisco_ssh"
                      ? "Cisco SSH + SNMP"
                      : "SNMP only"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              SNMP version
              <select
                value={draft.snmpVersion || "2c"}
                onChange={(e) => setDraft((d) => ({ ...d, snmpVersion: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-sm"
              >
                <option value="2c">v2c</option>
                <option value="3">v3</option>
              </select>
            </label>
          </div>
          {isStubVendor && (
            <p className="text-xs text-amber-400/90">
              {vendorInfo?.label} support is in preview — SNMP polling works, REST adapter coming in Phase 2.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Equipment</p>
          <label className="block text-xs text-muted-foreground">
            Name
            <input
              value={eqDraft.name}
              onChange={(e) => setEqDraft((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              Make / vendor
              <input
                value={eqDraft.make}
                onChange={(e) => setEqDraft((d) => ({ ...d, make: e.target.value }))}
                placeholder="Peplink"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Model (SKU)
              <input
                value={eqDraft.model}
                onChange={(e) => setEqDraft((d) => ({ ...d, model: e.target.value }))}
                placeholder="Balance 2500 EC"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="block text-xs text-muted-foreground col-span-2">
              IP address
              <input
                value={eqDraft.ip}
                onChange={(e) => {
                  const ip = e.target.value;
                  setEqDraft((d) => ({ ...d, ip }));
                  setDraft((p) => ({
                    ...p,
                    browserLogin: {
                      ...p.browserLogin,
                      loginUrl: ip ? `https://${ip.replace(/^https?:\/\//, "")}/` : p.browserLogin?.loginUrl,
                    },
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              MAC
              <input
                value={eqDraft.mac}
                onChange={(e) => setEqDraft((d) => ({ ...d, mac: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Serial
              <input
                value={eqDraft.serial}
                onChange={(e) => setEqDraft((d) => ({ ...d, serial: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </label>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs">
            {chassis ? (
              <>
                <p className="text-muted-foreground">Recognized chassis</p>
                <p className="font-medium text-foreground mt-0.5">{chassis.label}</p>
                {pepCatalog && (
                  <p className="text-primary/90 mt-1">Peplink catalog · SKU {pepCatalog.sku}</p>
                )}
              </>
            ) : (
              <p className="text-amber-400/90">
                Model not in catalog — use Peplink Balance 2500 EC, MAX BR1 Pro, or MAX BR2 Pro.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Browser login (saved to credentials vault)
          </p>
          <label className="block text-xs text-muted-foreground">
            Login URL
            <input
              value={draft.browserLogin?.loginUrl || ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  browserLogin: { ...d.browserLogin, loginUrl: e.target.value },
                }))
              }
              placeholder="https://192.168.1.1/"
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              Username
              <input
                value={draft.browserLogin?.username || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    browserLogin: { ...d.browserLogin, username: e.target.value },
                  }))
                }
                placeholder="admin"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Password
              <input
                type="password"
                value={draft.browserLogin?.password || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    browserLogin: { ...d.browserLogin, password: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Peplink default: username <code className="text-foreground">admin</code>, blank password until
            first-login wizard. Also editable in Settings → Login credentials.
          </p>
          <Link
            to="/settings?section=credentials"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink size={12} /> Open credentials vault
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Port override {modelSpec ? `(default ${modelSpec.portCount})` : ""}
            </label>
            <input
              type="number"
              min={1}
              max={128}
              placeholder={modelSpec ? String(modelSpec.portCount) : "From model"}
              value={draft.portCount ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, portCount: v === "" ? null : Number(v) }));
              }}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Poll interval override (sec)</label>
            <input
              type="number"
              min={60}
              placeholder="Platform default"
              value={draft.pollIntervalSec ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, pollIntervalSec: v === "" ? null : Number(v) }));
              }}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {isPeplink && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Radio size={12} className="text-primary" /> Peplink API
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Connection mode</label>
              <select
                value={draft.peplink?.mode || "auto"}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    peplink: { ...d.peplink, mode: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
              >
                <option value="auto">Auto (local then InControl)</option>
                <option value="local">On-device REST API</option>
                <option value="incontrol">InControl 2 only</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">InControl organization ID</label>
              <input
                value={draft.peplink?.incontrolOrgId || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    peplink: { ...d.peplink, incontrolOrgId: e.target.value },
                  }))
                }
                placeholder="Org ID from InControl"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">InControl device ID</label>
              <input
                value={draft.peplink?.deviceId || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    peplink: { ...d.peplink, deviceId: e.target.value },
                  }))
                }
                placeholder="Device ID in InControl"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Local API client ID</label>
              <input
                value={draft.peplink?.localClientId || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    peplink: { ...d.peplink, localClientId: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Local API client secret</label>
              <input
                type="password"
                value={draft.peplink?.localClientSecret || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    peplink: {
                      ...d.peplink,
                      localClientSecret: e.target.value,
                      localClientSecretConfigured: !!e.target.value,
                    },
                  }))
                }
                placeholder={
                  draft.peplink?.localClientSecretConfigured ? "•••••••• (configured)" : "From device API settings"
                }
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              InControl API keys are stored in platform settings (mock-server). Enable SNMP on the device for
              hybrid interface polling.
            </p>
            <button
              type="button"
              onClick={runPeplinkTest}
              disabled={testingPeplink}
              className="w-full flex items-center justify-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-secondary/40 disabled:opacity-50"
            >
              {testingPeplink ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
              Test Peplink connection
            </button>
          </div>
        )}

        {draft.integrationVendor === "cisco" && (
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Radio size={12} className="text-sky-400" /> Cisco SSH integration
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">SSH user</label>
                <input
                  value={draft.cisco?.sshUsername || "cisco"}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      cisco: { ...d.cisco, sshUsername: e.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">SSH port</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={draft.cisco?.sshPort || 22}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      cisco: { ...d.cisco, sshPort: Number(e.target.value) || 22 },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Enable password (privilege 15)</label>
              <input
                type="password"
                value={draft.cisco?.enablePassword || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    cisco: { ...d.cisco, enablePassword: e.target.value },
                  }))
                }
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              SSH password is managed on the dedicated{" "}
              <Link to="/snmp?tab=cisco" className="text-sky-400 hover:underline">
                Cisco Switches
              </Link>{" "}
              page. This profile picks credentials up automatically once you add the switch there.
            </p>
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-2">Location</p>
          <LocationPicker
            dark={false}
            deckId={draft.deckId}
            roomId={draft.roomId}
            onChange={({ deckId, roomId, location }) =>
              setDraft((d) => ({ ...d, deckId, roomId, location }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">SNMP community</label>
            <input
              value={draft.snmpCommunity}
              placeholder={discovery.snmpCommunity || "public"}
              onChange={(e) => setDraft((d) => ({ ...d, snmpCommunity: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">SNMP version</label>
            <select
              value={draft.snmpVersion}
              onChange={(e) => setDraft((d) => ({ ...d, snmpVersion: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            >
              <option value="2c">v2c</option>
              <option value="3">v3</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm resize-none"
            placeholder="Rack position, WAN provider, cellular SIM, etc."
          />
        </div>

        <Link
          to="/equipment"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink size={12} /> Edit hardware record in Equipment
        </Link>
      </div>
      <div className="p-4 border-t border-border flex gap-2">
        <button
          type="button"
          onClick={() => onRemove(draft)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10"
        >
          <Trash2 size={14} /> Remove
        </button>
        <button
          type="button"
          onClick={() => onSave({ profile: draft, equipmentPatch: eqDraft })}
          className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}
