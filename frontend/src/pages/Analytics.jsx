import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { PageHeader, PageWrap } from "@/components/ui-lib";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";

const COLORS = {
  allow: "#00e5ff",
  block: "#ff3366",
  modify: "#8b5cf6",
  escalate: "#ffb800",
};

export default function Analytics() {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/analytics/overview");
    setData(data);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  if (!data)
    return (
      <PageWrap>
        <div className="text-neutral-500 font-mono-plex text-sm">loading…</div>
      </PageWrap>
    );

  const mixData = Object.entries(data.mix).map(([k, v]) => ({
    name: k,
    value: v,
    color: COLORS[k],
  }));

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Analytics"
        title="Governance analytics"
        subtitle="Understand how your policies behave in production across agents, resources, and time."
        testid="analytics-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="surface rounded-xl p-5 lg:col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
            Decisions over time
          </div>
          <div className="font-display text-xl mt-1 mb-4">
            Rolling 12 hours
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.timeline}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#00e5ff"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="blocks"
                  stroke="#ff3366"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
            Decision mix
          </div>
          <div className="font-display text-xl mt-1 mb-4">All-time</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={mixData}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {mixData.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {mixData.map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-2 text-xs text-neutral-400"
              >
                <span className="dot" style={{ background: m.color }} />
                <span className="uppercase font-mono-plex">
                  {m.name}
                </span>
                <span className="ml-auto font-mono-plex">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
            Top agents
          </div>
          <div className="font-display text-xl mt-1 mb-4">By activity</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={data.top_agents} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#6b7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#6b7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="count" fill="#00e5ff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
            Top blocked resources
          </div>
          <div className="font-display text-xl mt-1 mb-4">Most flagged</div>
          <div className="space-y-3">
            {data.top_blocked.length === 0 && (
              <div className="text-neutral-500 text-sm">No blocks yet.</div>
            )}
            {data.top_blocked.map((r, i) => {
              const max = Math.max(...data.top_blocked.map((x) => x.count));
              const pct = (r.count / max) * 100;
              return (
                <div key={r.resource}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="font-mono-plex">
                      <span className="text-neutral-500 mr-2">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {r.resource}
                    </div>
                    <div className="font-mono-plex text-neutral-400">
                      {r.count}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${pct}%`, background: "#ff3366" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageWrap>
  );
}
