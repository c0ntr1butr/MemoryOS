import { useEffect, useState, useCallback, useRef } from "react";
import api, { API } from "@/lib/api";
import { PageHeader, PageWrap, DecisionBadge } from "@/components/ui-lib";
import { toast } from "sonner";
import { Zap, Play, Pause, Radio } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Runtime() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [wsOk, setWsOk] = useState(false);
  const seenIds = useRef(new Set());

  const load = useCallback(async () => {
    const { data } = await api.get("/decisions", {
      params: {
        limit: 80,
        decision: filter === "all" ? undefined : filter,
      },
    });
    // detect new ones for animation flag
    data.forEach((d) => {
      d._isNew = !seenIds.current.has(d.id);
      seenIds.current.add(d.id);
    });
    setItems(data);
    if (!selected && data[0]) setSelected(data[0]);
  }, [filter, selected]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [live, load]);

  // Real-time WebSocket subscription
  useEffect(() => {
    if (!live) return;
    const token = localStorage.getItem("gov_token");
    if (!token) return;
    const wsUrl = API.replace(/^http/, "ws") + `/ws/decisions?token=${token}`;
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }
    ws.onopen = () => setWsOk(true);
    ws.onclose = () => setWsOk(false);
    ws.onerror = () => setWsOk(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "decision") return;
        const d = msg.data;
        if (filter !== "all" && d.decision !== filter) return;
        if (seenIds.current.has(d.id)) return;
        seenIds.current.add(d.id);
        d._isNew = true;
        setItems((prev) => [d, ...prev].slice(0, 80));
      } catch {}
    };
    return () => {
      try { ws.close(); } catch {}
    };
  }, [live, filter]);

  const simulate = async (count) => {
    setBusy(true);
    try {
      await api.post("/simulate", null, { params: { count } });
      await load();
      toast.success(`Injected ${count} agent request${count > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Live"
        title="Runtime decision engine"
        subtitle="Every request funneled through the governance layer, evaluated against identity, policy, context and risk."
        testid="runtime-header"
        right={
          <>
            <button
              onClick={() => setLive((v) => !v)}
              className="btn-secondary flex items-center gap-2"
              data-testid="live-toggle"
            >
              {live ? <Pause size={14} /> : <Play size={14} />}
              {live ? "Pause" : "Resume"} live
            </button>
            <button
              onClick={() => simulate(1)}
              disabled={busy}
              className="btn-secondary flex items-center gap-2"
              data-testid="inject-one-button"
            >
              +1
            </button>
            <button
              onClick={() => simulate(10)}
              disabled={busy}
              className="btn-primary flex items-center gap-2"
              data-testid="inject-many-button"
            >
              <Zap size={14} /> Inject 10 requests
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        {["all", "allow", "block", "modify", "escalate"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md border hairline text-xs uppercase tracking-wider font-mono-plex transition-colors ${
              filter === f
                ? "bg-white/10 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
            data-testid={`filter-${f}`}
          >
            {f}
          </button>
        ))}
        {live && (
          <div className="ml-auto flex items-center gap-2 text-xs text-neutral-500 font-mono-plex">
            {wsOk ? (
              <>
                <Radio size={11} className="text-cyan-300" />
                <span className="text-cyan-300">ws live</span>
              </>
            ) : (
              <>
                <span
                  className="dot pulse-dot text-cyan-300"
                  style={{ background: "#00e5ff" }}
                />
                polling
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="surface rounded-xl lg:col-span-3 overflow-hidden">
          <div className="p-4 border-b hairline flex items-center justify-between">
            <div className="font-display text-base">
              Decisions stream{" "}
              <span className="text-neutral-500 font-mono-plex text-xs ml-2">
                {items.length}
              </span>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto" data-testid="decisions-stream">
            {items.length === 0 && (
              <div className="p-10 text-center text-neutral-500 text-sm">
                No decisions match this filter yet — click{" "}
                <span className="kbd">Inject 10 requests</span> to see the
                engine in action.
              </div>
            )}
            {items.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className={`w-full text-left px-4 py-3 border-b hairline hover:bg-white/[0.03] transition-colors flex items-center gap-3 ${
                  selected?.id === d.id ? "bg-white/[0.04]" : ""
                } ${d._isNew ? "slide-in" : ""}`}
                data-testid={`decision-row-${d.id}`}
              >
                <DecisionBadge decision={d.decision} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono-plex text-[12.5px] truncate">
                    <span className="text-neutral-500">
                      {d.action.padEnd(6)}
                    </span>{" "}
                    <span className="text-neutral-200">{d.resource}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {d.agent_name} · {d.policy_name}
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500 font-mono-plex whitespace-nowrap">
                  risk {d.risk_score}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="surface rounded-xl lg:col-span-2 p-5">
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                  Decision
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <DecisionBadge decision={selected.decision} />
                  <div className="font-mono-plex text-xs text-neutral-500">
                    id · {selected.id.slice(0, 8)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field k="Agent" v={selected.agent_name} />
                <Field k="Risk" v={selected.risk_score} />
                <Field k="Resource" v={selected.resource} mono />
                <Field k="Action" v={selected.action} mono />
                <Field
                  k="Purpose"
                  v={selected.purpose || "—"}
                  span={2}
                />
                <Field k="Policy" v={selected.policy_name} span={2} />
                <Field k="Reason" v={selected.reason} span={2} />
              </div>

              {/* Explainability trace */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex mb-2 flex items-center gap-2">
                  Evaluation trace
                  <span className="text-neutral-600">— why this decision</span>
                </div>
                <div className="space-y-1.5">
                  {(selected.evaluation_trace || []).map((t, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 items-start p-2 rounded-md border hairline text-[12px] ${
                        t.matched ? "bg-cyan-500/[0.03]" : "bg-black/20"
                      }`}
                    >
                      <span
                        className={`badge ${t.matched ? "badge-allow" : "badge-muted"} !text-[9.5px]`}
                      >
                        {t.matched ? "match" : "skip"}
                      </span>
                      <div className="flex-1">
                        <div className="font-mono-plex text-neutral-300">{t.step}</div>
                        <div className="text-neutral-500 text-[11.5px] mt-0.5">
                          {t.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!selected.evaluation_trace?.length && (
                    <div className="text-xs text-neutral-500 italic">
                      No trace on legacy decisions — inject new traffic to see the full engine walk-through.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex mb-2">
                  Payload
                </div>
                <pre className="surface rounded-lg p-3 text-[11.5px] font-mono-plex overflow-auto max-h-40 text-neutral-300">
                  {JSON.stringify(
                    selected.modified_payload || selected.payload || {},
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono-plex">
                {formatDistanceToNow(new Date(selected.created_at), {
                  addSuffix: true,
                })}
              </div>
            </div>
          ) : (
            <div className="text-neutral-500 text-sm">
              Select a decision to inspect its full trace.
            </div>
          )}
        </div>
      </div>
    </PageWrap>
  );
}

function Field({ k, v, mono, span }) {
  return (
    <div style={{ gridColumn: span === 2 ? "span 2 / span 2" : undefined }}>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex">
        {k}
      </div>
      <div
        className={`mt-1 text-sm ${mono ? "font-mono-plex text-[12.5px]" : ""}`}
      >
        {v}
      </div>
    </div>
  );
}
