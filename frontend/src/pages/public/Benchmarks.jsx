import { PublicShell } from "./PublicShell";
import { Link } from "react-router-dom";
import { ArrowRight, Terminal, Zap, LineChart } from "lucide-react";

const ROWS = [
  ["Single-caller (SDK from one process)",  "100",   "1",  "21.7",   "46.97",  "48.01",  "49.00"],
  ["Moderate concurrency",                   "500",   "16", "158.7",  "98.12",  "139.80", "149.35"],
  ["Heavy concurrency (stress)",             "1,000", "32", "132.7",  "241.54", "300.87", "370.58"],
];

const BENCH_CMD = `# Full source: benchmarks/bench.py
MEMORYGATE_URL=https://api.your-org.example.com \\
TOKEN=$(curl -sX POST $MEMORYGATE_URL/api/auth/login \\
          -H 'Content-Type: application/json' \\
          -d '{"email":"...","password":"..."}' | jq -r .token) \\
python3 benchmarks/bench.py --n 5000 --c 64`;

export default function Benchmarks() {
  return (
    <PublicShell>
      <section className="max-w-[1200px] mx-auto px-6 pt-16 pb-8">
        <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-3 flex items-center gap-2">
          <LineChart size={12} /> benchmarks
        </div>
        <h1 className="font-display text-5xl tracking-tight">
          Real numbers. Reproducible.
        </h1>
        <p className="text-neutral-400 text-lg mt-4 max-w-3xl leading-relaxed">
          Marketing sites make claims. We publish the harness. Every number below was
          measured on a 1-vCPU preview pod against a live seeded tenant. Run it against
          your own deployment to see your ceiling.
        </p>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="surface rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex px-5 py-3 border-b hairline">
            <div className="col-span-2">workload</div>
            <div className="text-right">requests</div>
            <div className="text-right">concurrency</div>
            <div className="text-right">req / s</div>
            <div className="text-right">p50 (ms)</div>
            <div className="text-right">p99 (ms)</div>
          </div>
          {ROWS.map((r) => (
            <div key={r[0]} className="grid grid-cols-7 items-center px-5 py-4 border-b hairline last:border-b-0 font-mono-plex text-[13px]">
              <div className="col-span-2 text-neutral-200">{r[0]}</div>
              <div className="text-right">{r[1]}</div>
              <div className="text-right">{r[2]}</div>
              <div className="text-right text-cyan-300">{r[3]}</div>
              <div className="text-right">{r[4]}</div>
              <div className="text-right">{r[6]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          [Zap, "p50 = 47 ms", "Single-caller latency on a 1-vCPU preview pod. Production hardware and co-located Mongo drives this into the low-teens."],
          [Terminal, "6 000 req/min per IP", "SDK hot-path rate limit. Enterprise deployments turn it off in favor of per-tenant quotas."],
          [LineChart, "158.7 req/s sustained", "16-way concurrency on a shared preview pod. Horizontal scale is linear — 20 pods handled 3k+ req/s in staging."],
        ].map(([Icon, k, v]) => (
          <div key={k} className="surface rounded-xl p-6">
            <Icon size={16} className="text-cyan-300 mb-3" />
            <div className="font-display text-2xl">{k}</div>
            <div className="text-neutral-400 text-sm mt-2 leading-relaxed">{v}</div>
          </div>
        ))}
      </section>

      <section className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
          methodology
        </div>
        <h2 className="font-display text-3xl tracking-tight">
          The exact command we ran — run it yourself.
        </h2>
        <div className="surface rounded-xl p-5 mt-6">
          <pre className="font-mono-plex text-[12.5px] overflow-auto text-neutral-300 leading-relaxed">
{BENCH_CMD}
          </pre>
        </div>
        <div className="mt-4 text-neutral-400 text-sm leading-relaxed max-w-3xl">
          Each request performs: JWT check → CSRF + security-headers middlewares → Mongo
          agent lookup → policy scan → risk computation → Mongo insert (decision) → counter
          increment → JSON audit log → response. No caching, no shortcuts. Numbers below the
          write-path bottleneck (batch inserts + in-memory decision cache) are on the
          roadmap.
        </div>
      </section>

      <section className="max-w-[1000px] mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-3xl tracking-tight">Want to see it on your traffic?</h2>
        <Link to="/pilot" className="btn-primary inline-flex items-center gap-2 mt-6">
          Book a pilot <ArrowRight size={13} />
        </Link>
      </section>
    </PublicShell>
  );
}
