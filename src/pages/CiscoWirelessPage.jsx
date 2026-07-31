import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Radio,
  Plus,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import CiscoWlcList from "@/components/cisco/wireless/CiscoWlcList";
import CiscoWirelessWorkspace from "@/components/cisco/wireless/CiscoWirelessWorkspace";
import CiscoWlcConnectionModal from "@/components/cisco/wireless/CiscoWlcConnectionModal";
import {
  addCiscoWlcController,
  listCiscoWlcControllers,
  removeCiscoWlcController,
  saveCiscoWlcController,
} from "@/api/ciscoWlcApi";
import { NETWORK_CISCO_WLC_CHANGED_EVENT } from "@/lib/network/ciscoWlcSettings";

export default function CiscoWirelessPage({ embedded = false }) {
  const [controllers, setControllers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editController, setEditController] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await listCiscoWlcControllers();
      setControllers(payload.controllers || []);
      setActiveId((prev) => {
        if (prev && payload.controllers?.find((c) => c.id === prev)) return prev;
        return payload.controllers?.[0]?.id || null;
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
      if (e?.detail?.controllers) {
        setControllers(e.detail.controllers);
        setActiveId((prev) => {
          if (prev && e.detail.controllers.find((c) => c.id === prev)) return prev;
          return e.detail.controllers[0]?.id || null;
        });
      } else {
        refresh();
      }
    };
    window.addEventListener(NETWORK_CISCO_WLC_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(NETWORK_CISCO_WLC_CHANGED_EVENT, onChange);
  }, [refresh]);

  const activeController = useMemo(
    () => controllers.find((c) => c.id === activeId) || null,
    [controllers, activeId]
  );

  const stats = useMemo(() => {
    const snap = activeController?.lastSnapshot?.summary;
    return {
      apOnline: snap?.apOnline ?? 0,
      apOffline: snap?.apOffline ?? 0,
      wlanCount: snap?.wlanCount ?? 0,
    };
  }, [activeController]);

  function openAdd() {
    setEditController(null);
    setModalOpen(true);
  }

  function openEdit(ctrl) {
    setEditController(ctrl);
    setModalOpen(true);
  }

  async function handleSave(draft) {
    if (draft.id && controllers.some((c) => c.id === draft.id)) {
      const next = await saveCiscoWlcController(draft);
      setControllers(next.controllers || []);
      setActiveId(draft.id);
      return next;
    }
    const next = await addCiscoWlcController(draft);
    setControllers(next.controllers || []);
    const newest =
      next.controllers?.find((c) => c.host === draft.host) ||
      next.controllers?.[next.controllers.length - 1];
    if (newest) setActiveId(newest.id);
    return next;
  }

  async function handleDelete(ctrl) {
    if (!ctrl?.id) return;
    const next = await removeCiscoWlcController(ctrl.id);
    setControllers(next.controllers || []);
    if (activeId === ctrl.id) setActiveId(next.controllers?.[0]?.id || null);
    setModalOpen(false);
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
          <div className="w-9 h-9 rounded-xl bg-violet-500/12 flex items-center justify-center ring-1 ring-violet-500/20 flex-shrink-0">
            <Radio size={16} className="text-violet-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground leading-none">Wireless</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Catalyst 9800 WLC — RESTCONF AP &amp; SSID monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {activeController?.lastSnapshot && (
            <div className="hidden md:inline-flex items-center gap-3 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 size={11} />
                {stats.apOnline} APs online
              </span>
              {stats.apOffline > 0 && (
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                  <AlertCircle size={11} />
                  {stats.apOffline} offline
                </span>
              )}
              <span className="text-muted-foreground">· {stats.wlanCount} SSIDs</span>
            </div>
          )}
          {activeController && (
            <button
              onClick={() => openEdit(activeController)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold bg-secondary border-border text-muted-foreground hover:text-foreground"
            >
              <KeyRound size={12} />
              <span className="hidden sm:inline">Credentials</span>
            </button>
          )}
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-xs font-semibold text-violet-400 hover:bg-violet-500/25"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Add WLC</span>
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
            <CiscoWlcList
              controllers={controllers}
              activeId={activeId}
              onSelect={setActiveId}
              onEdit={openEdit}
            />
            <CiscoWirelessWorkspace controllerRecord={activeController} />
          </>
        )}
      </div>

      <CiscoWlcConnectionModal
        open={modalOpen}
        controllerRecord={editController}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
