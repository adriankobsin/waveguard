import { motion } from "framer-motion";
import { Moon, Music2, Anchor, Sun, Coffee, Zap, Play, Loader2 } from "lucide-react";

const SCENE_ICONS = {
  moon:   Moon,
  music:  Music2,
  anchor: Anchor,
  sun:    Sun,
  coffee: Coffee,
  zap:    Zap,
};

export default function LightingScenePanel({ scenes, activeScene, loading, onTrigger }) {
  return (
    <div className="border-b border-border pb-2">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preset Scenes</p>
        {loading && <Loader2 size={12} className="text-amber-400 animate-spin" />}
      </div>
      <div className="px-3 space-y-1.5">
        {scenes.map((scene, i) => {
          const Icon = SCENE_ICONS[scene.icon] || Play;
          const isActive = activeScene === scene.id;
          return (
            <motion.button
              key={scene.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onTrigger(scene)}
              disabled={loading}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all disabled:opacity-60 ${
                isActive ? scene.activeBg : `hover:bg-muted border-transparent hover:border-border ${scene.color}`
              } ${isActive ? scene.color : ""}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-muted/305" : "bg-muted"}`}>
                {loading && isActive
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Icon size={13} />
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground leading-none">{scene.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{scene.description}</p>
              </div>
              {isActive && !loading && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted/305 flex-shrink-0">ACTIVE</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}