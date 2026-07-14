import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import {
  PageHeader,
  PageWrap,
  StatCard,
  DecisionBadge,
} from "@/components/ui-lib";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Zap, RefreshCw, ArrowUpRight, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function Overview() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [simulating, setSimulating] = useState(false);

  const load = useCallback(async () => {
    const [{ data: ov }, { data: dec }] = await Promise.all([
      api.get("/analytics/overview"),
      api.get("/decisions", { params: { limit: 6 } }),
    ]);
    setData(ov);
    setRecent(dec);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const simulate = async () => {
    setSimulating(true);
    try {
      await api.post("/simulate", null, { params: { count: 12 } });
      await load();
      toast.success("Simulated 12 agent requests");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to simulate");
    } finally {
      setSimulating(false);
    }
  };

  if (!data)
    return (
      <PageWrap>
        <div className="text-neutral-500 font-mono-plex text-sm">loading…</div>
      </PageWrap>
    );

  const allowRate = data.total
    ? Math.round(((data.mix.allow || 0) / data.total) * 100)
    : 0;
  const blockRate = data.total
    ? Math.round(((data.mix.block || 0) / data.total) * 100)
    : 0;

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Console › Overview"
        title="Runtime governance at a glance"
        subtitle="Every autonomous action across your organization, evaluated in real time."
        testid="overview-header"
        right={
          <>
            <button
              onClick={load}
              className="btn-secondary flex items-center gap-2"
              data-testid="refresh-button"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={simulate}
              disabled={simulating}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
              data-testid="simulate-button"
            >
              <Zap size={14} />
              {simulating ? "Running…" : "Simulate traffic"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Decisions (all-time)"
          value={data.total.toLocaleString()}
          hint={`${data.total_24h} in last 24h`}
        />
        <StatCard
          label="Allow rate"
          value={`${allowRate}%`}
          accent="#7cf5ff"
          hint={`${data.mix.allow || 0} allowed`}
        />
        <StatCard
          label="Block rate"
          value={`${blockRate}%`}
          accent="#ff7a99"
          hint={`${data.mix.block || 0} blocked`}
        />
        <StatCard
          label="Pending escalations"
          value={data.pending_escalations}
          accent="#ffcf5c"
          hint={`${data.active_policies} active policies`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="surface rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                Traffic — last 12 hours
              </div>
              <div className="font-display text-xl mt-1">
                Decisions & blocks
              </div>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2 text-neutral-400">
                <span className="dot" style={{ background: "#00e5ff" }} />
                Total
              </div>
              <div className="flex items-center gap-2 text-neutral-400">
                <span className="dot" style={{ background: "#ff3366" }} />
                Blocked
              </div>
            </div>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={data.timeline}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBlock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3366" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ff3366" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#00e5ff"
                  strokeWidth={1.5}
                  fill="url(#gTotal)"
                />
                <Area
                  type="monotone"
                  dataKey="blocks"
                  stroke="#ff3366"
                  strokeWidth={1.5}
                  fill="url(#gBlock)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                Decision mix
              </div>
              <div className="font-display text-xl mt-1">Distribution</div>
            </div>
          </div>
          <div className="space-y-4">
            {[
              ["allow", "#00e5ff"],
              ["block", "#ff3366"],
              ["modify", "#8b5cf6"],
              ["escalate", "#ffb800"],
            ].map(([k, c]) => {
              const val = data.mix[k] || 0;
              const pct = data.total ? (val / data.total) * 100 : 0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="dot" style={{ background: c }} />
                      <span className="uppercase font-mono-plex tracking-wider">
                        {k}
                      </span>
                    </div>
                    <div className="font-mono-plex text-neutral-400">
                      {val} · {pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, background: c }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-cyan-300" />
              <div className="font-display text-lg">Recent decisions</div>
            </div>
            <Link
              to="/runtime"
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
            >
              Open runtime <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-2" data-testid="recent-decisions">
            {recent.length === 0 && (
              <div className="text-neutral-500 text-sm py-6 text-center">
                No decisions yet — try “Simulate traffic”.
              </div>
            )}
            {recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-4 p-3 rounded-lg border hairline hover:bg-white/[0.02] transition-colors"
              >
                <DecisionBadge decision={d.decision} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono-plex text-[12.5px] truncate">
                    {d.agent_name} → {d.action}{" "}
                    <span className="text-neutral-500">{d.resource}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {d.reason}
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500 font-mono-plex whitespace-nowrap">
                  {formatDistanceToNow(new Date(d.created_at), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
            Top agents
          </div>
          <div className="font-display text-lg mt-1 mb-4">By decisions</div>
          <div className="space-y-3">
            {data.top_agents.length === 0 && (
              <div className="text-neutral-500 text-sm">No data yet.</div>
            )}
            {data.top_agents.map((a, i) => (
              <div
                key={a.agent_id}
                className="flex items-center gap-3 justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-6 h-6 rounded-md surface flex items-center justify-center text-[11px] font-mono-plex text-neutral-400">
                    {i + 1}
                  </div>
                  <div className="text-sm truncate">{a.name}</div>
                </div>
                <div className="font-mono-plex text-xs text-neutral-400">
                  {a.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrap>
  );
}
