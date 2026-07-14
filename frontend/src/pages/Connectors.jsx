import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, PageWrap, Modal, EmptyState } from "@/components/ui-lib";
import { Plus, Trash2, Plug, Zap, Database, Server, Cloud, Boxes, Layers } from "lucide-react";
import { toast } from "sonner";

const CATALOG = [
  { kind: "postgres",  label: "PostgreSQL", icon: Database,  fields: ["host", "port", "database"] },
  { kind: "mongodb",   label: "MongoDB",    icon: Database,  fields: ["url"] },
  { kind: "surrealdb", label: "SurrealDB",  icon: Layers,    fields: ["url", "namespace", "database"] },
  { kind: "redis",     label: "Redis",      icon: Server,    fields: ["host", "port"] },
  { kind: "pinecone",  label: "Pinecone",   icon: Boxes,     fields: ["endpoint", "index", "api_key"] },
  { kind: "qdrant",    label: "Qdrant",     icon: Boxes,     fields: ["url", "collection", "api_key"] },
  { kind: "rest",      label: "REST API",   icon: Cloud,     fields: ["url", "headers"] },
];

export default function Connectors() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("postgres");
  const [form, setForm] = useState({ name: "", scope: "", config: {} });

  const load = async () => setItems((await api.get("/connectors")).data);
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/connectors", { ...form, kind });
      toast.success("Connector added");
      setForm({ name: "", scope: "", config: {} });
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete connector "${c.name}"?`)) return;
    await api.delete(`/connectors/${c.id}`);
    load();
  };

  const test = async (c) => {
    toast.loading("Testing…", { id: `t-${c.id}` });
    const { data } = await api.post(`/connectors/${c.id}/test`);
    if (data.ok) toast.success(`OK — ${data.detail}`, { id: `t-${c.id}` });
    else toast.error(`Failed — ${data.detail}`, { id: `t-${c.id}` });
    load();
  };

  const currentSpec = CATALOG.find((c) => c.kind === kind);

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Integrations"
        title="Enterprise connectors"
        subtitle="Register the data planes MemoryGate sits in front of — every agent action to these targets is evaluated at runtime."
        testid="connectors-header"
        right={
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setOpen(true)}
            data-testid="new-connector-button"
          >
            <Plus size={14} /> Add connector
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-6">
        {CATALOG.map((c) => (
          <button
            key={c.kind}
            onClick={() => {
              setKind(c.kind);
              setOpen(true);
              setForm({ name: "", scope: "", config: {} });
            }}
            className="surface rounded-xl p-3 flex flex-col items-center gap-2 hover:border-white/20 transition-colors"
            data-testid={`catalog-${c.kind}`}
          >
            <c.icon size={18} className="text-cyan-300" />
            <div className="text-xs">{c.label}</div>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No connectors yet"
          subtitle="Register the enterprise systems your agents reach through — MemoryGate becomes the enforcement layer."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => {
            const spec = CATALOG.find((x) => x.kind === c.kind);
            const Icon = spec?.icon || Plug;
            return (
              <div key={c.id} className="surface rounded-xl p-5" data-testid={`connector-${c.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg border hairline flex items-center justify-center bg-black/40">
                      <Icon size={16} className="text-cyan-300" />
                    </div>
                    <div>
                      <div className="font-display text-[15px]">{c.name}</div>
                      <div className="text-[11px] text-neutral-500 font-mono-plex uppercase mt-0.5">
                        {spec?.label || c.kind}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      c.status === "healthy"
                        ? "badge-allow"
                        : c.status === "degraded"
                        ? "badge-block"
                        : "badge-muted"
                    }`}
                  >
                    {c.status || "unknown"}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 space-y-1 mb-4">
                  {Object.entries(c.config || {}).slice(0, 3).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-neutral-600 font-mono-plex">{k}</span>
                      <span className="font-mono-plex text-neutral-400 truncate ml-2 max-w-[180px]">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                  {c.scope && (
                    <div className="flex justify-between border-t hairline pt-2 mt-2">
                      <span className="text-neutral-600 font-mono-plex">scope</span>
                      <span className="font-mono-plex text-neutral-400">{c.scope}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => test(c)}>
                    <Zap size={12} /> Test connection
                  </button>
                  <button className="btn-danger text-xs ml-auto" onClick={() => remove(c)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={`Add ${currentSpec?.label || "connector"}`} testid="connector-modal">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">Name</label>
              <input
                className="input mt-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-testid="connector-name-input"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">Type</label>
              <select className="select mt-2" value={kind} onChange={(e) => setKind(e.target.value)}>
                {CATALOG.map((c) => (
                  <option key={c.kind} value={c.kind}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Scope (resource pattern)
            </label>
            <input
              className="input mt-2 font-mono-plex"
              value={form.scope}
              placeholder="customers.* or billing.write"
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
            />
          </div>
          <div className="border-t hairline pt-4">
            <div className="text-xs text-neutral-400 uppercase tracking-wider mb-3">Config</div>
            <div className="grid grid-cols-2 gap-3">
              {currentSpec?.fields.map((f) => (
                <div key={f} className={f === "headers" ? "col-span-2" : ""}>
                  <label className="text-[11px] text-neutral-500 font-mono-plex">{f}</label>
                  <input
                    className="input mt-1 font-mono-plex text-[12.5px]"
                    value={form.config[f] || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: { ...form.config, [f]: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" data-testid="connector-save-button">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </PageWrap>
  );
}
