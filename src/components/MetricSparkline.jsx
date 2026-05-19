import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const DATA = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return {
    time: `${String(h).padStart(2,"0")}:${m}`,
    inMbps: Math.round((Math.random() * 45 + 8) * 10) / 10,
    outMbps: Math.round((Math.random() * 30 + 5) * 10) / 10,
  };
});

export default function MetricSparkline({ height = 180 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={DATA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="msIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(192,100%,48%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(192,100%,48%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="msOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(145,65%,45%)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(145,65%,45%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,14%)" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(210,15%,45%)" }} interval={7} />
        <YAxis tick={{ fontSize: 10, fill: "hsl(210,15%,45%)" }} unit=" M" />
        <Tooltip
          contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,15%,16%)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "hsl(210,20%,92%)" }}
          itemStyle={{ color: "hsl(210,20%,80%)" }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Area type="monotone" dataKey="inMbps" stroke="hsl(192,100%,48%)" fill="url(#msIn)" strokeWidth={1.5} name="Inbound" dot={false} />
        <Area type="monotone" dataKey="outMbps" stroke="hsl(145,65%,45%)" fill="url(#msOut)" strokeWidth={1.5} name="Outbound" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}