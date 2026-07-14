import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PublicShell } from "./PublicShell";
import { API } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Check, ShieldCheck, Users, Clock, Layers, Send } from "lucide-react";

const FRAMEWORKS = ["LangGraph", "OpenAI Agents SDK", "CrewAI", "Google ADK", "MCP", "Custom / Python", "Custom / TypeScript"];

export default function Pilot() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const tier = params.get("tier") || "enterprise";
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", company: "", role: "",
    team_size: "10-50", agent_count: "5-25",
    timeline: "this quarter", frameworks: [],
    message: "",
    source: tier === "growth" ? "growth-trial" : "enterprise-pilot",
  });

  const toggleFw = (f) => {
    const has = form.frameworks.includes(f);
    setForm({ ...form, frameworks: has ? form.frameworks.filter((x) => x !== f) : [...form.frameworks, f] });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`${API}/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.status === 429) {
        toast.error("Rate limit reached — try again in a minute.");
        return;
      }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.detail || "Something went wrong");
        return;
      }
      nav("/pilot/thanks");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <section className="max-w-[1200px] mx-auto px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-5 gap-12">
        <div className="lg:col-span-2">
          <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-3">
            {tier === "growth" ? "growth · 14-day trial" : "enterprise · pilot design"}
          </div>
          <h1 className="font-display text-4xl tracking-tight">
            {tier === "growth"
              ? "Get your first governed decision in one day."
              : "Book a pilot with the MemoryGate team."}
          </h1>
          <p className="text-neutral-400 mt-4 leading-relaxed">
            {tier === "growth"
              ? "A member of our team will provision your tenant, walk you through policy authoring, and stay in a shared Slack channel until you're in production."
              : "We work with 8–10 enterprise design partners at any given time. If we're the right fit, expect first governed traffic within one working week."}
          </p>

          <div className="mt-10 space-y-4">
            {[
              [ShieldCheck, "SOC 2 Type II hosting or self-hosted in your VPC — you choose during scoping."],
              [Users, "Dedicated Solutions Architect + shared Slack channel from day one."],
              [Clock, "Median time-to-first-governed-decision on pilots so far: 6 business days."],
              [Layers, "We bring 40+ starter policies mapped to SOC 2, ISO 27001, GDPR, and HIPAA."],
            ].map(([Icon, text]) => (
              <div key={text} className="flex items-start gap-3">
                <Icon size={16} className="text-cyan-300 shrink-0 mt-0.5" />
                <div className="text-sm text-neutral-300 leading-relaxed">{text}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 surface rounded-xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex mb-2">
              what happens next
            </div>
            <ol className="text-sm text-neutral-300 space-y-2 list-decimal list-inside">
              <li>You submit this form (60 seconds).</li>
              <li>A Solutions Architect emails within 1 business day.</li>
              <li>30-min scoping call — we map your agents & propose starter policies.</li>
              <li>Provision your tenant · onboarding SOW · shared Slack.</li>
              <li>First governed traffic + weekly review cadence.</li>
            </ol>
          </div>
        </div>

        <form onSubmit={submit} className="lg:col-span-3 surface rounded-2xl p-8" data-testid="pilot-form">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Your name" required>
              <input required data-testid="pilot-name" className="input"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Work email" required>
              <input required type="email" data-testid="pilot-email" className="input"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Company" required>
              <input required data-testid="pilot-company" className="input"
                value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
            <Field label="Your role">
              <input className="input" placeholder="CISO · Head of AI Platform · …"
                value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </Field>
            <Field label="Team size">
              <select className="select" value={form.team_size} onChange={(e) => setForm({ ...form, team_size: e.target.value })}>
                {["1-10", "10-50", "50-200", "200-1000", "1000+"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Agents in production">
              <select className="select" value={form.agent_count} onChange={(e) => setForm({ ...form, agent_count: e.target.value })}>
                {["1-5", "5-25", "25-100", "100-500", "500+"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Timeline">
              <select className="select" value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
                {["this quarter", "next quarter", "6-12 months", "exploring"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Deployment preference">
              <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option value="enterprise-pilot">Managed cloud</option>
                <option value="self-hosted-pilot">Self-hosted (Kubernetes)</option>
                <option value="air-gapped-pilot">Air-gapped install</option>
              </select>
            </Field>
          </div>

          <div className="mt-6">
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
              Agent frameworks in use
            </div>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => {
                const on = form.frameworks.includes(f);
                return (
                  <button
                    type="button"
                    key={f}
                    onClick={() => toggleFw(f)}
                    className={`badge cursor-pointer ${on ? "badge-allow" : "badge-muted"}`}
                    data-testid={`pilot-fw-${f.split(" ")[0].toLowerCase()}`}
                  >
                    {on && <Check size={10} />}
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              What are you trying to solve?
            </label>
            <textarea
              className="input mt-2 min-h-[100px]"
              placeholder="e.g. we have 12 copilots in prod and no audit trail; regulators are asking …"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              data-testid="pilot-message"
            />
          </div>

          <button className="btn-primary w-full mt-6 flex items-center justify-center gap-2" disabled={busy} data-testid="pilot-submit">
            {busy ? "Sending…" : (<>Book pilot <Send size={13} /></>)}
          </button>
          <div className="text-[11px] text-neutral-500 mt-3 text-center">
            We reply within 1 business day. Your info stays with the MemoryGate team; no
            third-party sharing.
          </div>
        </form>
      </section>
    </PublicShell>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-rose-400 ml-1">*</span>}
      </div>
      {children}
    </label>
  );
}

export function PilotThanks() {
  return (
    <PublicShell>
      <section className="max-w-[720px] mx-auto px-6 py-24 text-center">
        <div className="w-14 h-14 rounded-full border border-cyan-500/40 bg-cyan-500/[0.08] flex items-center justify-center mx-auto">
          <Check size={22} className="text-cyan-300" />
        </div>
        <h1 className="font-display text-4xl tracking-tight mt-6">You're on the list.</h1>
        <p className="text-neutral-400 mt-4 max-w-md mx-auto leading-relaxed">
          A Solutions Architect will email you within one business day to schedule a 30-minute
          scoping call. In the meantime, feel free to explore the docs or spin up the SDK
          against a local tenant.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/docs" className="btn-secondary flex items-center gap-2">Read the docs</Link>
          <Link to="/playground" className="btn-primary flex items-center gap-2">Try the playground <ArrowRight size={13} /></Link>
        </div>
      </section>
    </PublicShell>
  );
}
