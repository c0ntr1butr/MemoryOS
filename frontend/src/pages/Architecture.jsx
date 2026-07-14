import { PageHeader, PageWrap } from "@/components/ui-lib";
import {
  Shield,
  Bot,
  Database,
  ArrowRight,
  Cpu,
  Lock,
  ScrollText,
  Users,
  Zap,
  Layers,
} from "lucide-react";

export default function Architecture() {
  return (
    <PageWrap>
      <PageHeader
        eyebrow="How it works"
        title="Runtime architecture"
        subtitle="MemoryGate sits between your AI agents and the enterprise systems they touch. Every action is authenticated, evaluated, and logged before it reaches production data."
        testid="architecture-header"
      />

      {/* Diagram */}
      <div className="surface rounded-xl p-8 mb-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Column 1: Agents */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
              Autonomous agents
            </div>
            {[
              ["OpenAI Agents SDK", Bot],
              ["LangGraph", Bot],
              ["CrewAI", Bot],
              ["Custom Python / TS", Bot],
              ["MCP tools", Bot],
            ].map(([label, Icon]) => (
              <div key={label} className="surface rounded-lg p-3 flex items-center gap-3">
                <Icon size={14} className="text-cyan-300" />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>

          {/* Column 2: MemoryGate core */}
          <div className="relative">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex mb-3">
              MemoryGate runtime
            </div>
            <div className="surface rounded-xl p-6 border border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.03] to-transparent h-[calc(100%-1.5rem)]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center">
                  <Shield size={18} className="text-cyan-300" />
                </div>
                <div>
                  <div className="font-display text-lg">Decision engine</div>
                  <div className="text-[11px] text-neutral-500 font-mono-plex">
                    &lt; 8ms · zero-trust
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  ["1. Identity", "Verify agent + tenant", Lock],
                  ["2. Context", "Resource · action · purpose", Layers],
                  ["3. Risk", "Compute risk score", Zap],
                  ["4. Policy", "Match ordered rules", ScrollText],
                  ["5. Effect", "Allow / Block / Modify / Escalate", Cpu],
                  ["6. Human", "Escalate to on-call if needed", Users],
                ].map(([step, detail, Icon]) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 p-2.5 rounded-md border hairline bg-black/30"
                  >
                    <Icon size={14} className="text-cyan-300 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[13px]">{step}</div>
                      <div className="text-[11px] text-neutral-500">{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Enterprise systems */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
              Enterprise systems
            </div>
            {[
              ["PostgreSQL / MySQL", Database],
              ["MongoDB / SurrealDB", Database],
              ["Redis / Cache", Database],
              ["Pinecone / Qdrant", Layers],
              ["REST / gRPC APIs", Cpu],
            ].map(([label, Icon]) => (
              <div key={label} className="surface rounded-lg p-3 flex items-center gap-3">
                <Icon size={14} className="text-neutral-400" />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Flow arrows */}
        <div className="hidden lg:flex items-center justify-center gap-6 mt-6 text-neutral-500 text-xs font-mono-plex">
          <span>agent action</span>
          <ArrowRight size={16} className="text-cyan-300" />
          <span>evaluate()</span>
          <ArrowRight size={16} className="text-cyan-300" />
          <span>governed access</span>
        </div>
      </div>

      {/* Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          {
            t: "Zero trust by default",
            d: "No implicit trust between agents and systems. Every request is authenticated per-tenant, scoped by role, and evaluated against the current policy graph — even from your own SDKs.",
          },
          {
            t: "Framework-agnostic",
            d: "Drop-in middleware for OpenAI Agents SDK, LangGraph, CrewAI and MCP. Or call `mg.evaluate()` directly from any language over HTTPS. No SDK lock-in.",
          },
          {
            t: "Sub-10ms enforcement",
            d: "Rules are pre-indexed by priority and matched with pattern globs. The engine runs in-process on FastAPI + async Mongo — median decision under 8 ms per hop.",
          },
          {
            t: "Explainable by construction",
            d: "Every decision returns the exact ordered trace: which policies were evaluated, why they matched or didn't, the risk score, and the effect. No black boxes.",
          },
          {
            t: "Immutable audit trail",
            d: "Every decision is persisted to Mongo and emitted as a structured JSON audit line — SIEM-ready, SOC 2 CC7-mapped, exportable as CSV.",
          },
          {
            t: "Human-in-the-loop",
            d: "High-risk or ambiguous actions escalate to a real person via the console + Slack / Teams / PagerDuty. Agents pause; humans decide; audit records who.",
          },
        ].map((p) => (
          <div key={p.t} className="surface rounded-xl p-5">
            <div className="font-display text-[15px]">{p.t}</div>
            <div className="text-neutral-400 text-sm mt-2 leading-relaxed">{p.d}</div>
          </div>
        ))}
      </div>

      {/* Deployment model */}
      <div className="surface rounded-xl p-6">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
          Deployment
        </div>
        <div className="font-display text-xl mt-1 mb-4">Where MemoryGate runs</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            ["Managed cloud",   "Fastest path. Multi-region, SOC 2 Type II, 99.95% SLA. HTTPS + mTLS between your agents and the runtime."],
            ["Self-hosted VPC", "Single-region Kubernetes / Docker. Agents call an in-cluster endpoint — request bodies never leave your network."],
            ["Air-gapped",      "For regulated tenants: on-prem install with signed release bundles and offline policy sync via delta files."],
          ].map(([n, d]) => (
            <div key={n}>
              <div className="text-neutral-200 font-display">{n}</div>
              <div className="text-neutral-500 mt-1 text-[13px] leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </PageWrap>
  );
}
