import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import {
  PageHeader,
  PageWrap,
  Modal,
  StatusPill,
  EmptyState,
} from "@/components/ui-lib";
import { Plus, Bot, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const empty = {
  name: "",
  description: "",
  framework: "openai",
  capabilities: "",
  trust_level: "medium",
  status: "active",
};

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get("/agents");
    setAgents(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        capabilities: form.capabilities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await api.post("/agents", payload);
      toast.success("Agent registered");
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete agent "${a.name}"?`)) return;
    await api.delete(`/agents/${a.id}`);
    toast.success("Agent removed");
    load();
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Registry"
        title="Agents"
        subtitle="Register every autonomous agent that touches your systems. Assign trust, define capabilities."
        testid="agents-header"
        right={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setOpen(true)}
            data-testid="new-agent-button"
          >
            <Plus size={14} /> Register agent
          </button>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          subtitle="Register your first AI agent to start governing its runtime interactions."
          action={
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setOpen(true)}
            >
              <Plus size={14} /> Register agent
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="agents-grid">
          {agents.map((a) => (
            <div
              key={a.id}
              className="surface rounded-xl p-5 flex flex-col gap-3"
              data-testid={`agent-card-${a.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border hairline flex items-center justify-center bg-black/40">
                    <Bot size={16} className="text-cyan-300" />
                  </div>
                  <div>
                    <div className="font-display text-[15px] leading-tight">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-plex uppercase mt-0.5">
                      {a.framework}
                    </div>
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>

              <div className="text-sm text-neutral-400 min-h-[36px]">
                {a.description || (
                  <span className="text-neutral-600 italic">
                    No description
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {a.capabilities?.slice(0, 6).map((c) => (
                  <span key={c} className="badge badge-muted">
                    {c}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t hairline">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500 font-mono-plex">
                      Trust
                    </div>
                    <div className="font-mono-plex mt-1 capitalize">
                      {a.trust_level}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500 font-mono-plex">
                      Risk
                    </div>
                    <div className="font-mono-plex mt-1">
                      {a.risk_score}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500 font-mono-plex">
                      Decisions
                    </div>
                    <div className="font-mono-plex mt-1">
                      {a.decisions_count}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => remove(a)}
                  className="text-neutral-500 hover:text-rose-400 p-1"
                  data-testid={`agent-delete-${a.id}`}
                  aria-label="delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="text-[10px] font-mono-plex text-neutral-600">
                added{" "}
                {formatDistanceToNow(new Date(a.created_at), {
                  addSuffix: true,
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register agent"
        testid="agent-modal"
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Name
            </label>
            <input
              className="input mt-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              data-testid="agent-name-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Framework
              </label>
              <select
                className="select mt-2"
                value={form.framework}
                onChange={(e) =>
                  setForm({ ...form, framework: e.target.value })
                }
                data-testid="agent-framework-select"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="langchain">LangChain</option>
                <option value="langgraph">LangGraph</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Trust level
              </label>
              <select
                className="select mt-2"
                value={form.trust_level}
                onChange={(e) =>
                  setForm({ ...form, trust_level: e.target.value })
                }
                data-testid="agent-trust-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Description
            </label>
            <input
              className="input mt-2"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Capabilities (comma-separated)
            </label>
            <input
              className="input mt-2"
              placeholder="read_crm, send_email, deploy"
              value={form.capabilities}
              onChange={(e) =>
                setForm({ ...form, capabilities: e.target.value })
              }
              data-testid="agent-capabilities-input"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={saving}
              data-testid="agent-save-button"
            >
              {saving ? "Saving…" : "Register"}
            </button>
          </div>
        </form>
      </Modal>
    </PageWrap>
  );
}
