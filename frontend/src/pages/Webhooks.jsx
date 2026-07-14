import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, PageWrap, Modal, EmptyState } from "@/components/ui-lib";
import { Plus, Webhook, Trash2, Zap, Power } from "lucide-react";
import { toast } from "sonner";

const KINDS = [
  { id: "slack", label: "Slack", hint: "hooks.slack.com/services/..." },
  { id: "teams", label: "Microsoft Teams", hint: "outlook.office.com/webhook/..." },
  { id: "pagerduty", label: "PagerDuty", hint: "events.pagerduty.com/v2/enqueue" },
  { id: "custom", label: "Custom HTTPS", hint: "your webhook URL" },
];

const EVENTS = ["block", "escalate", "modify", "allow"];

const empty = {
  name: "",
  url: "",
  kind: "slack",
  events: ["block", "escalate"],
  enabled: true,
};

export default function Webhooks() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => setItems((await api.get("/webhooks")).data);
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/webhooks", form);
      toast.success("Webhook created");
      setForm(empty);
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (w) => {
    await api.patch(`/webhooks/${w.id}`, { ...w, enabled: !w.enabled });
    load();
  };

  const remove = async (w) => {
    if (!window.confirm(`Delete "${w.name}"?`)) return;
    await api.delete(`/webhooks/${w.id}`);
    load();
  };

  const test = async (w) => {
    const { data } = await api.post(`/webhooks/${w.id}/test`);
    if (data.ok) toast.success(`Test delivered (HTTP ${data.status})`);
    else toast.error(`Delivery failed (HTTP ${data.status})`);
  };

  const toggleEvent = (ev) => {
    const has = form.events.includes(ev);
    setForm({
      ...form,
      events: has ? form.events.filter((e) => e !== ev) : [...form.events, ev],
    });
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Notifications"
        title="Webhooks"
        subtitle="Push decision events to Slack, Teams, PagerDuty, or any HTTPS endpoint."
        testid="webhooks-header"
        right={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setOpen(true)}
            data-testid="new-webhook-button"
          >
            <Plus size={14} /> Add webhook
          </button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No webhooks configured"
          subtitle="Route blocks & escalations to your on-call channel in seconds."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((w) => (
            <div key={w.id} className="surface rounded-xl p-5" data-testid={`webhook-${w.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border hairline flex items-center justify-center bg-black/40">
                    <Webhook size={16} className="text-cyan-300" />
                  </div>
                  <div>
                    <div className="font-display text-[15px]">{w.name}</div>
                    <div className="text-[11px] text-neutral-500 font-mono-plex uppercase mt-0.5">
                      {w.kind}
                    </div>
                  </div>
                </div>
                <span
                  className={`badge ${w.enabled ? "badge-allow" : "badge-muted"}`}
                >
                  {w.enabled ? "active" : "paused"}
                </span>
              </div>
              <div className="font-mono-plex text-[11.5px] text-neutral-400 truncate mb-3">
                {w.url}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {(w.events || []).map((ev) => (
                  <span key={ev} className={`badge badge-${ev}`}>
                    {ev}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500 pt-3 border-t hairline">
                <div className="font-mono-plex">
                  delivered · {w.delivery_count || 0}
                </div>
                <div className="flex items-center gap-1">
                  <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => test(w)}>
                    <Zap size={12} /> Test
                  </button>
                  <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => toggle(w)}>
                    <Power size={12} />
                  </button>
                  <button className="btn-danger text-xs" onClick={() => remove(w)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add webhook" testid="webhook-modal">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Name
              </label>
              <input
                className="input mt-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-testid="webhook-name-input"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Provider
              </label>
              <select
                className="select mt-2"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Webhook URL
            </label>
            <input
              className="input mt-2 font-mono-plex text-[12.5px]"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder={KINDS.find((k) => k.id === form.kind)?.hint}
              required
              data-testid="webhook-url-input"
            />
          </div>
          <div>
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
              Trigger on
            </div>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map((ev) => {
                const on = form.events.includes(ev);
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEvent(ev)}
                    className={`badge ${on ? `badge-${ev}` : "badge-muted"} cursor-pointer`}
                  >
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving} data-testid="webhook-save-button">
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </PageWrap>
  );
}
