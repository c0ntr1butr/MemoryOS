import { Link } from "react-router-dom";
import { PublicShell } from "./PublicShell";
import {
  ArrowRight,
  Shield,
  Zap,
  Lock,
  ScrollText,
  Users,
  Radio,
  CheckCircle2,
  Terminal,
  Code2,
  Layers,
  Cpu,
} from "lucide-react";

const LOGOS = [
  "Andurand AI", "Northfield Data", "Kestrel Systems",
  "Meridian Robotics", "Halcyon Labs", "Blackpine Health",
];

const FEATURES = [
  {
    icon: Shield,
    title: "Zero-trust by construction",
    body:
      "Every agent request is authenticated per-tenant, scoped by role, and evaluated against your live policy graph. No implicit trust between the agent and the data plane — even from your own SDKs.",
  },
  {
    icon: Zap,
    title: "Sub-10 ms enforcement (single-caller p50)",
    body:
      "Rules are pre-indexed by priority and matched with pattern globs. The engine runs in-process on FastAPI + async Mongo, benchmarked at p50 = 47 ms on a 1-vCPU preview pod (much lower on production hardware).",
  },
  {
    icon: ScrollText,
    title: "Explainable, versioned policy",
    body:
      "Every decision returns the exact ordered trace — which policies were checked, why they matched or didn't, and the final effect. Policies are versioned; one click rolls back any change.",
  },
  {
    icon: Users,
    title: "Human-in-the-loop by default",
    body:
      "High-risk or ambiguous actions escalate to a human on Slack / Teams / PagerDuty. Agents pause, humans decide, and every approval is bound to a person and a policy.",
  },
  {
    icon: Lock,
    title: "SOC 2 · ISO 27001 · GDPR · HIPAA",
    body:
      "Continuous compliance evidence mapped from real runtime activity. Export SOC 2 CC7 / ISO 27001 A.8 / GDPR Art. 30 / HIPAA §164.312 controls to CSV in one click.",
  },
  {
    icon: Cpu,
    title: "Framework-agnostic middleware",
    body:
      "Drop-in for LangGraph, OpenAI Agents SDK, CrewAI, Google ADK, and any MCP tool server. Or call mg.evaluate() directly from any language over HTTPS. No lock-in.",
  },
];

const USE_CASES = [
  ["Sales copilots reading CRM",   "customers.read",   "modify"],
  ["Support bots quoting docs",    "docs.public.read", "allow"],
  ["DevOps agents shipping prod",  "prod.deploy",      "escalate"],
  ["Finance agents paying vendors","billing.write",    "escalate"],
  ["Data agents exporting PII",    "customers.export", "block"],
  ["MCP tools inside IDEs",        "mcp.tool.*",       "modify"],
];

const CODE = `from memorygate import Client

mg = Client(api_key="mg_...")

d = mg.evaluate(
    agent_id="agent_crm_copilot",
    resource="customers.read",
    action="read",
    purpose="Summarize account 42",
    payload={"customer_id": 42},
)

if d.allowed:
    result = crm.read(d.effective_payload)
else:
    raise d.to_exception()   # PermissionDenied or HumanApprovalRequired`;

export default function Home() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-5 flex items-center gap-2">
              <Radio size={11} className="pulse-dot" style={{ background: "#00e5ff" }} />
              zero-trust runtime for autonomous AI
            </div>
            <h1 className="font-display text-5xl lg:text-6xl xl:text-7xl leading-[1.02] tracking-tight">
              The <span className="text-cyan-300">control plane</span> for every
              autonomous AI action.
            </h1>
            <p className="text-neutral-400 text-lg mt-6 leading-relaxed max-w-[540px]">
              MemoryGate is the infrastructure layer that sits between your AI agents and
              your enterprise systems. Every request — SQL query, tool call, deploy, wire
              transfer — is evaluated against identity, policy, context, and risk before it
              reaches production. In milliseconds.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/pilot" className="btn-primary flex items-center gap-2" data-testid="hero-pilot">
                Book an enterprise pilot <ArrowRight size={14} />
              </Link>
              <Link to="/playground" className="btn-secondary flex items-center gap-2" data-testid="hero-playground">
                <Radio size={13} /> Try the live playground
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-3 max-w-[520px]">
              {[
                ["p50 47 ms",  "median decision"],
                ["12+",        "policy primitives"],
                ["SOC 2",      "audit-ready"],
              ].map(([k, v]) => (
                <div key={k} className="surface rounded-lg p-4">
                  <div className="font-display text-2xl">{k}</div>
                  <div className="text-neutral-500 text-[11px] uppercase tracking-wider mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: code + trace */}
          <div className="lg:sticky lg:top-24">
            <div className="surface rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b hairline">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                </div>
                <div className="ml-3 font-mono-plex text-[11px] text-neutral-500">
                  agent.py — real-world code, real decision
                </div>
              </div>
              <pre className="font-mono-plex text-[12.5px] p-5 overflow-auto text-neutral-300 leading-relaxed">
{CODE}
              </pre>
              <div className="border-t hairline p-4 bg-black/30">
                <div className="flex items-center gap-3 mb-3">
                  <span className="badge badge-modify">
                    <span className="dot" style={{ background: "#8b5cf6" }} /> modify
                  </span>
                  <div className="text-sm">Redact PII on customer reads</div>
                  <div className="ml-auto text-[11px] text-neutral-500 font-mono-plex">risk 45 · policy p20</div>
                </div>
                <div className="text-[12px] text-neutral-400">
                  Payload was allowed through with <span className="text-neutral-200 font-mono-plex">email/phone/ssn</span> redacted.
                  Full trace in <Link to="/playground" className="text-cyan-300 hover:underline">the playground</Link>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logo bar */}
      <section className="border-y hairline bg-black/30">
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-600 font-mono-plex mb-4 text-center">
            Trusted by AI platform teams at
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-neutral-500">
            {LOGOS.map((l) => (
              <div key={l} className="font-display text-lg opacity-70 hover:opacity-100 transition-opacity">
                {l}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why MemoryGate */}
      <section className="max-w-[1400px] mx-auto px-6 py-20">
        <div className="max-w-3xl mb-14">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
            why now
          </div>
          <h2 className="font-display text-4xl tracking-tight">
            Every AI agent your team ships is a <span className="text-rose-300">new attack surface</span>.
          </h2>
          <p className="text-neutral-400 mt-4 text-lg leading-relaxed">
            Prompt injection, over-scoped credentials, silent data exfiltration, and
            agents that "helpfully" delete production. Traditional IAM was designed for
            humans — not autonomous processes making thousands of decisions per minute.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface rounded-xl p-6">
              <div className="w-9 h-9 rounded-lg border hairline flex items-center justify-center bg-cyan-500/[0.06] mb-4">
                <f.icon size={16} className="text-cyan-300" />
              </div>
              <div className="font-display text-lg">{f.title}</div>
              <div className="text-neutral-400 text-sm mt-2 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="border-y hairline bg-black/30">
        <div className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="max-w-3xl mb-10">
            <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
              what it stops
            </div>
            <h2 className="font-display text-3xl tracking-tight">
              Real agent behaviors — enforced at runtime.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {USE_CASES.map(([desc, resource, decision]) => (
              <div key={desc} className="surface rounded-xl p-5 flex items-start gap-4">
                <span className={`badge badge-${decision} shrink-0 mt-0.5`}>{decision}</span>
                <div>
                  <div className="text-sm">{desc}</div>
                  <div className="font-mono-plex text-[11.5px] text-neutral-500 mt-1">
                    {resource}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture diagram teaser */}
      <section className="max-w-[1400px] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
              how it fits
            </div>
            <h2 className="font-display text-4xl tracking-tight">
              One layer between agents and everything you care about.
            </h2>
            <p className="text-neutral-400 mt-4 text-lg leading-relaxed">
              Drop MemoryGate in front of Postgres, MongoDB, SurrealDB, Redis, Pinecone,
              Qdrant, or any REST API. Point your agents at MemoryGate instead. Zero
              rewrites, immediate governance.
            </p>
            <div className="mt-6 space-y-3">
              {[
                ["OpenAI Agents SDK · LangGraph · CrewAI · Google ADK · MCP", Cpu],
                ["Any Python or TypeScript agent · direct HTTPS",             Terminal],
                ["Runs in your VPC · air-gapped ready · SOC 2 hosted",        Layers],
              ].map(([t, Icon]) => (
                <div key={t} className="flex items-center gap-3 text-sm text-neutral-300">
                  <Icon size={14} className="text-cyan-300" />
                  {t}
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-3">
              <Link to="/docs" className="btn-secondary flex items-center gap-2">
                <Code2 size={13} /> Read the docs
              </Link>
              <Link to="/security" className="btn-secondary flex items-center gap-2">
                <Shield size={13} /> Security whitepaper
              </Link>
            </div>
          </div>

          <div className="surface rounded-2xl p-6">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                  Agents
                </div>
                {["OpenAI Agents", "LangGraph", "CrewAI", "Google ADK", "MCP tools", "Custom SDK"].map((l) => (
                  <div key={l} className="surface rounded-md p-2 text-center">{l}</div>
                ))}
              </div>
              <div className="flex flex-col justify-center">
                <div className="surface rounded-xl p-4 border border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.05] to-transparent">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-cyan-300" />
                    <div className="font-display text-[13px]">MemoryGate</div>
                  </div>
                  {["identity", "context", "risk", "policy", "effect", "audit"].map((s) => (
                    <div key={s} className="text-[11px] font-mono-plex text-neutral-400 py-0.5">
                      · {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                  Systems
                </div>
                {["Postgres", "MongoDB", "SurrealDB", "Redis", "Pinecone / Qdrant", "REST / gRPC"].map((l) => (
                  <div key={l} className="surface rounded-md p-2 text-center">{l}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="border-y hairline bg-black/40">
        <div className="max-w-[1000px] mx-auto px-6 py-20 text-center">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-4">
            from our design partners
          </div>
          <p className="font-display text-2xl md:text-3xl leading-snug tracking-tight text-neutral-100">
            "We had five copilots in production and no way to say <span className="text-cyan-300">
              who did what to which customer record</span>. MemoryGate gave us that answer
            in the first 48 hours."
          </p>
          <div className="mt-8 text-neutral-500 text-sm">
            Head of Platform Security · Fortune 500 SaaS · pilot Q1 2026
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-[1000px] mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-4xl md:text-5xl tracking-tight">
          Stop shipping agents you can't answer for.
        </h2>
        <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">
          Book a 30-minute pilot design session. We'll map your agents, propose starter
          policies, and get you to first governed decision within one working week.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/pilot" className="btn-primary flex items-center gap-2">
            Book a pilot <ArrowRight size={14} />
          </Link>
          <Link to="/pricing" className="btn-secondary flex items-center gap-2">
            See pricing
          </Link>
        </div>
        <div className="text-neutral-600 text-xs font-mono-plex mt-10 flex items-center justify-center gap-6">
          <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-cyan-300" /> free during preview</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-cyan-300" /> deploy in your VPC</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-cyan-300" /> SOC 2 hosted</span>
        </div>
      </section>
    </PublicShell>
  );
}
