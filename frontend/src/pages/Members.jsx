import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, PageWrap, Modal, EmptyState } from "@/components/ui-lib";
import { Plus, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";

export default function Members() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "editor", password: "" });

  const load = async () => setItems((await api.get("/members")).data);
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/members", form);
      toast.success("Member added");
      setForm({ email: "", name: "", role: "editor", password: "" });
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const changeRole = async (u, role) => {
    await api.patch(`/members/${u.id}`, { role });
    toast.success("Role updated");
    load();
  };

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.email}?`)) return;
    await api.delete(`/members/${u.id}`);
    toast.success("Removed");
    load();
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Access control"
        title="Members"
        subtitle="Invite teammates and assign roles. Every mutation is enforced by role and captured in the audit trail."
        testid="members-header"
        right={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setOpen(true)}
            data-testid="new-member-button"
          >
            <UserPlus size={14} /> Invite member
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          ["Owner",  "Full org control · billing", "owner"],
          ["Admin",  "Manage members, keys, hooks, connectors", "admin"],
          ["Editor", "Create & rotate agents / policies", "editor"],
          ["Viewer", "Read-only observability", "viewer"],
        ].map(([n, d]) => (
          <div key={n} className="surface rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
              Role
            </div>
            <div className="font-display text-lg mt-1">{n}</div>
            <div className="text-xs text-neutral-500 mt-1">{d}</div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No members" />
      ) : (
        <div className="surface rounded-xl overflow-hidden">
          <table className="gtable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} data-testid={`member-${u.id}`}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full border hairline flex items-center justify-center text-[11px] font-display bg-black/40">
                        {(u.name || u.email).slice(0, 1).toUpperCase()}
                      </div>
                      {u.name || "—"}
                      {u.id === me?.id && (
                        <span className="badge badge-allow">you</span>
                      )}
                    </div>
                  </td>
                  <td className="font-mono-plex text-[12.5px]">{u.email}</td>
                  <td>
                    {u.role === "owner" ? (
                      <span className="badge badge-modify">owner</span>
                    ) : (
                      <select
                        className="select"
                        value={u.role}
                        disabled={u.id === me?.id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        data-testid={`role-${u.id}`}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="text-neutral-500 text-xs">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </td>
                  <td>
                    {u.role !== "owner" && u.id !== me?.id && (
                      <button className="btn-danger text-xs" onClick={() => remove(u)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Invite member" testid="member-modal">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">Name</label>
              <input
                className="input mt-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-testid="member-name-input"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">Role</label>
              <select
                className="select mt-2"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">Email</label>
            <input
              className="input mt-2"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              data-testid="member-email-input"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Initial password (share out-of-band)
            </label>
            <input
              className="input mt-2 font-mono-plex text-[12.5px]"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required
              data-testid="member-password-input"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" data-testid="member-save-button">
              Invite
            </button>
          </div>
        </form>
      </Modal>
    </PageWrap>
  );
}
