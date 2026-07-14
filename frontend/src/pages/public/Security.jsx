import { PublicShell } from "./PublicShell";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Lock, KeyRound, FileCheck, Server, Radio, Zap, AlertTriangle,
  Download, ArrowRight, Layers,
} from "lucide-react";

const CONTROLS = [
  { k: "Encryption in transit", v: "TLS 1.3 everywhere. mTLS available for enterprise VPC deployments." },
  { k: "Encryption at rest", v: "AES-256 on MongoDB volumes. Envelope encryption for API-key hashes and JWT secrets." },
  { k: "Authentication", v: "Short-lived JWT (8h) via bcrypt/argon2 hashing. SSO/SAML (Enterprise). API keys are hashed (sha256) and rotated one-click." },
  { k: "Authorization", v: "Four roles (owner/admin/editor/viewer) enforced on every mutation. Row-level tenant isolation from insert to export." },
  { k: "Network isolation", v: "Managed cloud: dedicated VPC per region. Self-hosted: no egress to memorygate.dev required. Air-gapped install available." },
  { k: "Secrets", v: "AWS KMS / Azure Key Vault / GCP Secret Manager. No secrets ever touch application logs; audit log stream redacts." },
  { k: "Observability", v: "Structured JSON audit stream ready for Datadog / Splunk / CloudWatch. One line per decision + auth event." },
  { k: "Backups & DR", v: "Continuous MongoDB backup with PITR (35-day retention). Cross-region replication on Enterprise. Documented RPO ≤ 5 min, RTO ≤ 30 min." },
];

const THREATS = [
  ["Prompt injection tricking an agent into exfiltrating data",
   "MemoryGate evaluates every tool call after the LLM produces it. Even if the prompt injection convinces the model, the runtime blocks the exfiltration."],
  ["Compromised agent credential",
   "API keys are scoped to a role (viewer/editor/admin) and to policy effects. A leaked key cannot bypass policies or reach data outside its scope."],
  ["Over-permissioned service account",
   "The runtime is the least-privilege enforcement layer: agents get broad IAM, MemoryGate narrows every call to what policy allows. Least-privilege by policy, not by IAM sprawl."],
  ["Silent data drift or PII leakage",
   "The `modify` effect rewrites payloads before they reach downstream systems. Every redaction is logged with the exact redacted fields."],
  ["Unauthorized deploys / destructive ops",
   "High-risk actions escalate to a human on Slack / Teams / PagerDuty. Approval is bound to a person, a decision id, and a policy — auditable evidence for SOC 2."],
];

const COMPLIANCE = [
  ["SOC 2 Type II",       "Type II report available under NDA. Continuous evidence via runtime decisions mapped to CC1-CC9."],
  ["ISO 27001:2022",      "Statement of Applicability + controls mapped to A.5-A.8. Certificate available on request."],
  ["GDPR",                "Art. 5 lawful processing, Art. 25 privacy by design (via `modify` effect), Art. 30 records of processing, Art. 32 security. DPA on request."],
  ["HIPAA",               "BAA available for Enterprise. §164.308(a) admin safeguards, §164.312(a-e) technical safeguards mapped to runtime activity."],
];

export default function Security() {
  return (
    <PublicShell>
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-8">
        <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-3 flex items-center gap-2">
          <ShieldCheck size={12} /> Security whitepaper
        </div>
        <h1 className="font-display text-5xl tracking-tight">
          Built to sit between the LLM and everything you care about.
        </h1>
        <p className="text-neutral-400 text-lg mt-5 leading-relaxed max-w-3xl">
          MemoryGate is the runtime enforcement point. If it doesn't earn the trust of your
          security team, the rest is theater. This page is the plain-English version of the
          security posture; the full whitepaper (PDF) is available on request.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href="mailto:security@memorygate.dev?subject=Whitepaper%20request" className="btn-primary flex items-center gap-2">
            <Download size={13} /> Request the whitepaper PDF
          </a>
          <a href="mailto:security@memorygate.dev?subject=Security%20questionnaire" className="btn-secondary flex items-center gap-2">
            Send security questionnaire
          </a>
        </div>
      </section>

      {/* Compliance strip */}
      <section id="compliance" className="border-y hairline bg-black/30">
        <div className="max-w-[1400px] mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {COMPLIANCE.map(([n, d]) => (
            <div key={n} className="surface rounded-xl p-5">
              <div className="flex items-center gap-2">
                <FileCheck size={14} className="text-cyan-300" />
                <div className="font-display text-[15px]">{n}</div>
              </div>
              <div className="text-neutral-400 text-[13px] mt-2 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Controls */}
      <section className="max-w-[1100px] mx-auto px-6 py-16">
        <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
          controls
        </div>
        <h2 className="font-display text-3xl tracking-tight">
          Every control your CISO will ask about — plainly documented.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {CONTROLS.map((c) => (
            <div key={c.k} className="surface rounded-xl p-5">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-cyan-300" />
                <div className="font-display text-[15px]">{c.k}</div>
              </div>
              <div className="text-neutral-400 text-sm mt-2 leading-relaxed">{c.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Threat model */}
      <section className="border-y hairline bg-black/30">
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3 flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-300" /> threat model
          </div>
          <h2 className="font-display text-3xl tracking-tight">
            What MemoryGate is designed to defeat.
          </h2>
          <div className="mt-8 space-y-3">
            {THREATS.map(([t, m]) => (
              <div key={t} className="surface rounded-xl p-5">
                <div className="flex gap-3">
                  <span className="badge badge-block shrink-0 mt-1">threat</span>
                  <div>
                    <div className="text-sm text-neutral-200">{t}</div>
                    <div className="text-neutral-400 text-[13px] mt-2 leading-relaxed">{m}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deployment models */}
      <section className="max-w-[1100px] mx-auto px-6 py-16">
        <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
          deployment
        </div>
        <h2 className="font-display text-3xl tracking-tight">
          Where MemoryGate lives, so you can prove it never phones home.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {[
            [Server, "Managed cloud",   "SOC 2 Type II · dedicated VPC per region · TLS 1.3 · 35-day PITR."],
            [Layers, "Self-hosted VPC", "Helm chart · Terraform for AWS/Azure/GCP · request bodies never leave your network."],
            [Radio,  "Air-gapped",      "Signed release bundles · offline policy sync · zero outbound network required."],
          ].map(([Icon, n, d]) => (
            <div key={n} className="surface rounded-xl p-5">
              <Icon size={16} className="text-cyan-300 mb-3" />
              <div className="font-display text-[15px]">{n}</div>
              <div className="text-neutral-400 text-sm mt-2 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Data flow */}
      <section className="border-t hairline bg-black/30">
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
            data flow
          </div>
          <h2 className="font-display text-3xl tracking-tight mb-8">
            What crosses which boundary.
          </h2>
          <div className="surface rounded-2xl p-8">
            <ol className="space-y-4 text-sm">
              {[
                ["Agent → MemoryGate", "TLS 1.3 · Authorization: Bearer · resource · action · purpose · payload · context."],
                ["MemoryGate → policy engine", "In-process. No egress. Policies pre-indexed by priority."],
                ["MemoryGate → MongoDB", "Same VPC. AES-256 at rest. Insert is the decision + trace + client-IP + user-agent."],
                ["MemoryGate → audit stream", "Structured JSON line to stdout — collected by your Datadog/Splunk/CloudWatch agent."],
                ["MemoryGate → agent", "Response with effect, effective payload, risk score, and evaluation trace."],
                ["MemoryGate → webhook (optional)", "Only on `block` / `escalate` events, only to URLs you configured, retried with backoff."],
              ].map(([step, detail], i) => (
                <li key={step} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-md border hairline flex items-center justify-center text-[11px] font-mono-plex shrink-0 text-cyan-300 bg-black/40">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="text-neutral-200">{step}</div>
                    <div className="text-neutral-400 text-[13px] mt-1 leading-relaxed">{detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-[900px] mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-3xl tracking-tight">
          Need something more specific?
        </h2>
        <p className="text-neutral-400 mt-3 max-w-xl mx-auto">
          If your team has a security questionnaire, a DPA to review, or a
          penetration-testing report to share, email us. Median turnaround: 2 business days.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a href="mailto:security@memorygate.dev" className="btn-primary flex items-center gap-2">
            <KeyRound size={13} /> security@memorygate.dev
          </a>
          <Link to="/pilot" className="btn-secondary flex items-center gap-2">
            Book a pilot <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
