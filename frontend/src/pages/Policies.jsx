import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import {
  PageHeader,
  PageWrap,
  Modal,
  DecisionBadge,
  EmptyState,
} from "@/components/ui-lib";
import { Plus, ScrollText, Trash2, Power } from "lucide-react";
import { toast } from "sonner";

const emptyPolicy = {
  name: "",
  description: "",
  priority: 100,
  subject: "*",
  resource_pattern: "*",
  action: "*",
  effect: "allow",
  modify_instructions: "",
  conditions: [],
  enabled: true,
};

const fields = ["risk_score", "agent_trust", "purpose", "resource", "action"];
const ops = ["equals", "not_equals", "contains", "gt", "lt", "in", "not_in"];
const actions = ["*", "read", "write", "execute", "delete"];
const effects = ["allow", "block", "modify", "escalate"];

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyPolicy);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: pol }, { data: ags }] = await Promise.all([
      api.get("/policies"),
      api.get("/agents"),
    ]);
    setPolicies(pol);
    setAgents(ags);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const normalizeConditionValue = (c) => {
    if (c.op === "gt" || c.op === "lt") return Number(c.value);
    if (c.op === "in" || c.op === "not_in")
      return String(c.value)
        .split(",")
        .map((x) => x.trim());
    return c.value;
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        priority: Number(form.priority),
        conditions: form.conditions.map((c) => ({
          ...c,
          value: normalizeConditionValue(c),
        })),
      };
      await api.post("/policies", payload);
      toast.success("Policy created");
      setForm(emptyPolicy);
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p) => {
    await api.patch(`/policies/${p.id}`, { ...p, enabled: !p.enabled });
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete policy "${p.name}"?`)) return;
    await api.delete(`/policies/${p.id}`);
    toast.success("Policy deleted");
    load();
  };

  const addCondition = () =>
    setForm({
      ...form,
      conditions: [
        ...form.conditions,
        { _uid: crypto.randomUUID(), field: "risk_score", op: "gt", value: 60 },
      ],
    });

  const setCond = (i, patch) => {
    const list = [...form.conditions];
    list[i] = { ...list[i], ...patch };
    setForm({ ...form, conditions: list });
  };

  const removeCond = (i) =>
    setForm({
      ...form,
      conditions: form.conditions.filter((_, idx) => idx !== i),
    });

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Policy engine"
        title="Policies"
        subtitle="Compose ordered rules that decide whether every agent action should be allowed, modified, escalated, or blocked."
        testid="policies-header"
        right={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setOpen(true)}
            data-testid="new-policy-button"
          >
            <Plus size={14} /> New policy
          </button>
        }
      />

      {policies.length === 0 ? (
        <EmptyState
          title="No policies yet"
          subtitle="Create a policy to start governing agent actions."
        />
      ) : (
        <div className="surface rounded-xl overflow-hidden" data-testid="policies-list">
          <table className="gtable">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Name</th>
                <th>Resource</th>
                <th>Action</th>
                <th>Effect</th>
                <th>Hits</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} data-testid={`policy-row-${p.id}`}>
                  <td className="font-mono-plex text-neutral-500">
                    {p.priority}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <ScrollText
                        size={14}
                        className={
                          p.enabled ? "text-cyan-300" : "text-neutral-600"
                        }
                      />
                      <div>
                        <div
                          className={
                            p.enabled ? "" : "text-neutral-500 line-through"
                          }
                        >
                          {p.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {p.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono-plex text-[12.5px]">
                    {p.resource_pattern}
                  </td>
                  <td className="font-mono-plex text-[12.5px]">{p.action}</td>
                  <td>
                    <DecisionBadge decision={p.effect} />
                  </td>
                  <td className="font-mono-plex text-neutral-400">{p.hits}</td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => toggle(p)}
                        className="text-neutral-400 hover:text-white p-1.5 rounded-md border hairline"
                        data-testid={`policy-toggle-${p.id}`}
                        title={p.enabled ? "Disable" : "Enable"}
                      >
                        <Power size={13} />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="text-neutral-400 hover:text-rose-400 p-1.5 rounded-md border hairline"
                        data-testid={`policy-delete-${p.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New policy"
        testid="policy-modal"
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Name
              </label>
              <input
                className="input mt-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-testid="policy-name-input"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Priority
              </label>
              <input
                type="number"
                className="input mt-2"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value })
                }
                data-testid="policy-priority-input"
              />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Subject (agent)
              </label>
              <select
                className="select mt-2"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                data-testid="policy-subject-select"
              >
                <option value="*">Any agent (*)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Action
              </label>
              <select
                className="select mt-2"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                data-testid="policy-action-select"
              >
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Resource pattern
            </label>
            <input
              className="input mt-2 font-mono-plex"
              value={form.resource_pattern}
              placeholder="customers.* or billing.write"
              onChange={(e) =>
                setForm({ ...form, resource_pattern: e.target.value })
              }
              data-testid="policy-resource-input"
            />
          </div>

          <div className="border-t hairline pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-neutral-400 uppercase tracking-wider">
                Conditions
              </div>
              <button
                type="button"
                onClick={addCondition}
                className="btn-secondary text-xs"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {form.conditions.length === 0 && (
                <div className="text-xs text-neutral-600 font-mono-plex">
                  No conditions — this policy matches on subject / resource /
                  action alone.
                </div>
              )}
              {form.conditions.map((c, i) => (
                <div key={c._uid || i} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    className="select col-span-3"
                    value={c.field}
                    onChange={(e) => setCond(i, { field: e.target.value })}
                  >
                    {fields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select col-span-3"
                    value={c.op}
                    onChange={(e) => setCond(i, { op: e.target.value })}
                  >
                    {ops.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input col-span-5 font-mono-plex"
                    value={c.value}
                    onChange={(e) => setCond(i, { value: e.target.value })}
                  />
                  <button
                    type="button"
                    className="col-span-1 text-neutral-400 hover:text-rose-400"
                    onClick={() => removeCond(i)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t hairline pt-4">
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Effect
              </label>
              <select
                className="select mt-2"
                value={form.effect}
                onChange={(e) => setForm({ ...form, effect: e.target.value })}
                data-testid="policy-effect-select"
              >
                {effects.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            {form.effect === "modify" && (
              <div>
                <label className="text-xs text-neutral-400 uppercase tracking-wider">
                  Modify instructions
                </label>
                <input
                  className="input mt-2"
                  value={form.modify_instructions}
                  onChange={(e) =>
                    setForm({ ...form, modify_instructions: e.target.value })
                  }
                  placeholder="e.g. redact email, phone"
                />
              </div>
            )}
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
              data-testid="policy-save-button"
            >
              {saving ? "Saving…" : "Save policy"}
            </button>
          </div>
        </form>
      </Modal>
    </PageWrap>
  );
}
