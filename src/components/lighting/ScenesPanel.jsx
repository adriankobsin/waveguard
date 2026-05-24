import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Wand2,
  Plus,
  PlayCircle,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Hash,
  Link2,
  Keyboard,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  loadCustomScenes,
  addCustomScene,
  removeCustomScene,
  runCustomScene,
} from "@/api/lightingApi";
import {
  CUSTOM_SCENE_KINDS,
  DEFAULT_CUSTOM_SCENES,
  LIGHTING_CUSTOM_SCENES_CHANGED_EVENT,
} from "@/lib/lighting/lightingSettings";

// Visual labels for each kind. We keep area_scene as the default first
// option because it's how the integration report names scenes and the
// most common way the operator will author new ones.
const KIND_META = {
  area_scene: {
    label: "Area Scene",
    icon: Hash,
    blurb: "Targets a Lutron Area Scene by Area ID + Scene number.",
    accent: "text-amber-400 bg-amber-500/12 border-amber-500/30",
  },
  leap_href: {
    label: "LEAP Href",
    icon: Link2,
    blurb: "Raw LEAP path such as /area/1052/scene/3.",
    accent: "text-cyan-400 bg-cyan-500/12 border-cyan-500/30",
  },
  phantom_button: {
    label: "Phantom Button",
    icon: Keyboard,
    blurb: "Presses a virtual keypad button on a Phantom device.",
    accent: "text-violet-400 bg-violet-500/12 border-violet-500/30",
  },
};

function addressSummary(scene) {
  if (!scene) return "—";
  if (scene.kind === "area_scene") {
    if (scene.areaId && scene.sceneN != null) {
      return `Area ${scene.areaId} · Scene ${scene.sceneN}`;
    }
    return "Area ?? · Scene ??";
  }
  if (scene.kind === "leap_href") {
    return scene.href || "(no href)";
  }
  if (scene.kind === "phantom_button") {
    return `${scene.deviceHref || "/device/??"} · btn ${
      scene.componentNumber ?? "??"
    }`;
  }
  return "—";
}

function formatTimestamp(iso) {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function ResultBadge({ result }) {
  if (!result) return null;
  if (result === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
        <CheckCircle2 size={10} /> success
      </span>
    );
  }
  if (result === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-semibold">
        <AlertCircle size={10} /> rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-400 text-[10px] font-semibold">
      <AlertCircle size={10} /> {result}
    </span>
  );
}

/**
 * Self-contained Scenes panel.
 *
 * Rendered in two places:
 *   1. The /scenes route (`ScenesPage.jsx`) — page-level chrome with
 *      a full hero header is provided here.
 *   2. As the "Scenes" tab inside the Lights and Shades page
 *      (`LightingPage.jsx`) — `embedded={true}` hides the hero header
 *      so the tab body slots cleanly under the page-level tab bar. A
 *      compact action strip with the Add scene button keeps the
 *      authoring flow within reach.
 */
export default function ScenesPanel({ embedded = false }) {
  const [data, setData] = useState(DEFAULT_CUSTOM_SCENES);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState({});
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadCustomScenes();
      setData(next || DEFAULT_CUSTOM_SCENES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (e) => {
      if (e?.detail?.scenes) setData(e.detail);
      else refresh();
    };
    window.addEventListener(LIGHTING_CUSTOM_SCENES_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(LIGHTING_CUSTOM_SCENES_CHANGED_EVENT, onChange);
    };
  }, [refresh]);

  const scenes = useMemo(() => data?.scenes || [], [data]);

  const handleRun = useCallback(async (scene) => {
    setRunning((r) => ({ ...r, [scene.id]: true }));
    try {
      const result = await runCustomScene(scene.id);
      if (result?.success) {
        toast({
          title: "Scene activated",
          description: `${scene.name} · ${result.mode === "live" ? "live processor" : "mock"}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: `Could not run ${scene.name}`,
          description: result?.error || "The processor did not acknowledge the scene.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: `Could not run ${scene.name}`,
        description: err?.message || String(err),
      });
    } finally {
      setRunning((r) => {
        const next = { ...r };
        delete next[scene.id];
        return next;
      });
    }
  }, []);

  const handleDelete = useCallback(async (scene) => {
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Delete the scene "${scene.name}"? This cannot be undone.`)
        : true;
    if (!ok) return;
    try {
      await removeCustomScene(scene.id);
      toast({ title: "Scene deleted", description: scene.name });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not delete scene",
        description: err?.message || String(err),
      });
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {!embedded && (
        <div className="px-5 py-4 border-b border-border bg-card/70 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <Wand2 size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground">Scenes</h1>
            <p className="text-xs text-muted-foreground">
              Author one-click Lutron scenes — Area scenes, raw LEAP hrefs, or phantom-keypad buttons. Every run is recorded in the lighting event log.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/25"
          >
            <Plus size={14} />
            Add scene
          </button>
        </div>
      )}

      {embedded && (
        <div className="px-5 py-2.5 border-b border-border bg-card/50 flex items-center gap-3 flex-shrink-0 text-xs">
          <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
            <Wand2 size={12} />
            {scenes.length} saved scene{scenes.length === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground">
            Area scenes, raw LEAP hrefs, or phantom-keypad buttons.
          </span>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 font-semibold text-amber-400 hover:bg-amber-500/25 ml-auto"
          >
            <Plus size={12} />
            Add scene
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-5 min-w-0">
        {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Loading scenes…
            </div>
          ) : scenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 ring-1 ring-amber-500/20">
                <Wand2 size={28} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">
                No scenes yet
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Add a Lutron scene to run with one click. Find the Area ID + Scene number in the Integration Report, or paste a LEAP href.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/25"
              >
                <Plus size={14} />
                Add your first scene
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-w-7xl mx-auto">
              {scenes.map((scene) => {
                const meta = KIND_META[scene.kind] || KIND_META.leap_href;
                const Icon = meta.icon;
                const busy = !!running[scene.id];
                return (
                  <motion.div
                    key={scene.id}
                    layout
                    className="rounded-2xl border border-border bg-card/70 p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${meta.accent}`}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {scene.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          {addressSummary(scene)}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${meta.accent}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Last run · {formatTimestamp(scene.lastRunAt)}</span>
                      <ResultBadge result={scene.lastResult} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRun(scene)}
                        disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
                      >
                        {busy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <PlayCircle size={12} />
                        )}
                        Run
                      </button>
                      <button
                        onClick={() => handleDelete(scene)}
                        disabled={busy}
                        className="w-9 h-9 rounded-lg border border-border bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50 transition-colors flex items-center justify-center"
                        title="Delete scene"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
      </div>

      <AnimatePresence>
        {addOpen && (
          <AddSceneModal
            onClose={() => setAddOpen(false)}
            onSave={async (draft) => {
              try {
                await addCustomScene(draft);
                setAddOpen(false);
                toast({ title: "Scene saved", description: draft.name });
              } catch (err) {
                toast({
                  variant: "destructive",
                  title: "Could not save scene",
                  description: err?.message || String(err),
                });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Add scene modal — kind dropdown + conditional fields. Kept local to
// this file because nothing else in the app authors scenes.
// ──────────────────────────────────────────────────────────────────────
function AddSceneModal({ onClose, onSave }) {
  const [kind, setKind] = useState("area_scene");
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState("");
  const [sceneN, setSceneN] = useState("");
  const [href, setHref] = useState("");
  const [deviceHref, setDeviceHref] = useState("");
  const [componentNumber, setComponentNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const meta = KIND_META[kind];

  const valid = useMemo(() => {
    if (!name.trim()) return false;
    if (kind === "area_scene") {
      return !!areaId.trim() && Number.isFinite(Number(sceneN));
    }
    if (kind === "leap_href") {
      return /\/area\/\d+\/scene\/\d+/i.test(href);
    }
    if (kind === "phantom_button") {
      return !!deviceHref.trim() && Number.isFinite(Number(componentNumber));
    }
    return false;
  }, [kind, name, areaId, sceneN, href, deviceHref, componentNumber]);

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const draft = {
      name: name.trim(),
      kind,
      ...(kind === "area_scene"
        ? { areaId: areaId.trim(), sceneN: Number(sceneN) }
        : kind === "leap_href"
        ? { href: href.trim() }
        : { deviceHref: deviceHref.trim(), componentNumber: Number(componentNumber) }),
    };
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

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
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Wand2 size={16} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Add scene</h3>
            <p className="text-[11px] text-muted-foreground">
              Save a one-click trigger for a Lutron scene.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border bg-muted hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Scene name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Evening · Lounge welcome"
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-500/50"
            />
          </Field>
          <Field label="Kind">
            <div className="grid grid-cols-3 gap-1.5">
              {CUSTOM_SCENE_KINDS.map((k) => {
                const m = KIND_META[k];
                const KIcon = m.icon;
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-semibold transition-colors ${
                      kind === k
                        ? m.accent
                        : "border-border bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <KIcon size={14} />
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">{meta.blurb}</p>
          </Field>

          {kind === "area_scene" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area ID" required>
                <input
                  type="text"
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="1052"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground font-mono focus:outline-none focus:border-amber-500/50"
                />
              </Field>
              <Field label="Scene number" required>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={sceneN}
                  onChange={(e) => setSceneN(e.target.value)}
                  placeholder="1-16"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground font-mono focus:outline-none focus:border-amber-500/50"
                />
              </Field>
            </div>
          )}

          {kind === "leap_href" && (
            <Field label="LEAP href" required>
              <input
                type="text"
                value={href}
                onChange={(e) => setHref(e.target.value)}
                placeholder="/area/1052/scene/3"
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground font-mono focus:outline-none focus:border-amber-500/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Must match <code>/area/&lt;id&gt;/scene/&lt;n&gt;</code>.
              </p>
            </Field>
          )}

          {kind === "phantom_button" && (
            <>
              <Field label="Device href" required>
                <input
                  type="text"
                  value={deviceHref}
                  onChange={(e) => setDeviceHref(e.target.value)}
                  placeholder="/device/123"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground font-mono focus:outline-none focus:border-amber-500/50"
                />
              </Field>
              <Field label="Component number" required>
                <input
                  type="number"
                  min={1}
                  value={componentNumber}
                  onChange={(e) => setComponentNumber(e.target.value)}
                  placeholder="1-16"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder-muted-foreground font-mono focus:outline-none focus:border-amber-500/50"
                />
              </Field>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-border bg-muted hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid || saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Save scene
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
