import { useEffect, useState, useCallback } from "react";
import api, { API } from "@/lib/api";
import { PageHeader, PageWrap } from "@/components/ui-lib";
import { ShieldCheck, Download, CircleCheckBig, CircleAlert } from "lucide-react";

const FRAMEWORKS = [
  { id: "soc2",     name: "SOC 2 Type II",        color: "#00e5ff" },
  { id: "iso27001", name: "ISO/IEC 27001:2022",   color: "#8b5cf6" },
  { id: "gdpr",     name: "GDPR",                 color: "#ffb800" },
  { id: "hipaa",    name: "HIPAA",                color: "#ff3366" },
];

export default function Compliance() {
  const [active, setActive] = useState("soc2");
  const [reports, setReports] = useState({});

  const load = useCallback(async () => {
    const results = await Promise.all(
      FRAMEWORKS.map((f) =>
        api.get(`/compliance/report?framework=${f.id}`).then((r) => [f.id, r.data]),
      ),
    );
    setReports(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const download = async () => {
    const token = localStorage.getItem("gov_token");
    const r = await fetch(`${API}/compliance/export.csv?framework=${active}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memorygate_${active}_report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const activeReport = reports[active];

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Governance"
        title="Compliance center"
        subtitle="Continuous evidence for SOC 2, ISO 27001, GDPR, and HIPAA — mapped from real runtime activity, exportable on demand."
        testid="compliance-header"
        right={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={download}
            data-testid="compliance-export-button"
          >
            <Download size={14} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {FRAMEWORKS.map((f) => {
          const r = reports[f.id];
          const cov = r?.coverage ?? 0;
          const isActive = f.id === active;
          return (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={`surface rounded-xl p-5 text-left transition-colors ${
                isActive ? "border-white/30 bg-white/[0.04]" : ""
              }`}
              data-testid={`fw-${f.id}`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: f.color }} />
                <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                  {f.id}
                </div>
              </div>
              <div className="font-display text-lg mt-2">{f.name}</div>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <div className="stat-num" style={{ color: f.color }}>
                    {cov}%
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono-plex">
                    coverage
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-2">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${cov}%`, background: f.color }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeReport && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="surface rounded-xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
                  Controls
                </div>
                <div className="font-display text-xl mt-1">{activeReport.framework_name}</div>
              </div>
              <div className="text-xs text-neutral-500 font-mono-plex">
                generated · {new Date(activeReport.generated_at).toLocaleString()}
              </div>
            </div>
            <div className="space-y-2" data-testid="control-list">
              {activeReport.controls.map((c) => (
                <div
                  key={c.code}
                  className="flex items-center gap-3 p-3 rounded-lg border hairline"
                >
                  {c.status === "pass" ? (
                    <CircleCheckBig size={16} className="text-cyan-300 shrink-0" />
                  ) : (
                    <CircleAlert size={16} className="text-amber-300 shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-mono-plex text-[12.5px] text-neutral-300">
                      {c.code}
                    </div>
                    <div className="text-sm">{c.name}</div>
                  </div>
                  <span className={`badge ${c.status === "pass" ? "badge-allow" : "badge-escalate"}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="surface rounded-xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
              Evidence stats
            </div>
            <div className="font-display text-xl mt-1 mb-4">Runtime signal</div>
            <div className="space-y-3 text-sm">
              {Object.entries(activeReport.stats).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b hairline pb-2 last:border-b-0">
                  <div className="text-neutral-500 font-mono-plex text-xs uppercase tracking-wider">
                    {k.replace(/_/g, " ")}
                  </div>
                  <div className="font-mono-plex">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageWrap>
  );
}
