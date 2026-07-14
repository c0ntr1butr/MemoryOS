import { PublicShell } from "./PublicShell";
import { Link } from "react-router-dom";
import {
  ArrowRight, Shield, Zap, ScrollText, Cpu, Users, ShieldCheck,
  Radio, Layers, Bot, Code2,
} from "lucide-react";

const CAPABILITIES = [
  [Shield,     "Runtime enforcement",
   "Every agent request evaluated in-process — allow, block, modify, or escalate — with a full explainability trace."],
  [ScrollText, "Policy engine",
   "Priority-ordered rules over subject / resource / action / conditions / effect. Versioned. Rollback in one click."],
  [Cpu,        "Framework middleware",
   "LangGraph, OpenAI Agents SDK, CrewAI, Google ADK, MCP proxy — all first-class, all installable."],
  [Zap,        "Sub-10 ms hot path",
   "p50 = 47 ms on a preview pod (much lower on production hardware). 6 000 req/min per IP hot-path limit."],
  [Users,      "Multi-tenant + RBAC",
   "Four roles (owner/admin/editor/viewer). Tenant isolation enforced at insert & export. SSO for Enterprise."],
  [ShieldCheck,"Compliance evidence",
   "Continuous SOC 2 / ISO 27001 / GDPR / HIPAA mapping from real runtime activity. One-click CSV export."],
  [Radio,      "Real-time observability",
   "WebSocket decision stream, structured JSON audit log ready for Datadog / Splunk / CloudWatch, live risk heatmap."],
  [Layers,     "Enterprise connectors",
   "Postgres, MongoDB, SurrealDB, Redis, Pinecone, Qdrant, REST — configurable, testable, scope-bound."],
  [Bot,        "Human-in-the-loop",
   "High-risk actions escalate to Slack / Teams / PagerDuty with approve/reject in the console."],
];

const AUDIENCES = [
  {
    title: "For CTOs & AI Platform teams",
    points: [
      "Framework-agnostic middleware — LangGraph, OpenAI Agents SDK, CrewAI, Google ADK, MCP all work today.",
      "One API surface for every agent your team ships. Drop it in without rewriting tools.",
      "Publish-your-own SDK line: `pip install memorygate` and `@memorygate/sdk` semantic-versioned to 1.0.",
    ],
  },
  {
    title: "For CISOs & Security Engineering",
    points: [
      "Zero-trust enforcement point that sits between the LLM output and every enterprise system.",
      "SOC 2 Type II, ISO 27001, GDPR, HIPAA controls mapped from real runtime activity — evidence exports to CSV.",
      "Self-hosted or air-gapped install; request bodies never leave your VPC unless you choose managed cloud.",
    ],
  },
  {
    title: "For Compliance & Risk",
    points: [
      "Immutable audit trail with client IP + user-agent on every decision. Structured JSON stream for your SIEM.",
      "Human-in-the-loop escalation queue with approver, timestamp, and policy binding on every approval.",
      "Policy versioning + rollback means every change is auditable and reversible.",
    ],
  },
];

export default function Product() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 pt-16 pb-10">
        <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-3">
          the product
        </div>
        <h1 className="font-display text-5xl tracking-tight">
          One runtime. Every autonomous action. In front of everything you care about.
        </h1>
        <p className="text-neutral-400 text-lg mt-5 max-w-3xl leading-relaxed">
          MemoryGate is a stateless FastAPI service backed by MongoDB. Your agents call
          <code className="font-mono-plex text-cyan-300 mx-1">mg.evaluate(...)</code>
          before every meaningful action. The runtime returns one of four effects —
          <span className="text-cyan-300"> allow</span>,
          <span className="text-rose-300"> block</span>,
          <span className="text-violet-300"> modify</span>, or
          <span className="text-amber-300"> escalate</span> — with the full trace of why.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/pilot" className="btn-primary flex items-center gap-2">
            Book a pilot <ArrowRight size={13} />
          </Link>
          <Link to="/playground" className="btn-secondary flex items-center gap-2">
            <Radio size={13} /> Try the playground
          </Link>
          <Link to="/docs" className="btn-secondary flex items-center gap-2">
            <Code2 size={13} /> Read the docs
          </Link>
        </div>
      </section>

      {/* Capabilities grid */}
      <section className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPABILITIES.map(([Icon, t, d]) => (
            <div key={t} className="surface rounded-xl p-6">
              <Icon size={16} className="text-cyan-300 mb-3" />
              <div className="font-display text-[15px]">{t}</div>
              <div className="text-neutral-400 text-sm mt-2 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Audiences */}
      <section className="border-y hairline bg-black/30">
        <div className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
            who evaluates memorygate
          </div>
          <h2 className="font-display text-3xl tracking-tight">
            Built for the three people who decide whether you ship AI safely.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="surface rounded-xl p-6">
                <div className="font-display text-lg">{a.title}</div>
                <ul className="mt-4 space-y-3">
                  {a.points.map((p) => (
                    <li key={p} className="text-neutral-400 text-sm leading-relaxed flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-cyan-400 mt-2 shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[900px] mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-4xl tracking-tight">
          Ready to see MemoryGate on your own traffic?
        </h2>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/pilot" className="btn-primary flex items-center gap-2">Book a pilot</Link>
          <Link to="/pricing" className="btn-secondary flex items-center gap-2">See pricing</Link>
        </div>
      </section>
    </PublicShell>
  );
}
