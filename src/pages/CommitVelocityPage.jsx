import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
  GitCommit, Tag, TrendingUp, Star, AlertCircle, Search,
  ExternalLink, Loader2, Calendar, Code2, Plus, Minus
} from "lucide-react";

const PRESETS = [
  { label: "facebook/react", owner: "facebook", repo: "react" },
  { label: "vuejs/core", owner: "vuejs", repo: "core" },
  { label: "tailwindlabs/tailwindcss", owner: "tailwindlabs", repo: "tailwindcss" },
];

function StatPill({ icon: Icon, label, value, color = "text-cyan-400" }) {
  return (
    <div className="bg-secondary/50 rounded-lg px-3 py-2 flex items-center gap-2">
      <Icon size={13} className={color} />
      <div>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ReleaseRow({ release, index }) {
  const date = release.publishedAt
    ? new Date(release.publishedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
    >
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
        <Tag size={11} className="text-cyan-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a href={release.url} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1">
            {release.tag}
            <ExternalLink size={10} className="text-muted-foreground" />
          </a>
          {release.prerelease && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">pre-release</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{date}
          {release.daysBetween && <span className="ml-2 text-muted-foreground/60">· {release.daysBetween}d since prev</span>}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-right flex-shrink-0">
        <div className="text-center">
          <p className="font-bold text-foreground">{release.commitCount}</p>
          <p className="text-muted-foreground">commits</p>
        </div>
        {release.commitsPerDay != null && (
          <div className="text-center hidden sm:block">
            <p className="font-bold text-cyan-400">{release.commitsPerDay}</p>
            <p className="text-muted-foreground">c/day</p>
          </div>
        )}
        {release.additions > 0 && (
          <div className="hidden md:flex items-center gap-2">
            <span className="text-green-400 flex items-center gap-0.5"><Plus size={10} />{release.additions}</span>
            <span className="text-red-400 flex items-center gap-0.5"><Minus size={10} />{release.deletions}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function CommitVelocityPage() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchData = async (o, r) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await base44.functions.invoke("githubCommitVelocity", { owner: o, repo: r });
      setData(res.data);
    } catch (e) {
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (owner && repo) fetchData(owner, repo);
  };

  const handlePreset = (p) => {
    setOwner(p.owner);
    setRepo(p.repo);
    fetchData(p.owner, p.repo);
  };

  const maxCommits = data ? Math.max(...data.velocity.map(v => v.commitCount), 1) : 1;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <GitCommit size={22} className="text-cyan-400" />
          Commit Velocity
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track release cadence and commit activity across feature releases</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} className="glass rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <input
            value={owner}
            onChange={e => setOwner(e.target.value)}
            placeholder="owner / org"
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-muted-foreground self-center">/</span>
          <input
            value={repo}
            onChange={e => setRepo(e.target.value)}
            placeholder="repository"
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={!owner || !repo || loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Analyse
        </button>
      </form>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Try:</span>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => handlePreset(p)}
            className="text-xs border border-border rounded-full px-3 py-1 text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            {p.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-4 border border-red-500/30 flex items-center gap-3 text-red-400">
          <AlertCircle size={16} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass rounded-xl p-10 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 size={28} className="animate-spin text-cyan-400" />
          <p className="text-sm">Fetching commit data from GitHub…</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {data && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Repo Info */}
            {data.repo?.fullName && (
              <div className="glass rounded-xl p-4 flex flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground">{data.repo.fullName}</h2>
                  {data.repo.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{data.repo.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.repo.language && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{data.repo.language}</span>}
                    {data.repo.defaultBranch && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground font-mono">{data.repo.defaultBranch}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <StatPill icon={Star} label="Stars" value={data.repo.stars?.toLocaleString()} color="text-yellow-400" />
                  <StatPill icon={AlertCircle} label="Open Issues" value={data.repo.openIssues} color="text-red-400" />
                  <StatPill icon={Tag} label="Releases" value={data.velocity.length} color="text-cyan-400" />
                </div>
              </div>
            )}

            {/* Two charts side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Commits per release bar chart */}
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <GitCommit size={14} className="text-cyan-400" />
                  Commits per Release
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[...data.velocity].reverse()} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,14%)" vertical={false} />
                    <XAxis dataKey="tag" tick={{ fontSize: 9, fill: "hsl(210,15%,45%)" }} interval={0} angle={-30} textAnchor="end" height={40} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(210,15%,45%)" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,15%,16%)", borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: "hsl(210,20%,92%)" }}
                      formatter={(v) => [`${v} commits`, "Commits"]}
                    />
                    <Bar dataKey="commitCount" radius={[3, 3, 0, 0]}>
                      {[...data.velocity].reverse().map((entry, idx) => (
                        <Cell key={idx}
                          fill={entry.commitCount === Math.max(...data.velocity.map(v => v.commitCount))
                            ? "hsl(192,100%,48%)" : "hsl(192,80%,32%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Weekly commit activity area chart */}
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-green-400" />
                  Weekly Commit Activity (12w)
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.weeklyActivity} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gWeekly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(145,65%,45%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(145,65%,45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,14%)" />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: "hsl(210,15%,45%)" }} interval={2} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(210,15%,45%)" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,15%,16%)", borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: "hsl(210,20%,92%)" }}
                      formatter={(v) => [`${v} commits`, "Commits"]}
                    />
                    <Area type="monotone" dataKey="commits" stroke="hsl(145,65%,45%)" fill="url(#gWeekly)" strokeWidth={2} dot={false} name="Commits" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Velocity table */}
            <div className="glass rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-cyan-400" />
                Release Velocity Breakdown
              </h3>
              {data.velocity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No releases found for this repository.</p>
              ) : (
                <div>
                  {data.velocity.map((r, i) => <ReleaseRow key={r.tag} release={r} index={i} />)}
                </div>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}