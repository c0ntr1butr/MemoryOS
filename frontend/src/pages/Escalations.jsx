import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import {
  PageHeader,
  PageWrap,
  EmptyState,
} from "@/components/ui-lib";
import { AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Escalations() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("pending");

  const load = useCallback(async () => {
    const { data } = await api.get("/escalations", { params: { status: tab } });
    setItems(data);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, approve) => {
    try {
      await api.post(`/escalations/${id}/decide`, { approve });
      toast.success(approve ? "Approved" : "Rejected");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Escalations"
        subtitle="High-risk or ambiguous requests routed here for human approval before the agent proceeds."
        testid="escalations-header"
      />

      <div className="flex items-center gap-2 mb-4" data-testid="escalation-tabs">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-md border hairline text-xs uppercase tracking-wider font-mono-plex ${
              tab === s ? "bg-white/10 text-white" : "text-neutral-400"
            }`}
            data-testid={`escalation-tab-${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={`No ${tab} escalations`}
          subtitle="Escalations appear here when an agent request needs a human decision."
        />
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <div
              key={e.id}
              className="surface rounded-xl p-4 flex items-center gap-4"
              data-testid={`escalation-${e.id}`}
            >
              <div className="w-10 h-10 rounded-lg border hairline flex items-center justify-center bg-amber-500/5">
                <AlertTriangle size={18} className="text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono-plex text-sm truncate">
                  {e.agent_name} · {e.action}{" "}
                  <span className="text-neutral-500">{e.resource}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {e.reason} · risk {e.risk_score} ·{" "}
                  {formatDistanceToNow(new Date(e.created_at), {
                    addSuffix: true,
                  })}
                </div>
              </div>
              {tab === "pending" ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => decide(e.id, false)}
                    className="btn-danger flex items-center gap-1"
                    data-testid={`reject-${e.id}`}
                  >
                    <X size={13} /> Reject
                  </button>
                  <button
                    onClick={() => decide(e.id, true)}
                    className="btn-primary flex items-center gap-1"
                    data-testid={`approve-${e.id}`}
                  >
                    <Check size={13} /> Approve
                  </button>
                </div>
              ) : (
                <div className="text-xs font-mono-plex text-neutral-500">
                  by {e.resolved_by}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageWrap>
  );
}
