import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { parseWorkbook, buildImportPayload, DEFAULT_FLOOR_MAP } from "@/lib/spreadsheet";
import { readSpreadsheetToBuffer } from "@/lib/spreadsheet/readSpreadsheet";
import {
  buildPatchImportPreview,
  detectEnabledGroupsFromWorkbook,
} from "@/lib/patchPanelSchedule/patchImportPreview";
import { commitVesselSpreadsheetImport } from "@/api/vesselSpreadsheetImportApi";

const SHEET_TYPE_LABELS = {
  patchPanels: "Patch Panels",
  rack: "Rack layout",
  generic: "Auto-detected",
  deviceList: "Device List",
  switchPorts: "Switch ports",
  appliance: "Appliance",
  ipScheme: "IP Scheme",
};

export default function PatchPanelImportModal({ isOpen, onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importPreview, setImportPreview] = useState(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setParseError(null);
    setPreview(null);
    setImportPreview(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    setParseError(null);
    setPreview(null);
    setImportPreview(null);
    try {
      const buffer = await readSpreadsheetToBuffer(file);
      const parsed = parseWorkbook(buffer);
      const enabledGroups = detectEnabledGroupsFromWorkbook(parsed);
      const payload = buildImportPayload(parsed, {
        enabledGroups,
        floorMap: DEFAULT_FLOOR_MAP,
      });

      if (payload.stats.cables === 0) {
        const patchSheets = (parsed?.sheets || []).filter(
          (s) => s.sheetType === "patchPanels" && !s.skipped
        );
        setParseError(
          patchSheets.length
            ? "Patch panel sheets were found but contained no importable rows. Each row needs a patch panel name and port number."
            : "No patch panel data found. Include columns: patch panel, port, cable no., end device, tested/length — on any sheet."
        );
        setImportPreview(buildPatchImportPreview(parsed, payload));
        return;
      }

      setPreview(payload);
      setImportPreview(buildPatchImportPreview(parsed, payload));
    } catch (err) {
      console.error("[PatchPanelImport]", err);
      setParseError(err.message || "Failed to parse file");
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setBusy(true);
    setParseError(null);
    try {
      const commitResult = await commitVesselSpreadsheetImport(preview, { replace: false });
      setResult(commitResult);
      toast.success(
        `Imported ${commitResult.equipmentCreated} panels/equipment, ${commitResult.cablesCreated} port rows`
      );
      onComplete?.();
    } catch (err) {
      console.error("[PatchPanelImport commit]", err);
      toast.error(err.message || "Import failed");
      setParseError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-cyan-400" />
            Import patch panel schedule
          </DialogTitle>
          <DialogDescription>
            Upload any workbook (.xlsx, .csv). All sheets are scanned automatically — patch panel columns are
            mapped to port schedules, rack sheets link panels to racks, and extra columns are preserved.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setPreview(null);
                  setImportPreview(null);
                  setParseError(null);
                }}
                className="block mx-auto text-xs text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-primary/15 file:text-primary"
              />
            </div>

            {importPreview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xl font-bold">{importPreview.stats.cables ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Port rows</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xl font-bold">{importPreview.stats.equipment ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Equipment</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xl font-bold">{importPreview.sheets.length}</p>
                    <p className="text-xs text-muted-foreground">Sheets</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xl font-bold">{importPreview.columnMaps.length}</p>
                    <p className="text-xs text-muted-foreground">Columns mapped</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sheets detected</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border bg-secondary/40">
                          <th className="px-2 py-1.5">Sheet</th>
                          <th className="px-2 py-1.5">Type</th>
                          <th className="px-2 py-1.5 text-right">Rows</th>
                          <th className="px-2 py-1.5">Columns found</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.sheets.map((s) => (
                          <tr key={s.name} className="border-b border-border/50">
                            <td className="px-2 py-1.5 font-medium">{s.name}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {SHEET_TYPE_LABELS[s.type] || s.type}
                            </td>
                            <td className="px-2 py-1.5 text-right">{s.rowCount}</td>
                            <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">
                              {s.headers.join(", ") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {importPreview.columnMaps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Column mapping (patch panels)</p>
                    <div className="rounded-lg border border-border overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-xs min-w-[520px]">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border bg-secondary/40 sticky top-0">
                            <th className="px-2 py-1.5">Sheet</th>
                            <th className="px-2 py-1.5">Spreadsheet column</th>
                            <th className="px-2 py-1.5">Platform field</th>
                            <th className="px-2 py-1.5">Import as</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.columnMaps.map((col, i) => (
                            <tr key={`${col.sheet}-${col.sourceColumn}-${i}`} className="border-b border-border/50">
                              <td className="px-2 py-1 text-muted-foreground">{col.sheet}</td>
                              <td className="px-2 py-1 font-medium">{col.sourceColumn}</td>
                              <td className="px-2 py-1 font-mono text-cyan-400">{col.platformField}</td>
                              <td className="px-2 py-1 text-muted-foreground">{col.importTarget}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importPreview.sampleRows.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Sample rows to import</p>
                    <div className="rounded-lg border border-border overflow-x-auto max-h-52 overflow-y-auto">
                      <table className="w-full text-xs min-w-[800px]">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border bg-secondary/40 sticky top-0">
                            <th className="px-2 py-1">Panel</th>
                            <th className="px-2 py-1">Port</th>
                            <th className="px-2 py-1">Cable</th>
                            <th className="px-2 py-1">Type</th>
                            <th className="px-2 py-1">System</th>
                            <th className="px-2 py-1">Deck</th>
                            <th className="px-2 py-1">Room</th>
                            <th className="px-2 py-1">Location</th>
                            <th className="px-2 py-1">End Device</th>
                            <th className="px-2 py-1">End Device Port</th>
                            <th className="px-2 py-1">Length</th>
                            <th className="px-2 py-1">Test</th>
                            <th className="px-2 py-1">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.sampleRows.map((row, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="px-2 py-1">{row.patch_panel}</td>
                              <td className="px-2 py-1">{row.port}</td>
                              <td className="px-2 py-1 font-mono text-cyan-400">{row.label}</td>
                              <td className="px-2 py-1">{row.type}</td>
                              <td className="px-2 py-1">{row.system_category}</td>
                              <td className="px-2 py-1">{row.deck}</td>
                              <td className="px-2 py-1">{row.room}</td>
                              <td className="px-2 py-1">{row.location}</td>
                              <td className="px-2 py-1">{row.to_equipment}</td>
                              <td className="px-2 py-1">{row.end_device_port}</td>
                              <td className="px-2 py-1">{row.length}</td>
                              <td className="px-2 py-1">{row.test_result}</td>
                              <td className="px-2 py-1 truncate max-w-[120px]">{row.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importPreview.hasRackLayout && (
                  <p className="text-xs text-emerald-400">Rack layout sheet detected — panels will be grouped by rack.</p>
                )}

                {importPreview.warnings?.length > 0 && (
                  <div className="text-xs text-amber-500 space-y-1 max-h-20 overflow-y-auto">
                    {importPreview.warnings.slice(0, 5).map((w, i) => (
                      <p key={i} className="flex items-start gap-1">
                        <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

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
              {!preview ? (
                <Button onClick={handlePreview} disabled={!file || busy}>
                  {busy && <Loader2 size={14} className="animate-spin mr-2" />}
                  Preview
                </Button>
              ) : (
                <Button onClick={handleCommit} disabled={busy}>
                  {busy && <Loader2 size={14} className="animate-spin mr-2" />}
                  Import {importPreview?.stats?.cables ?? 0} port rows
                </Button>
              )}
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
              <li>Cables created: {result.cablesCreated ?? 0}</li>
              <li>Equipment created: {result.equipmentCreated ?? 0}</li>
              <li>Equipment updated: {result.equipmentUpdated ?? 0}</li>
            </ul>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
