import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { API } from "@/lib/api";
import { DecisionBadge } from "@/components/ui-lib";
import {
  Shield,
  Play,
  ArrowRight,
  Copy,
  Radio,
  Github,
  Terminal,
  BookOpen,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

const CODE_PY = `from memorygate import Client

mg = Client(api_key="mg_...")

decision = mg.evaluate(
    agent_id="agent_crm_copilot",
    resource="customers.read",
    action="read",
    purpose="Summarize account 42",
    payload={"customer_id": 42},
)

if decision.allowed:
    return crm.read(decision.effective_payload)
raise decision.to_exception()`;

const CODE_TS = `import { MemoryGate } from "@memorygate/sdk";
const mg = new MemoryGate({ apiKey: process.env.MG_KEY! });

const d = await mg.evaluate({
  agentId: "agent_crm_copilot",
  resource: "customers.read",
  action: "read",
  purpose: "Summarize account 42",
  payload: { customerId: 42 },
});

if (d.allowed) return crm.read(d.effectivePayload);
throw d.toException();`;

export default function Playground() {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState("pii_read");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [customMode, setCustomMode] = useState(false);
  const [form, setForm] = useState({
    resource: "customers.read",
    action: "read",
    purpose: "",
    payload: '{"customer_id": 42}',
  });
  const [lang, setLang] = useState("py");

  const loadScenarios = useCallback(async () => {
    const r = await fetch(`${API}/public/scenarios`);
    setData(await r.json());
    const rd = await fetch(`${API}/public/decisions?limit=8`);
    setRecent(await rd.json());
  }, []);

  useEffect(() => {
    loadScenarios();
    const t = setInterval(async () => {
      const rd = await fetch(`${API}/public/decisions?limit=8`);
      setRecent(await rd.json());
    }, 5000);
    return () => clearInterval(t);
  }, [loadScenarios]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const body = customMode
        ? {
            resource: form.resource,
            action: form.action,
            purpose: form.purpose,
            payload: (() => {
              try { return JSON.parse(form.payload || "{}"); }
              catch { return {}; }
            })(),
          }
        : { scenario_id: pick };
      const r = await fetch(`${API}/public/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 429) {
        toast.error("Playground rate limit reached — try again in a minute.");
        return;
      }
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.detail || "Failed");
        return;
      }
      setResult(d);
      const rd = await fetch(`${API}/public/decisions?limit=8`);
      setRecent(await rd.json());
    } finally {
      setRunning(false);
    }
  };

  const copy = (t) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied");
  };

  const scenarios = data?.scenarios || [];
  const agents = data?.agents || [];
  const policies = data?.policies || [];

  return (
    <div className="min-h-screen" data-testid="playground-page">
      {/* Nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-black/60 border-b hairline">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/playground" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg surface flex items-center justify-center">
              <Shield size={16} className="text-cyan-300" />
            </div>
            <div>
              <div className="font-display text-[15px] leading-none">MemoryGate</div>
              <div className="text-[10px] text-neutral-500 font-mono-plex mt-1">
                runtime.governance
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/memorygate"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Github size={14} /> GitHub
            </a>
            <Link to="/auth" className="btn-primary flex items-center gap-2 text-sm" data-testid="cta-console">
              Open console <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-4 flex items-center gap-2">
              <Radio size={11} className="pulse-dot" style={{ background: "#00e5ff" }} />
              live playground · no signup
            </div>
            <h1 className="font-display text-5xl lg:text-6xl leading-[1.02] tracking-tight">
              The runtime <span className="text-cyan-300">every autonomous</span> AI action passes through.
            </h1>
            <p className="text-neutral-400 text-lg mt-6 leading-relaxed max-w-[540px]">
              MemoryGate is the zero-trust infrastructure layer between your AI agents and your enterprise systems.
              Evaluate any agent request in your browser — right now — and see exactly why it was allowed, blocked, modified, or escalated.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={() => document.getElementById("try").scrollIntoView({ behavior: "smooth" })}
                className="btn-primary flex items-center gap-2"
                data-testid="hero-try-button"
              >
                <Play size={14} /> Try it live
              </button>
              <a
                href="#sdk"
                className="btn-secondary flex items-center gap-2"
              >
                <Terminal size={14} /> Install SDK
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3 max-w-[520px]">
              {[
                ["< 8ms", "median decision"],
                ["12+",   "policy primitives"],
                ["SOC 2", "audit-ready"],
              ].map(([k, v]) => (
                <div key={k} className="surface rounded-lg p-4">
                  <div className="font-display text-2xl">{k}</div>
                  <div className="text-neutral-500 text-[11px] uppercase tracking-wider mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: live decisions stream */}
          <div className="surface rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b hairline">
              <div className="flex items-center gap-2">
                <Radio size={12} className="text-cyan-300 pulse-dot" style={{ background: "#00e5ff" }} />
                <div className="font-mono-plex text-[11px] uppercase tracking-wider text-neutral-400">
                  live · public playground
                </div>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono-plex">
                {recent.length} recent
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto" data-testid="public-stream">
              {recent.length === 0 && (
                <div className="text-center text-neutral-500 text-sm py-10 px-4">
                  Nothing here yet. Try a scenario below — it'll show up in real time.
                </div>
              )}
              {recent.map((d) => (
                <div
                  key={d.id}
                  className="px-5 py-3 border-b hairline flex items-center gap-3 slide-in"
                >
                  <DecisionBadge decision={d.decision} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono-plex text-[12px] truncate">
                      <span className="text-neutral-500">{d.action.padEnd(6)}</span>{" "}
                      <span>{d.resource}</span>
                    </div>
                    <div className="text-[10.5px] text-neutral-500 truncate">
                      {d.agent_name} · {d.policy_name}
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono-plex">
                    risk {d.risk_score}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Try it */}
      <section id="try" className="max-w-[1400px] mx-auto px-6 py-16 border-t hairline">
        <div className="mb-8">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-2">
            interactive
          </div>
          <h2 className="font-display text-3xl tracking-tight">
            Pick a scenario, run it, see the trace.
          </h2>
          <p className="text-neutral-400 mt-3 max-w-2xl">
            The public sandbox is seeded with 4 sample agents and 4 policies (block prod deletions,
            redact PII, escalate high-risk writes, allow public docs). No signup, no keys.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex px-1">
              Scenarios
            </div>
            {scenarios.map((s) => {
              const on = !customMode && pick === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { setPick(s.id); setCustomMode(false); }}
                  className={`w-full text-left surface rounded-xl p-4 transition-colors ${
                    on ? "border-cyan-500/40 bg-cyan-500/[0.03]" : ""
                  }`}
                  data-testid={`scenario-${s.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-display text-[15px]">{s.title}</div>
                    <DecisionBadge decision={s.expect} />
                  </div>
                  <div className="text-xs text-neutral-500 font-mono-plex">
                    {s.action} <span className="text-neutral-400">{s.resource}</span>
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => setCustomMode(true)}
              className={`w-full text-left surface rounded-xl p-4 transition-colors ${
                customMode ? "border-cyan-500/40 bg-cyan-500/[0.03]" : ""
              }`}
              data-testid="scenario-custom"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-display text-[15px]">Compose your own</div>
                <span className="badge badge-muted">custom</span>
              </div>
              <div className="text-xs text-neutral-500">
                Type any resource / action / purpose. Real evaluation, real policies.
              </div>
            </button>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {customMode && (
              <div className="surface rounded-xl p-5 space-y-3">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                  Compose request
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="input font-mono-plex"
                    value={form.resource}
                    onChange={(e) => setForm({ ...form, resource: e.target.value })}
                    placeholder="resource (e.g. customers.read)"
                    data-testid="custom-resource"
                  />
                  <select
                    className="select"
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                  >
                    {["read", "write", "execute", "delete"].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <input
                  className="input"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder="purpose (why the agent needs this)"
                />
                <textarea
                  className="input font-mono-plex text-[12.5px] min-h-[80px]"
                  value={form.payload}
                  onChange={(e) => setForm({ ...form, payload: e.target.value })}
                  placeholder="payload JSON"
                />
              </div>
            )}

            <button
              onClick={run}
              disabled={running}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60"
              data-testid="playground-evaluate"
            >
              <Zap size={14} />
              {running ? "Evaluating…" : "Evaluate live"}
            </button>

            {result && (
              <div className="surface rounded-xl p-5 space-y-4 slide-in" data-testid="playground-result">
                <div className="flex items-center gap-3">
                  <DecisionBadge decision={result.decision} />
                  <div>
                    <div className="text-sm">{result.policy_name}</div>
                    <div className="text-[11px] text-neutral-500 font-mono-plex">
                      risk {result.risk_score} · agent {result.agent_name}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-neutral-300">{result.reason}</div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex mb-2">
                    Evaluation trace
                  </div>
                  <div className="space-y-1.5">
                    {(result.evaluation_trace || []).map((t, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 items-start p-2 rounded-md border hairline text-[12px] ${
                          t.matched ? "bg-cyan-500/[0.03]" : "bg-black/20"
                        }`}
                      >
                        <span className={`badge ${t.matched ? "badge-allow" : "badge-muted"} !text-[9.5px]`}>
                          {t.matched ? "match" : "skip"}
                        </span>
                        <div className="flex-1">
                          <div className="font-mono-plex text-neutral-300">{t.step}</div>
                          <div className="text-neutral-500 text-[11.5px] mt-0.5">{t.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SDK section */}
      <section id="sdk" className="max-w-[1400px] mx-auto px-6 py-16 border-t hairline">
        <div className="mb-8">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-2">
            drop-in sdk
          </div>
          <h2 className="font-display text-3xl tracking-tight">
            10 lines to production governance.
          </h2>
          <p className="text-neutral-400 mt-3 max-w-2xl">
            Real, installable SDKs. Framework middleware for LangGraph, OpenAI Agents SDK,
            CrewAI, Google ADK, and an MCP proxy — every tool call routed through your policies.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="surface rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 border-b hairline px-4">
              {[
                ["py", "Python"],
                ["ts", "TypeScript"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setLang(id)}
                  className={`px-3 py-3 text-xs uppercase tracking-wider font-mono-plex transition-colors ${
                    lang === id ? "text-white border-b-2 border-cyan-400" : "text-neutral-500"
                  }`}
                  data-testid={`code-${id}`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => copy(lang === "py" ? CODE_PY : CODE_TS)}
                className="ml-auto btn-secondary text-xs flex items-center gap-1 my-2"
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <pre className="font-mono-plex text-[12.5px] p-5 pt-4 overflow-auto text-neutral-300 leading-relaxed max-h-[380px]">
{lang === "py" ? CODE_PY : CODE_TS}
            </pre>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              ["pip install memorygate",                              "The core client — sync & async, works from Python 3.9+."],
              ["pip install memorygate[langgraph]",                   "LangGraph node wrapper."],
              ["pip install memorygate[openai]",                      "OpenAI Agents SDK middleware."],
              ["pip install memorygate[crewai]",                      "CrewAI GovernedCrew subclass."],
              ["pip install memorygate[google]",                      "Google ADK integration."],
              ["memorygate mcp-proxy --upstream ...",                 "Governance proxy for any MCP server."],
              ["npm install @memorygate/sdk",                         "TypeScript / Node client."],
            ].map(([cmd, hint]) => (
              <div key={cmd} className="surface rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Terminal size={13} className="text-cyan-300 shrink-0" />
                  <code className="font-mono-plex text-[12.5px] flex-1 truncate">{cmd}</code>
                  <button
                    onClick={() => copy(cmd)}
                    className="text-neutral-500 hover:text-white"
                  >
                    <Copy size={11} />
                  </button>
                </div>
                <div className="text-xs text-neutral-500 mt-2">{hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policies + agents on this demo tenant */}
      <section className="max-w-[1400px] mx-auto px-6 py-16 border-t hairline">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-2">
              agents in this sandbox
            </div>
            <h3 className="font-display text-2xl tracking-tight mb-4">
              Who's making the requests
            </h3>
            <div className="space-y-2">
              {agents.map((a) => (
                <div key={a.id} className="surface rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md border hairline flex items-center justify-center bg-black/40">
                    <BookOpen size={13} className="text-cyan-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{a.name}</div>
                    <div className="text-[11px] text-neutral-500">{a.description}</div>
                  </div>
                  <span className="badge badge-muted uppercase">{a.trust_level}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-2">
              policies enforced
            </div>
            <h3 className="font-display text-2xl tracking-tight mb-4">
              What the runtime is checking
            </h3>
            <div className="space-y-2">
              {policies.map((p) => (
                <div key={p.id} className="surface rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-neutral-500 font-mono-plex w-8">
                      #{String(p.priority).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm">{p.name}</div>
                      <div className="text-[11px] text-neutral-500 font-mono-plex">
                        {p.action} · {p.resource_pattern}
                      </div>
                    </div>
                    <DecisionBadge decision={p.effect} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-[1400px] mx-auto px-6 py-20 border-t hairline text-center">
        <h2 className="font-display text-4xl tracking-tight max-w-2xl mx-auto">
          Ready to deploy MemoryGate in front of your own agents?
        </h2>
        <p className="text-neutral-400 mt-4 max-w-xl mx-auto">
          Spin up a tenant in the console, register your agents, author policies, and get an audit
          trail — free while in preview.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/auth" className="btn-primary flex items-center gap-2">
            Open console <ArrowRight size={14} />
          </Link>
          <a
            href="mailto:pilot@memorygate.dev?subject=Enterprise%20pilot"
            className="btn-secondary flex items-center gap-2"
          >
            Book an enterprise pilot
          </a>
        </div>
        <div className="text-neutral-600 text-xs font-mono-plex mt-12">
          © 2026 MemoryGate — zero-trust runtime for autonomous AI
        </div>
      </section>
    </div>
  );
}
