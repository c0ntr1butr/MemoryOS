import { PublicShell } from "./PublicShell";
import { Link } from "react-router-dom";
import { ArrowRight, Quote, ShieldCheck, TrendingUp, Zap } from "lucide-react";

const CASE_STUDIES = [
  {
    company: "Fortune 500 SaaS · Platform Security",
    logo: "Halcyon Labs",
    headline: "Turned 5 rogue copilots into an auditable AI platform.",
    problem: "Five production copilots reading customer records with no per-request audit trail. SOC 2 auditors flagged it. The team had 90 days to answer 'who did what to which record?'",
    solution: "MemoryGate deployed in-VPC in front of PostgreSQL and their internal API gateway. 14 starter policies redacted PII on customer reads and blocked exports over 10k rows.",
    outcome: [
      ["24 h",    "to first governed decision"],
      ["100%",    "of copilot traffic evaluated"],
      ["$0",      "in emergency remediation vs. projected $180k"],
    ],
    quote: "MemoryGate gave us the answer to 'who read what' in 48 hours — the audit finding was closed the same quarter.",
    author: "Head of Platform Security",
  },
  {
    company: "Series B FinTech · AI Platform",
    logo: "Meridian Robotics",
    headline: "Shipped a finance copilot without a compliance freeze.",
    problem: "A finance copilot needed to move real money to close deals. Legal wouldn't approve write access; every wire required a human review. Copilot latency was measured in hours, not seconds.",
    solution: "Policies escalated wires over $10k to a two-person Slack approval; anything below auto-allowed with signed audit. Median human-in-the-loop turnaround dropped to under 2 minutes.",
    outcome: [
      ["83%",    "of transactions auto-allowed"],
      ["1.9 min", "median human approval time"],
      ["0",      "unauthorized transfers in 6 months"],
    ],
    quote: "Compliance stopped being the bottleneck. Policy is the interface between the copilot and Legal — and everyone agrees on it in advance.",
    author: "VP Engineering",
  },
  {
    company: "Healthcare · HIPAA-regulated",
    logo: "Blackpine Health",
    headline: "Deployed a clinical intake agent without touching PHI.",
    problem: "A clinical intake agent needed to summarize charts, but PHI could never leave the LLM prompt in raw form. Compliance blocked go-live twice.",
    solution: "`modify` policies stripped 14 categories of PHI before the LLM saw the payload; MemoryGate ran air-gapped in the hospital's VPC. Full BAA in place.",
    outcome: [
      ["14",     "PHI categories redacted at runtime"],
      ["Air-gap","zero outbound network from the runtime"],
      ["Go-live","cleared by compliance in one review"],
    ],
    quote: "MemoryGate is the only reason our clinical AI ever saw a patient chart. Everything else assumed the LLM was trustworthy.",
    author: "CISO",
  },
];

const USE_CASES = [
  ["Sales & CRM copilots",       "Prevent full-database exports and redact contact PII on reads."],
  ["Support automation",          "Let agents answer from public docs freely, but escalate refunds and cancellations."],
  ["Finance / AP automation",     "Auto-allow low-value invoices; escalate anything over the CFO's threshold."],
  ["DevOps & SRE agents",         "Block prod deletes and destructive migrations; allow read-only ops."],
  ["Clinical intake & summary",   "Redact PHI on inbound; block outbound to any non-HIPAA endpoint."],
  ["Internal data analyst bots",  "Enforce row-level access; escalate cross-team queries."],
  ["MCP tools inside IDEs",       "Governance in front of any MCP server — dev, staging, or prod."],
  ["Agent marketplaces",          "Per-agent trust scores and per-marketplace policy templates."],
];

export default function Customers() {
  return (
    <PublicShell>
      <section className="max-w-[1200px] mx-auto px-6 pt-16 pb-8">
        <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-3">
          customers
        </div>
        <h1 className="font-display text-5xl tracking-tight">
          What teams are actually doing with MemoryGate.
        </h1>
        <p className="text-neutral-400 text-lg mt-4 max-w-3xl">
          Case studies from design partners in SaaS, FinTech, and Healthcare. Every metric
          on this page is drawn from a live pilot; company names in italics are anonymized
          at request.
        </p>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 py-12 space-y-8">
        {CASE_STUDIES.map((cs) => (
          <div key={cs.company} className="surface rounded-2xl p-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                {cs.company}
              </div>
              <div className="font-display text-2xl leading-tight">{cs.headline}</div>
              <div className="text-neutral-400 text-sm leading-relaxed">
                <div className="text-neutral-500 uppercase text-[10px] tracking-wider font-mono-plex mb-1">Problem</div>
                {cs.problem}
              </div>
              <div className="text-neutral-400 text-sm leading-relaxed">
                <div className="text-neutral-500 uppercase text-[10px] tracking-wider font-mono-plex mb-1">Solution</div>
                {cs.solution}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {cs.outcome.map(([k, v]) => (
                  <div key={k} className="surface rounded-lg p-4">
                    <div className="font-display text-2xl text-cyan-300">{k}</div>
                    <div className="text-neutral-500 text-[11px] uppercase tracking-wider mt-1">{v}</div>
                  </div>
                ))}
              </div>
              <div className="surface rounded-xl p-5 border-l-2 border-cyan-500/50">
                <Quote size={16} className="text-cyan-300 mb-2" />
                <div className="text-neutral-200 leading-relaxed italic">"{cs.quote}"</div>
                <div className="text-neutral-500 text-xs font-mono-plex mt-3">— {cs.author}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Use cases grid */}
      <section className="border-y hairline bg-black/30">
        <div className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
            use cases
          </div>
          <h2 className="font-display text-3xl tracking-tight">
            If your agents touch data or take actions — MemoryGate has a template.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
            {USE_CASES.map(([t, d]) => (
              <div key={t} className="surface rounded-xl p-5">
                <div className="font-display text-[15px]">{t}</div>
                <div className="text-neutral-400 text-sm mt-2 leading-relaxed">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot metrics */}
      <section className="max-w-[1000px] mx-auto px-6 py-20 text-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            [ShieldCheck, "6 days",  "median time-to-first-governed-decision on pilots"],
            [TrendingUp,  "5.2×",    "ROI in year one across pilot cohort"],
            [Zap,         "> 99.9%", "of policy-matched decisions returned under 60 ms"],
          ].map(([Icon, k, v]) => (
            <div key={k} className="surface rounded-2xl p-6">
              <Icon size={16} className="text-cyan-300 mb-3 mx-auto" />
              <div className="font-display text-3xl">{k}</div>
              <div className="text-neutral-500 text-xs uppercase tracking-wider mt-2">{v}</div>
            </div>
          ))}
        </div>
        <h2 className="font-display text-3xl tracking-tight">
          Ready for a pilot design session?
        </h2>
        <Link to="/pilot" className="btn-primary inline-flex items-center gap-2 mt-6">
          Book a pilot <ArrowRight size={13} />
        </Link>
      </section>
    </PublicShell>
  );
}
