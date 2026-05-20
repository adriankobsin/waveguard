import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/permissions";
import { isMockServer } from "@/api/base44Client";
import { resetPlatformToFactory } from "@/api/platformResetApi";
import {
  PLATFORM_RESET_CONFIRM,
  clearPlatformBrowserCaches,
} from "@/lib/platformFactoryReset";
import { toast } from "sonner";

const CLEARED_ITEMS = [
  "All equipment and inventory records",
  "Cables, signal links, and topology layouts",
  "Maintenance tasks, automation rules, and action logs",
  "Device groups and configuration backups",
  "Dashboard layout, integrations, and discovery scan data",
  "Vessel branding, decks & rooms, and discovery settings restored to defaults",
];

export default function PlatformResetPanel() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const canReset =
    admin &&
    acknowledged &&
    confirmText.trim().toUpperCase() === PLATFORM_RESET_CONFIRM &&
    !resetting;

  const handleReset = async () => {
    if (!canReset) return;
    setResetting(true);
    try {
      if (isMockServer) {
        await resetPlatformToFactory(PLATFORM_RESET_CONFIRM);
      } else {
        toast.error("Factory reset is only available when connected to the Wave Guard mock server.");
        return;
      }
      clearPlatformBrowserCaches();
      toast.success("Platform reset complete. Reloading…");
      setTimeout(() => window.location.assign("/"), 1200);
    } catch (err) {
      console.error("[PlatformReset]", err);
      toast.error(err.message || "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  if (!admin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only administrators can reset the platform to factory defaults.
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
        <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">Destructive action</p>
          <p className="text-muted-foreground">
            This clears all operational data and restores default settings so the platform is ready
            for a new vessel deployment. This cannot be undone unless you have an external backup.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">What will be cleared</p>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
          {CLEARED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground pt-2">
          Default operator accounts are restored (Wave Admin, Tech User). You will stay signed in but
          may need to sign in again after reload if your session was cleared.
        </p>
      </div>

      {!isMockServer && (
        <p className="text-sm text-amber-500">
          Factory reset requires the local mock server (npm run mock). It is not available against
          production Base44 yet.
        </p>
      )}

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 rounded border-border"
        />
        <span className="text-sm text-foreground">
          I understand that all platform data listed above will be permanently deleted.
        </span>
      </label>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Type <span className="font-mono text-foreground">{PLATFORM_RESET_CONFIRM}</span> to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={PLATFORM_RESET_CONFIRM}
          className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <button
        type="button"
        onClick={handleReset}
        disabled={!canReset || !isMockServer}
        className="w-full py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {resetting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RotateCcw size={14} />
        )}
        {resetting ? "Resetting platform…" : "Reset platform to defaults"}
      </button>
    </div>
  );
}
