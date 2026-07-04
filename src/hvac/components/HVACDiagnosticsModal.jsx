import { useState } from "react";
import { X, Loader2, AlertTriangle, Clock, Wifi, Server } from "lucide-react";

export default function HVACDiagnosticsModal({ zoneId, onClose }) {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useState(() => {
    (async () => {
      try {
        const { fetchZoneDiagnostics } = await import("@/api/hvacApi");
        const data = await fetchZoneDiagnostics(zoneId);
        setDiagnostics(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Server size={14} /> Diagnostics: {zoneId}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 size={14} className="animate-spin" /> Loading diagnostics…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          {diagnostics && (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <DetailBox label="Protocol" value={diagnostics.protocol} icon={<Wifi size={12} />} />
                <DetailBox label="Manufacturer" value={diagnostics.manufacturer} icon={<Server size={12} />} />
                <DetailBox label="Connection State" value={diagnostics.connectionState} highlight={diagnostics.connectionState === "error" ? "text-red-400" : diagnostics.connectionState === "connected" ? "text-emerald-400" : "text-amber-400"} />
                <DetailBox label="Retry Count" value={String(diagnostics.retryCount)} />
                <DetailBox label="Last Communication" value={diagnostics.lastCommunicationTime ? new Date(diagnostics.lastCommunicationTime).toLocaleString() : "—"} icon={<Clock size={12} />} />
                <DetailBox label="Last Successful Read" value={diagnostics.lastSuccessfulRead ? new Date(diagnostics.lastSuccessfulRead).toLocaleString() : "—"} />
              </div>

              {diagnostics.lastErrorMessage && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">
                  <AlertTriangle size={12} /> {diagnostics.lastErrorMessage}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Raw Protocol Data</p>
                <pre className="text-[10px] font-mono text-muted-foreground bg-secondary rounded-xl p-3 overflow-x-auto max-h-48">
                  {JSON.stringify(diagnostics.rawValues, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBox({ label, value, icon, highlight }) {
  return (
    <div className="bg-secondary/50 rounded-xl px-3 py-2.5 border border-border/50">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
        {icon} {label}
      </div>
      <p className={`text-sm font-mono font-medium ${highlight || "text-foreground"}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}
