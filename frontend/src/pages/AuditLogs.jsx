import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { PageHeader, PageWrap, DecisionBadge } from "@/components/ui-lib";
import { Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [decision, setDecision] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get("/decisions", {
      params: {
        limit: 300,
        search: q || undefined,
        decision: decision || undefined,
      },
    });
    setItems(data);
  }, [q, decision]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Audit"
        title="Audit logs"
        subtitle="An immutable, searchable trail of every decision made by the governance engine."
        testid="audit-header"
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xl">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            className="input pl-9"
            placeholder="Search agent, resource, purpose…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="audit-search-input"
          />
        </div>
        <select
          className="select max-w-[180px]"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          data-testid="audit-decision-filter"
        >
          <option value="">All decisions</option>
          <option value="allow">Allow</option>
          <option value="block">Block</option>
          <option value="modify">Modify</option>
          <option value="escalate">Escalate</option>
        </select>
        <div className="ml-auto text-xs text-neutral-500 font-mono-plex">
          {items.length} entries
        </div>
      </div>

      <div className="surface rounded-xl overflow-hidden">
        <table className="gtable" data-testid="audit-table">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Decision</th>
              <th>Agent</th>
              <th>Action / resource</th>
              <th>Policy</th>
              <th>Risk</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} data-testid={`audit-row-${d.id}`}>
                <td>
                  <DecisionBadge decision={d.decision} />
                </td>
                <td>{d.agent_name}</td>
                <td className="font-mono-plex text-[12.5px]">
                  <span className="text-neutral-500">{d.action}</span>{" "}
                  {d.resource}
                </td>
                <td className="text-neutral-400">{d.policy_name}</td>
                <td className="font-mono-plex">{d.risk_score}</td>
                <td className="text-neutral-500 text-xs">
                  {formatDistanceToNow(new Date(d.created_at), {
                    addSuffix: true,
                  })}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-8">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}
