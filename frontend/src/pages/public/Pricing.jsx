import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PublicShell } from "./PublicShell";
import { Check, X, ArrowRight, Calculator } from "lucide-react";

const TIERS = [
  {
    id: "community",
    name: "Community",
    price: "Free",
    tag: "forever",
    for: "solo builders & OSS agents",
    cta: ["Start on GitHub", "https://github.com/memorygate", "btn-secondary"],
    features: [
      ["100k governed decisions / mo",      true],
      ["Up to 3 agents",                    true],
      ["Up to 10 policies",                 true],
      ["7-day audit retention",             true],
      ["Community Discord support",         true],
      ["Managed hosting",                   true],
      ["SSO / SAML",                        false],
      ["Self-hosted / air-gapped",          false],
      ["Custom SLAs & 24×7 pager",          false],
    ],
    highlight: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$1,499",
    tag: "/ month",
    for: "startups shipping real agents",
    cta: ["Start a 14-day trial", "/pilot?tier=growth", "btn-primary"],
    features: [
      ["5M governed decisions / mo",        true],
      ["Unlimited agents",                  true],
      ["Unlimited policies",                true],
      ["90-day audit retention",            true],
      ["Email + Slack support (business hrs)", true],
      ["Managed hosting",                   true],
      ["SSO via Google Workspace",          true],
      ["Self-hosted / air-gapped",          false],
      ["Custom SLAs & 24×7 pager",          false],
    ],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    tag: "annual contract",
    for: "regulated industries & platform teams",
    cta: ["Book a pilot", "/pilot?tier=enterprise", "btn-primary"],
    features: [
      ["Unlimited decisions",               true],
      ["Unlimited agents & policies",       true],
      ["Custom retention (up to 7 years)",  true],
      ["Dedicated CSM + Slack channel",     true],
      ["Managed hosting OR self-hosted",    true],
      ["SSO / SAML / SCIM / mTLS",          true],
      ["Air-gapped install (signed bundles)", true],
      ["99.95% SLA · 24×7 pager",           true],
      ["SOC 2 / ISO 27001 evidence",        true],
    ],
    highlight: false,
  },
];

const FAQ = [
  ["What counts as a decision?",
   "One call to /api/evaluate. Simulator traffic, playground calls, and MCP-proxy tools/call all count. Free-tier orgs are soft-limited; paid tiers get overage pricing at $1 per 100k decisions."],
  ["Where is my data stored?",
   "By default: eu-west-1 or us-east-2 (you choose during onboarding) on SOC 2 Type II infrastructure. Enterprise: your own VPC, air-gapped install, or on-prem k8s — request bodies never leave your network."],
  ["Do you train on our data?",
   "No. MemoryGate stores decisions for audit only. There is no model training, no cross-tenant analytics, and no third-party sharing. All decisions are tenant-scoped from insert to export."],
  ["How does the SDK version rollout work?",
   "Semantic versioning. `memorygate>=0.1,<1` is the pinned production line — no breaking changes without a major bump. Middleware modules opt-in via extras (e.g. `pip install memorygate[langgraph]`)."],
  ["Can we start self-hosted?",
   "Yes on Enterprise. We provide a Helm chart, Terraform modules for AWS/Azure/GCP, and a single-node Docker Compose for pilots. Managed cloud remains available for burst regions."],
  ["What's the pilot process?",
   "Typical timeline: 1) 30-min scoping call, 2) provision your tenant & connectors within 3 business days, 3) author 5-10 starter policies together, 4) first governed traffic in one week, 5) 30-day evaluation with weekly reviews."],
];

export default function Pricing() {
  const [decisions, setDecisions] = useState(500);
  const [agents, setAgents] = useState(20);
  const [avgSalary, setAvgSalary] = useState(180);

  // Simple ROI model:
  // - MemoryGate cost: Growth $1499/mo, Enterprise ~ negotiated but assume $8k/mo for calc
  // - Value delivered: prevented incidents (1 per agent per year at $60k blast) + engineer hours saved
  //   (30 hrs/mo per team on manual audit prep) + faster ship velocity (2 wks/quarter unblocked)
  const roi = useMemo(() => {
    const incidents_prevented_year = agents * 0.3;                     // conservative: 30% of agents cause 1 incident/yr
    const incident_cost_avg = 60000;                                    // industry avg for AI-caused data mishap
    const incident_value = incidents_prevented_year * incident_cost_avg;

    const audit_hours_saved_year = 30 * 12;                             // 30 hrs/mo
    const hourly = (avgSalary * 1000) / 2000;                            // 2000 work hrs/yr
    const audit_value = audit_hours_saved_year * hourly;

    const velocity_days_year = 2 * 5 * 4;                                // 2 wks per quarter × 4 quarters
    const velocity_value = velocity_days_year * 8 * hourly * (agents / 10);

    const total_value = incident_value + audit_value + velocity_value;
    const growth_cost = 1499 * 12;
    const enterprise_cost = 8000 * 12;
    const roi_growth = total_value / growth_cost;
    const roi_enterprise = total_value / enterprise_cost;
    return {
      total_value,
      incident_value, audit_value, velocity_value,
      roi_growth, roi_enterprise,
    };
  }, [agents, avgSalary, decisions]);

  const fmt = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` :
                     n >= 1e3 ? `$${Math.round(n / 1e3)}k` :
                                `$${Math.round(n)}`;

  return (
    <PublicShell>
      <section className="max-w-[1400px] mx-auto px-6 pt-16 pb-8 text-center">
        <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
          pricing
        </div>
        <h1 className="font-display text-5xl tracking-tight">
          Priced for the volume you actually run.
        </h1>
        <p className="text-neutral-400 text-lg mt-4 max-w-2xl mx-auto">
          Community is genuinely free forever. Growth unlocks production. Enterprise is
          where your CISO reviews the DPA and you get an air-gapped install.
        </p>
      </section>

      {/* Tiers */}
      <section className="max-w-[1400px] mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.id}
              data-testid={`tier-${t.id}`}
              className={`rounded-2xl p-8 flex flex-col ${
                t.highlight
                  ? "border-2 border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.06] to-transparent shadow-2xl scale-[1.02]"
                  : "surface"
              }`}
            >
              {t.highlight && (
                <div className="badge badge-allow self-start mb-2">
                  most popular
                </div>
              )}
              <div className="font-display text-2xl">{t.name}</div>
              <div className="text-neutral-500 text-sm mt-1">{t.for}</div>
              <div className="mt-6 flex items-baseline gap-2">
                <div className="font-display text-4xl">{t.price}</div>
                <div className="text-neutral-500 text-sm">{t.tag}</div>
              </div>
              <div className="mt-6 space-y-2.5 flex-1">
                {t.features.map(([label, on]) => (
                  <div key={label} className="flex items-start gap-2.5 text-sm">
                    {on ? (
                      <Check size={14} className="text-cyan-300 shrink-0 mt-0.5" />
                    ) : (
                      <X size={14} className="text-neutral-600 shrink-0 mt-0.5" />
                    )}
                    <span className={on ? "text-neutral-200" : "text-neutral-600"}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              {t.cta[1].startsWith("http") ? (
                <a href={t.cta[1]} className={`${t.cta[2]} mt-8 flex items-center justify-center gap-2`}>
                  {t.cta[0]} <ArrowRight size={14} />
                </a>
              ) : (
                <Link to={t.cta[1]} className={`${t.cta[2]} mt-8 flex items-center justify-center gap-2`} data-testid={`tier-cta-${t.id}`}>
                  {t.cta[0]} <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ROI calculator */}
      <section className="max-w-[1400px] mx-auto px-6 py-16 border-t hairline">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3 flex items-center gap-2">
              <Calculator size={12} className="text-cyan-300" /> ROI calculator
            </div>
            <h2 className="font-display text-3xl tracking-tight">
              What MemoryGate is worth to your team.
            </h2>
            <p className="text-neutral-400 mt-3 max-w-md">
              A conservative model based on prevented incidents, audit hours reclaimed, and
              velocity unlocked. Move the sliders to see your own picture.
            </p>
            <div className="mt-8 space-y-6 max-w-md">
              {[
                ["Agents in production", agents, setAgents, 1, 500, "agents"],
                ["Governed decisions / month (k)", decisions, setDecisions, 10, 10000, "k"],
                ["Avg engineer salary ($k / yr)", avgSalary, setAvgSalary, 60, 400, "k"],
              ].map(([label, val, set, min, max, unit]) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-neutral-400">{label}</div>
                    <div className="font-mono-plex text-sm text-cyan-300">
                      {val}{unit}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={val}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                    data-testid={`roi-${label.split(" ")[0].toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="surface rounded-2xl p-8">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
              Annual value delivered
            </div>
            <div className="font-display text-6xl mt-3 text-cyan-300" data-testid="roi-total">
              {fmt(roi.total_value)}
            </div>
            <div className="mt-8 space-y-4">
              {[
                ["Prevented incidents", roi.incident_value, "based on 30% of agents · $60k avg blast radius"],
                ["Audit hours reclaimed", roi.audit_value, "30 engineer hours / month at your rate"],
                ["Velocity unlocked", roi.velocity_value, "faster ship cycles once compliance is automated"],
              ].map(([label, val, hint]) => (
                <div key={label} className="border-b hairline pb-4 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{label}</div>
                    <div className="font-mono-plex text-sm">{fmt(val)}</div>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1">{hint}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="surface rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex">Growth ROI</div>
                <div className="font-display text-2xl text-cyan-300">
                  {roi.roi_growth.toFixed(1)}×
                </div>
              </div>
              <div className="surface rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono-plex">Enterprise ROI</div>
                <div className="font-display text-2xl text-cyan-300">
                  {roi.roi_enterprise.toFixed(1)}×
                </div>
              </div>
            </div>
            <Link to="/pilot" className="btn-primary w-full mt-8 flex items-center justify-center gap-2">
              Book a pilot with these numbers <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[900px] mx-auto px-6 py-16 border-t hairline">
        <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3 text-center">
          faq
        </div>
        <h2 className="font-display text-3xl tracking-tight text-center mb-10">
          Questions we hear from every buyer.
        </h2>
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="surface rounded-xl p-5 group">
              <summary className="cursor-pointer flex items-center justify-between font-medium list-none">
                <span>{q}</span>
                <span className="text-neutral-500 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="text-neutral-400 text-sm mt-3 leading-relaxed">{a}</div>
            </details>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
