export default function StatusPulse({ status = "online", label }) {
  const configs = {
    online:  { dot: "bg-green-500", ring: "bg-green-500/30", text: "text-green-400" },
    offline: { dot: "bg-red-500",   ring: "bg-red-500/30",   text: "text-red-400" },
    warning: { dot: "bg-yellow-500", ring: "bg-yellow-500/30", text: "text-yellow-400" },
    unknown: { dot: "bg-gray-500",  ring: "bg-gray-500/30",  text: "text-gray-400" },
  };
  const cfg = configs[status] ?? configs.unknown;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.ring} opacity-75`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
      </span>
      {label && <span className={`text-xs ${cfg.text}`}>{label}</span>}
    </span>
  );
}