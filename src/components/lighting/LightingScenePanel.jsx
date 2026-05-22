import { motion } from "framer-motion";
import { PlayCircle, Power, Loader2, Wand2 } from "lucide-react";

/**
 * Lutron Area-Scene picker for the Deck Control sidebar.
 *
 * `scenes` is the list of Area Scenes for the active floor / area as
 * extracted from the Integration Report. Each scene carries an `href` like
 * `/areascene/789` which is forwarded back to the page-level
 * `onActivateScene(scene)` handler.
 */
export default function LightingScenePanel({
  scenes,
  pendingScene,
  onActivateScene,
  title = "Scenes",
  emptyMessage,
}) {
  const safe = Array.isArray(scenes) ? scenes : [];

  if (safe.length === 0) {
    return (
      <div className="border-b border-border pb-3">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
        </div>
        <div className="px-4">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center text-[11px] text-muted-foreground">
            <Wand2 size={16} className="mx-auto mb-1.5 opacity-50" />
            {emptyMessage || "No Lutron scenes for this floor."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border pb-2">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        <span className="text-[10px] text-muted-foreground">
          {safe.length}
        </span>
      </div>
      <div className="px-3 space-y-1.5 max-h-[42vh] overflow-y-auto">
        {safe.map((scene, i) => {
          const isOff = /off scene/i.test(scene.name || "");
          const isPending = pendingScene === scene.href;
          const Icon = isOff ? Power : PlayCircle;
          return (
            <motion.button
              key={scene.href}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onActivateScene?.(scene)}
              disabled={isPending}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-all disabled:opacity-60 ${
                isOff
                  ? "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "border-amber-500/20 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isOff ? "bg-muted" : "bg-amber-500/15"
                }`}
              >
                {isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Icon size={13} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground leading-none truncate">
                  {scene.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {scene.area || scene.areaFullPath || ""}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
