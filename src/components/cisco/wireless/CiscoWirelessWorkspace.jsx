import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wifi, Radio, Bell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pollCiscoWlcSnapshot } from "@/api/ciscoWlcApi";
import { CISCO_WLC_LIVE_POLL_INTERVAL_MS } from "@/lib/network/ciscoWlcSettings";
import CiscoWirelessOverview from "./CiscoWirelessOverview";
import CiscoAccessPointTable from "./CiscoAccessPointTable";
import CiscoAccessPointDetail from "./CiscoAccessPointDetail";
import CiscoWlanTable from "./CiscoWlanTable";
import CiscoWirelessAlertsPanel from "./CiscoWirelessAlertsPanel";

export default function CiscoWirelessWorkspace({ controllerRecord }) {
  const [snapshot, setSnapshot] = useState(controllerRecord?.lastSnapshot || null);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState(null);
  const [selectedAp, setSelectedAp] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState("overview");

  useEffect(() => {
    setSnapshot(controllerRecord?.lastSnapshot || null);
    setPollError(controllerRecord?.lastError || null);
    setSelectedAp(null);
  }, [controllerRecord?.id, controllerRecord?.lastSnapshot]);

  const doPoll = useCallback(async () => {
    if (!controllerRecord?.host) return;
    setPolling(true);
    setPollError(null);
    try {
      const result = await pollCiscoWlcSnapshot(controllerRecord);
      if (result.success && result.snapshot) {
        setSnapshot(result.snapshot);
      } else {
        setPollError(result.message || result.error || "Poll failed");
      }
    } catch (err) {
      setPollError(err?.message || String(err));
    } finally {
      setPolling(false);
    }
  }, [controllerRecord]);

  useEffect(() => {
    if (!controllerRecord?.enabled || !controllerRecord?.host) return undefined;
    doPoll();
    const id = setInterval(doPoll, CISCO_WLC_LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [controllerRecord?.id, controllerRecord?.enabled, controllerRecord?.host, doPoll]);

  if (!controllerRecord) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <Radio size={40} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">No WLC selected</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Add a Catalyst 9800 wireless LAN controller to monitor access points, SSIDs,
            and VLAN subnets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-foreground">
            {controllerRecord.label || controllerRecord.host}
          </p>
          <p className="text-xs text-muted-foreground font-mono">{controllerRecord.host}</p>
        </div>
        <button
          type="button"
          onClick={doPoll}
          disabled={polling}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {polling ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Refresh
        </button>
      </div>

      {pollError && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-300">
          {pollError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        <Tabs value={workspaceTab} onValueChange={setWorkspaceTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="aps" className="gap-1.5 text-xs">
              <Radio size={12} /> Access points
            </TabsTrigger>
            <TabsTrigger value="ssids" className="gap-1.5 text-xs">
              <Wifi size={12} /> SSIDs
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5 text-xs">
              <Bell size={12} /> Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <CiscoWirelessOverview snapshot={snapshot} controller={controllerRecord.controller} />
          </TabsContent>
          <TabsContent value="aps" className="mt-0">
            <CiscoAccessPointTable
              accessPoints={snapshot?.accessPoints || []}
              onSelectAp={setSelectedAp}
            />
          </TabsContent>
          <TabsContent value="ssids" className="mt-0">
            <CiscoWlanTable wlans={snapshot?.wlans || []} />
          </TabsContent>
          <TabsContent value="alerts" className="mt-0">
            <CiscoWirelessAlertsPanel snapshot={snapshot} />
          </TabsContent>
        </Tabs>
      </div>

      {selectedAp && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedAp(null)}
          />
          <CiscoAccessPointDetail ap={selectedAp} onClose={() => setSelectedAp(null)} />
        </>
      )}
    </div>
  );
}
