import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Lightbulb,
  PanelTop,
  Blinds,
  Moon,
  Zap,
  X,
  Save,
  Loader2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { isShadeZone } from "@/lib/lighting/lightingSettings";

const KIND_META = {
  light: { label: "Light", Icon: Lightbulb, tone: "amber" },
  shade: { label: "Shade", Icon: PanelTop, tone: "sky" },
  blind: { label: "Blind", Icon: Blinds, tone: "indigo" },
  blackout: { label: "Blackout", Icon: Moon, tone: "violet" },
  openCloseStop: { label: "Shade", Icon: Blinds, tone: "sky" },
  shadeAndTilt: { label: "Shade+Tilt", Icon: PanelTop, tone: "sky" },
  tilt: { label: "Tilt", Icon: PanelTop, tone: "cyan" },
  load: { label: "Load", Icon: Zap, tone: "emerald" },
};
const TONE_CLS = {
  amber: "text-amber-400 bg-amber-500/12 border-amber-500/30",
  sky: "text-sky-400 bg-sky-500/12 border-sky-500/30",
  indigo: "text-indigo-400 bg-indigo-500/12 border-indigo-500/30",
  violet: "text-violet-400 bg-violet-500/12 border-violet-500/30",
  cyan: "text-cyan-400 bg-cyan-500/12 border-cyan-500/30",
  emerald: "text-emerald-400 bg-emerald-500/12 border-emerald-500/30",
};

function kindMeta(kind) {
  return KIND_META[kind] || KIND_META.load;
}

/**
 * Rename a Lutron zone and/or move it to a different integration
 * address (href). Used from every place a zone appears with controls
 * — the Lights / Shades tab rows and the Area Control inline popover.
 *
 * The integration address field accepts either a fully-qualified LEAP
 * href (`/zone/5714`) or just the numeric id; we canonicalise to the
 * full href before saving. Changing the address is intentionally not
 * blocked — the platform sometimes outlives a Designer re-export that
 * renumbers loads, and the operator needs to be able to re-point a
 * zone without re-importing the whole report.
 */
export default function LightingZoneEditModal({ zone, onSave, onClose }) {
  const [name, setName] = useState(zone?.name || "");
  const [href, setHref] = useState(zone?.href || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setName(zone?.name || "");
    setHref(zone?.href || "");
    setError(null);
  }, [zone]);

  const meta = useMemo(() => kindMeta(zone?.kind || "load"), [zone?.kind]);
  const Icon = meta.Icon;
  const isShade = zone ? isShadeZone(zone) : false;

  const hrefValid = useMemo(() => {
    const s = String(href || "").trim();
    if (!s) return false;
    return /^\d+$/.test(s) || /^\/zone\/\d+$/i.test(s);
  }, [href]);

  const nameValid = (name || "").trim().length > 0;
  const valid = nameValid && hrefValid && !saving;
  const dirty =
    (name || "").trim() !== (zone?.name || "") ||
    (href || "").trim() !== (zone?.href || "");

  const canonicalHref = useMemo(() => {
    const s = String(href || "").trim();
    if (/^\d+$/.test(s)) return `/zone/${s}`;
    return s;
  }, [href]);

  const submit = async () => {
    if (!valid || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        originalHref: zone.href,
        name: name.trim(),
        href: canonicalHref,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && valid && dirty) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
    }
  };

  if (!zone) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${TONE_CLS[meta.tone]}`}
          >
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Pencil size={12} className="text-muted-foreground" />
              Edit {isShade ? "shade" : "light"}
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {zone.area || "Area"} · {zone.floor || "Floor"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border bg-muted hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
            type="button"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder={isShade ? "e.g. Living room drape" : "e.g. Bedside reading"}
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-500/50"
            />
          </Field>

          <Field label="Integration address" required>
            <input
              type="text"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/zone/5714  or  5714"
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground font-mono focus:outline-none focus:border-amber-500/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Lutron LEAP zone href, e.g. <code className="font-mono">/zone/5714</code>. A bare
              numeric id is accepted and auto-prefixed.
              {canonicalHref && canonicalHref !== href.trim() && (
                <>
                  {" "}Will be saved as{" "}
                  <code className="font-mono text-foreground">{canonicalHref}</code>.
                </>
              )}
            </p>
          </Field>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[11px] text-red-300">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {canonicalHref !== zone.href && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span className="leading-snug">
                Changing the integration address re-points this UI row at a
                different physical load on the processor. Commands, status
                and event-log entries for the old address ({zone.href}) will
                stop reaching this zone.
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            type="button"
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-border bg-muted hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            type="button"
            disabled={!valid || !dirty}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
        {required && <span className="text-amber-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
