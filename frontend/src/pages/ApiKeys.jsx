import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, PageWrap, Modal, EmptyState } from "@/components/ui-lib";
import { Plus, Copy, RotateCw, Ban, KeyRound, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function ApiKeys() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "editor" });
  const [revealed, setRevealed] = useState(null);

  const load = async () => {
    const { data } = await api.get("/api-keys");
    setItems(data);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/api-keys", form);
      setRevealed(data);
      setForm({ name: "", role: "editor" });
      setOpen(false);
      toast.success("API key created — copy the secret now, it won't be shown again");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const rotate = async (id) => {
    if (!window.confirm("Rotate this key? The old secret will stop working immediately.")) return;
    const { data } = await api.post(`/api-keys/${id}/rotate`);
    setRevealed({ id, secret: data.secret, name: items.find((i) => i.id === id)?.name });
    toast.success("Rotated");
    load();
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoke this key permanently?")) return;
    await api.post(`/api-keys/${id}/revoke`);
    toast.success("Revoked");
    load();
  };

  const copy = (t) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied to clipboard");
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Access"
        title="API keys"
        subtitle="Programmatic credentials for SDK / server integrations. Keys are scoped by role and never shown again after creation."
        testid="apikeys-header"
        right={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setOpen(true)}
            data-testid="new-key-button"
          >
            <Plus size={14} /> Create key
          </button>
        }
      />

      {revealed && (
        <div className="surface rounded-xl p-5 mb-4 border border-cyan-500/40 bg-cyan-500/[0.03]">
          <div className="flex items-center gap-2 text-cyan-300 text-xs uppercase tracking-wider font-mono-plex mb-2">
            <Check size={14} /> new secret — copy it now
          </div>
          <div className="text-sm text-neutral-300 mb-3">{revealed.name}</div>
          <div className="flex items-center gap-2 surface rounded-lg p-3">
            <code className="font-mono-plex text-[13px] flex-1 truncate">
              {revealed.secret}
            </code>
            <button
              onClick={() => copy(revealed.secret)}
              className="btn-secondary flex items-center gap-1"
              data-testid="copy-secret-button"
            >
              <Copy size={13} /> Copy
            </button>
            <button
              onClick={() => setRevealed(null)}
              className="text-neutral-500 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No API keys yet"
          subtitle="Create one to authenticate your SDK integrations with MemoryGate."
        />
      ) : (
        <div className="surface rounded-xl overflow-hidden">
          <table className="gtable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Role</th>
                <th>Created</th>
                <th>Last used</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((k) => (
                <tr key={k.id} data-testid={`key-row-${k.id}`}>
                  <td>
                    <div className="flex items-center gap-2">
                      <KeyRound size={14} className="text-cyan-300" />
                      {k.name}
                    </div>
                  </td>
                  <td className="font-mono-plex text-[12.5px]">
                    {k.prefix}…{k.suffix}
                  </td>
                  <td className="capitalize">{k.role}</td>
                  <td className="text-neutral-400 text-xs">
                    {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                  </td>
                  <td className="text-neutral-400 text-xs">
                    {k.last_used_at
                      ? formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })
                      : "never"}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="btn-secondary text-xs flex items-center gap-1"
                        onClick={() => rotate(k.id)}
                        data-testid={`rotate-${k.id}`}
                      >
                        <RotateCw size={12} /> Rotate
                      </button>
                      <button
                        className="btn-danger text-xs flex items-center gap-1"
                        onClick={() => revoke(k.id)}
                        data-testid={`revoke-${k.id}`}
                      >
                        <Ban size={12} /> Revoke
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
        title="Create API key"
        testid="key-modal"
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
              data-testid="key-name-input"
              placeholder="Production SDK"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Role
            </label>
            <select
              className="select mt-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              data-testid="key-role-select"
            >
              <option value="viewer">Viewer — read only</option>
              <option value="editor">Editor — evaluate + write</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" data-testid="key-save-button">
              Create
            </button>
          </div>
        </form>
      </Modal>
    </PageWrap>
  );
}
