import { useState } from "react";
import { Loader2, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { changePassword } from "@/api/standaloneApi";

const INPUT_CLS =
  "w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50";

export default function AccountPanel() {
  const { user, logout, checkUserAuth } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 10;

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      toast.success("Password changed. Other devices signed in as you have been logged out.");
      setCurrent("");
      setNext("");
      setConfirm("");
      checkUserAuth?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">My account</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-secondary border border-border">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Username</p>
            <p className="text-sm font-medium text-foreground">{user?.username || "—"}</p>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-secondary border border-border">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Role</p>
            <p className="text-sm font-medium text-foreground">{ROLE_LABELS[user?.role] || user?.role || "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[user?.role]}</p>
          </div>
        </div>
      </div>

      {user?.mustChangePassword && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300">
          You are using the temporary password generated at installation. Please choose your own now.
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 border-t border-border pt-5">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <KeyRound size={14} className="text-primary" /> Change password
        </p>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" className={INPUT_CLS} required />
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (10+ characters, letters and numbers)" className={INPUT_CLS} required />
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" className={INPUT_CLS} required />
        {(mismatch || tooShort) && (
          <p className="text-xs text-red-400">{mismatch ? "The new passwords don't match." : "Use at least 10 characters."}</p>
        )}
        <button
          type="submit"
          disabled={saving || !current || !next || mismatch || tooShort}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Update password
        </button>
      </form>

      <div className="border-t border-border pt-5">
        <button type="button" onClick={() => logout(true)} className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:text-foreground flex items-center gap-2">
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}
