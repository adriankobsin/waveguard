import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Key, ExternalLink, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listCredentials,
  saveCredentials,
  importCredentialsBatch,
} from "@/api/credentialsApi";
import { CREDENTIAL_PLATFORMS } from "@/lib/credentials/credentialsVault";
import { parseCredentialsDocument } from "@/lib/credentials/importCredentialsDocument";
import { readSpreadsheetToBuffer } from "@/lib/spreadsheet/readSpreadsheet.js";
import { Link } from "react-router-dom";

const INPUT =
  "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

function emptyCred() {
  return {
    id: `cred-${Date.now()}`,
    label: "",
    equipmentId: "",
    platform: "web",
    host: "",
    loginUrl: "",
    username: "",
    password: "",
    notes: "",
    tags: [],
  };
}

export default function CredentialsVaultPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listCredentials());
    } catch (e) {
      toast.error(e.message || "Failed to load credentials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id, patch) => {
    setItems((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const add = () => setItems((list) => [...list, emptyCred()]);

  const remove = (id) => setItems((list) => list.filter((c) => c.id !== id));

  const persist = async () => {
    setSaving(true);
    try {
      await saveCredentials(items);
      toast.success("Login credentials saved");
      await load();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      let parsed;
      const name = String(file.name || "").toLowerCase();
      if (name.endsWith(".json")) {
        const text = await file.text();
        parsed = parseCredentialsDocument(text, file.name);
      } else if (name.endsWith(".csv")) {
        const text = await file.text();
        parsed = parseCredentialsDocument(text, file.name);
      } else {
        const buffer = await readSpreadsheetToBuffer(file);
        parsed = parseCredentialsDocument(buffer, file.name);
      }

      if (!parsed.length) {
        toast.error("No login rows found. Include columns such as Username, Password, IP, or Hostname.");
        return;
      }

      const { credentialsImported } = await importCredentialsBatch(parsed);
      toast.success(`Imported ${credentialsImported} credential${credentialsImported === 1 ? "" : "s"} into the vault`);
      await load();
    } catch (e) {
      toast.error(e.message || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading credentials…</p>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-muted-foreground">
        Central store for device and platform logins (web UI, SSH, API). Linked entries sync when you
        save a device in Core Network → Configure. Import a spreadsheet or CSV with Username / Password
        columns, or credentials are added automatically when vessel spreadsheets contain login columns.
      </p>

      <div className="rounded-xl border border-border bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileSpreadsheet size={15} className="text-primary" />
          Import credentials document
        </div>
        <p className="text-xs text-muted-foreground">
          Upload .xlsx, .csv, or .json with columns such as Hostname, IP, Username, Password, Platform, and Login URL.
          Existing entries with the same host and username are updated.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            onChange={(e) => handleImportFile(e.target.files?.[0])}
            className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-primary/15 file:text-primary"
          />
          {importing && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> Importing…
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No credentials yet. Import a document above, add one below, or configure browser login on a Core Network device.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border border-border p-4 space-y-3 bg-card/40">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Key size={14} className="text-primary" />
                  <input
                    value={c.label}
                    onChange={(e) => update(c.id, { label: e.target.value })}
                    placeholder="Label (e.g. Peplink 552 web)"
                    className={INPUT}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">
                  Platform
                  <select
                    value={c.platform}
                    onChange={(e) => update(c.id, { platform: e.target.value })}
                    className={`${INPUT} mt-1`}
                  >
                    {CREDENTIAL_PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Host / IP
                  <input
                    value={c.host}
                    onChange={(e) => update(c.id, { host: e.target.value })}
                    className={`${INPUT} mt-1 font-mono`}
                  />
                </label>
                <label className="text-xs text-muted-foreground sm:col-span-2">
                  Login URL
                  <input
                    value={c.loginUrl}
                    onChange={(e) => update(c.id, { loginUrl: e.target.value })}
                    placeholder="https://192.168.1.1/"
                    className={`${INPUT} mt-1 font-mono`}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Username
                  <input
                    value={c.username}
                    onChange={(e) => update(c.id, { username: e.target.value })}
                    className={`${INPUT} mt-1 font-mono`}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Password
                  <input
                    type="password"
                    value={c.password}
                    onChange={(e) => update(c.id, { password: e.target.value })}
                    className={`${INPUT} mt-1 font-mono`}
                  />
                </label>
                <label className="text-xs text-muted-foreground sm:col-span-2">
                  Equipment ID (optional link)
                  <input
                    value={c.equipmentId}
                    onChange={(e) => update(c.id, { equipmentId: e.target.value })}
                    className={`${INPUT} mt-1 font-mono text-xs`}
                  />
                </label>
                <label className="text-xs text-muted-foreground sm:col-span-2">
                  Notes
                  <input
                    value={c.notes}
                    onChange={(e) => update(c.id, { notes: e.target.value })}
                    className={`${INPUT} mt-1`}
                  />
                </label>
              </div>
              {c.loginUrl && (
                <a
                  href={c.loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink size={12} /> Open login page
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-secondary/40"
        >
          <Plus size={14} /> Add credential
        </button>
        <button
          type="button"
          onClick={persist}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save vault"}
        </button>
        <Link to="/snmp" className="text-xs text-primary hover:underline self-center ml-2">
          Core Network fleet →
        </Link>
      </div>
    </div>
  );
}
