import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cpu,
  Plus,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import CiscoSwitchList from "@/components/cisco/CiscoSwitchList";
import CiscoSwitchWorkspace from "@/components/cisco/CiscoSwitchWorkspace";
import CiscoConnectionModal from "@/components/cisco/CiscoConnectionModal";
import {
  addCiscoSwitch,
  listCiscoSwitches,
  removeCiscoSwitch,
  saveCiscoSwitch,
} from "@/api/ciscoApi";
import { NETWORK_CISCO_SWITCHES_CHANGED_EVENT } from "@/lib/network/ciscoSwitchSettings";
import { useSystemDataOptional } from "@/contexts/SystemDataContext";

/**
 * Cisco Switches page — dedicated workspace for managing C1300 / CBS350
 * switches via SSH + SNMP. Layout mirrors the Lights and Shades page:
 * header with credentials button + add switch, left rail of saved
 * switches, right workspace with per-switch tabs (Overview, Interfaces,
 * Connected devices, Activity).
 */
export default function CiscoSwitchesPage({ embedded = false }) {
  const [switches, setSwitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSwitch, setEditSwitch] = useState(null);

  const systemData = useSystemDataOptional();
  const equipment = systemData?.sources?.equipment || [];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await listCiscoSwitches();
      setSwitches(payload.switches || []);
      setActiveId((prev) => {
        if (prev && payload.switches?.find((s) => s.id === prev)) return prev;
        return payload.switches?.[0]?.id || null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (e) => {
      if (e?.detail?.switches) {
        setSwitches(e.detail.switches);
        setActiveId((prev) => {
          if (prev && e.detail.switches.find((s) => s.id === prev)) return prev;
          return e.detail.switches[0]?.id || null;
        });
      } else {
        refresh();
      }
    };
    window.addEventListener(NETWORK_CISCO_SWITCHES_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(NETWORK_CISCO_SWITCHES_CHANGED_EVENT, onChange);
  }, [refresh]);

  const activeSwitch = useMemo(
    () => switches.find((s) => s.id === activeId) || null,
    [switches, activeId]
  );

  const stats = useMemo(() => {
    const total = switches.length;
    const online = switches.filter((s) => s.enabled && s.lastConnectedAt && !s.lastError).length;
    const offline = switches.filter((s) => s.enabled && (!s.lastConnectedAt || s.lastError)).length;
    return { total, online, offline };
  }, [switches]);

  function openAdd() {
    setEditSwitch(null);
    setModalOpen(true);
  }

  function openEdit(sw) {
    setEditSwitch(sw);
    setModalOpen(true);
  }

  async function handleSave(draft) {
    if (draft.id && switches.some((s) => s.id === draft.id)) {
      const next = await saveCiscoSwitch(draft);
      setSwitches(next.switches || []);
      setActiveId(draft.id);
      return next;
    }
    const next = await addCiscoSwitch(draft);
    setSwitches(next.switches || []);
    // Activate the newly added switch.
    const newest =
      next.switches?.find((s) => s.host === draft.host) ||
      next.switches?.[next.switches.length - 1];
    if (newest) setActiveId(newest.id);
    return next;
  }

  async function handleDelete(sw) {
    if (!sw?.id) return;
    const next = await removeCiscoSwitch(sw.id);
    setSwitches(next.switches || []);
    if (activeId === sw.id) {
      setActiveId(next.switches?.[0]?.id || null);
    }
  }

  return (
    <div
      className={
        embedded
          ? "min-h-[calc(100vh-14rem)] bg-background flex flex-col"
          : "h-full bg-background flex flex-col"
      }
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/90 backdrop-blur-xl flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-sky-500/12 flex items-center justify-center ring-1 ring-sky-500/20 flex-shrink-0">
            <Cpu size={16} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground leading-none">
              Cisco Switches
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Catalyst 1300 · CBS350 · SG350 — SSH + SNMP live monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {stats.total > 0 && (
            <div className="hidden md:inline-flex items-center gap-3 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 size={11} />
                {stats.online} online
              </span>
              {stats.offline > 0 && (
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                  <AlertCircle size={11} />
                  {stats.offline} offline
                </span>
              )}
              <span className="text-muted-foreground">
                · {stats.total} total
              </span>
            </div>
          )}
          {activeSwitch && (
            <button
              onClick={() => openEdit(activeSwitch)}
              title="Edit credentials for the selected switch"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activeSwitch?.enabled && activeSwitch?.lastConnectedAt
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <KeyRound size={12} />
              <span className="hidden sm:inline">Credentials</span>
              <span className="sm:hidden">Creds</span>
            </button>
          )}
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs font-semibold text-sky-400 hover:bg-sky-500/25"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Add switch</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CiscoSwitchList
              switches={switches}
              activeId={activeId}
              onSelect={setActiveId}
              onEdit={openEdit}
            />
            <CiscoSwitchWorkspace
              switchRecord={activeSwitch}
              equipment={equipment}
            />
          </>
        )}
      </div>

      <CiscoConnectionModal
        open={modalOpen}
        switchRecord={editSwitch}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
