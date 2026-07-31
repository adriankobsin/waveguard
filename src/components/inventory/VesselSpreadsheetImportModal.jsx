import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseAndBuildImport,
  SHEET_GROUPS,
  DEFAULT_FLOOR_MAP,
  readSpreadsheetToBuffer,
} from "@/lib/spreadsheet";
import { commitVesselSpreadsheetImport } from "@/api/vesselSpreadsheetImportApi";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";

const GROUP_LABELS = {
  [SHEET_GROUPS.deviceList]: "Device List (endpoints)",
  [SHEET_GROUPS.patchPanels]: "Patch Panels (cabling)",
  [SHEET_GROUPS.switchPorts]: "Switch port tables",
  [SHEET_GROUPS.appliance]: "WAN / Firewall / WLAN / PBX",
  [SHEET_GROUPS.ipScheme]: "IP Scheme (VLANs)",
  [SHEET_GROUPS.rack]: "Rack elevations",
  [SHEET_GROUPS.generic]: "Auto-detected sheets (custom columns)",
};

export default function VesselSpreadsheetImportModal({ isOpen, onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [payload, setPayload] = useState(null);
  const [enabledGroups, setEnabledGroups] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [result, setResult] = useState(null);
  const [replace, setReplace] = useState(false);

  const sheetSummary = useMemo(() => {
    if (!parsed?.sheets) return [];
    return parsed.sheets
      .filter((s) => !s.skipped)
      .map((s) => ({
        name: s.sheetName,
        type: s.sheetType,
        count: s.rowCount ?? 0,
      }));
  }, [parsed]);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setPayload(null);
    setEnabledGroups([]);
    setParseError(null);
    setResult(null);
    setReplace(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    setParseError(null);
    setParsed(null);
    setPayload(null);
    setEnabledGroups([]);
    try {
      const buffer = await readSpreadsheetToBuffer(file);
      // Import every sheet type present in the workbook (same pipeline as cable schedule).
      const { parsed: p, payload: pl, enabledGroups: groups } = parseAndBuildImport(buffer, {
        floorMap: DEFAULT_FLOOR_MAP,
      });
      setParsed(p);
      setPayload(pl);
      setEnabledGroups(groups || []);
      if (pl.stats.equipment === 0 && pl.stats.cables === 0) {
        setParseError(
          "No importable rows found. Expected sheets such as Device List, Patch Panels, switches, or appliances."
        );
      }
    } catch (err) {
      setParseError(err.message || "Failed to parse spreadsheet");
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!payload) return;
    if (replace && !window.confirm("Replace all existing equipment and cables before import?")) return;

    setCommitBusy(true);
    try {
      const commitResult = await commitVesselSpreadsheetImport(payload, {
        replace,
        enabledGroups,
      });
      setResult(commitResult);
      window.dispatchEvent(new CustomEvent(EQUIPMENT_CHANGED_EVENT));
      const vlanCount = payload.stats?.vlans ?? 0;
      toast.success(
        `Imported ${commitResult.equipmentCreated} new, updated ${commitResult.equipmentUpdated} equipment; ${commitResult.cablesCreated} cables` +
          (vlanCount ? `; ${vlanCount} discovery subnets` : "")
      );
      onComplete?.();
    } catch (err) {
      toast.error(err.message || "Import failed");
      setResult({ errors: [err.message] });
    } finally {
      setCommitBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-cyan-400" />
            Import vessel spreadsheet
          </DialogTitle>
          <DialogDescription>
            Upload the same vessel workbook used for cable schedules (.xlsx / .csv). Every sheet is
            scanned automatically — Device List, Patch Panels, switches, appliances, racks, and IP
            Scheme map into Equipment, cables, and schedules. Credential columns go to Settings →
            Login credentials.
          </DialogDescription>
        </DialogHeader>

        {!parsed && !result && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Select vessel workbook (.xlsx / .csv)</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block mx-auto text-xs text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-primary/15 file:text-primary"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              All sheets found in the document are imported together — the same mapping as
              Cables → Import patch schedule / Full vessel import.
            </p>

            {parseError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle size={12} />
                {parseError}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={!file || busy}>
                {busy && <Loader2 size={14} className="animate-spin mr-2" />}
                Preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {parsed && payload && !result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-2xl font-bold text-foreground">{payload.stats.equipment}</p>
                <p className="text-xs text-muted-foreground">Equipment</p>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-2xl font-bold text-foreground">{payload.stats.cables}</p>
                <p className="text-xs text-muted-foreground">Cables</p>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-2xl font-bold text-foreground">{payload.stats.credentials ?? 0}</p>
                <p className="text-xs text-muted-foreground">Logins</p>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-2xl font-bold text-foreground">{payload.stats.vlans ?? 0}</p>
                <p className="text-xs text-muted-foreground">Discovery subnets</p>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-2xl font-bold text-foreground">{payload.stats.knownHosts ?? 0}</p>
                <p className="text-xs text-muted-foreground">IT hosts</p>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-2xl font-bold text-foreground">{payload.stats.decks}</p>
                <p className="text-xs text-muted-foreground">Decks</p>
              </div>
            </div>
            {(payload.stats.vlans ?? 0) > 0 && (
              <p className="text-xs text-cyan-400">
                IP Scheme / IT management networks will be added to Discovery for scans and tests.
              </p>
            )}

            <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="px-2 py-1.5">Sheet</th>
                    <th className="px-2 py-1.5">Type</th>
                    <th className="px-2 py-1.5 text-right">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetSummary.map((s) => (
                    <tr key={s.name} className="border-b border-border/50">
                      <td className="px-2 py-1 text-foreground">{s.name}</td>
                      <td className="px-2 py-1 text-muted-foreground">{GROUP_LABELS[s.type] || s.type}</td>
                      <td className="px-2 py-1 text-right">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {payload.warnings?.length > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1 max-h-24 overflow-y-auto">
                {payload.warnings.slice(0, 8).map((w, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                    {w}
                  </p>
                ))}
                {payload.warnings.length > 8 && (
                  <p className="text-muted-foreground">+{payload.warnings.length - 8} more warnings</p>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-destructive">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Replace existing equipment and cables before import
            </label>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setParsed(null); setPayload(null); setEnabledGroups([]); }}>
                Back
              </Button>
              <Button onClick={handleCommit} disabled={commitBusy || (payload.stats.equipment === 0 && payload.stats.cables === 0)}>
                {commitBusy && <Loader2 size={14} className="animate-spin mr-2" />}
                Import {payload.stats.equipment} equipment, {payload.stats.cables} cables
              </Button>
            </DialogFooter>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle size={18} />
              <span className="font-medium">Import complete</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Equipment created: {result.equipmentCreated ?? 0}</li>
              <li>Equipment updated: {result.equipmentUpdated ?? 0}</li>
              <li>Cables created: {result.cablesCreated ?? 0}</li>
              {(result.credentialsImported ?? 0) > 0 && (
                <li>Login credentials added: {result.credentialsImported}</li>
              )}
              {result.cablesSkipped > 0 && <li>Cables skipped (duplicates): {result.cablesSkipped}</li>}
            </ul>
            {result.errors?.length > 0 && (
              <div className="text-xs text-destructive max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
