import { X } from "lucide-react";
import { useEffect } from "react";

export function PageHeader({ eyebrow, title, subtitle, right, testid }) {
  return (
    <div
      className="flex items-start justify-between gap-6 mb-8"
      data-testid={testid}
    >
      <div>
        {eyebrow && (
          <div className="text-[11px] tracking-[0.15em] uppercase text-neutral-500 font-mono-plex mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-3xl tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-neutral-400 text-sm mt-2 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function PageWrap({ children }) {
  return <div className="p-8 max-w-[1400px] mx-auto">{children}</div>;
}

export function DecisionBadge({ decision }) {
  const cls =
    {
      allow: "badge-allow",
      block: "badge-block",
      escalate: "badge-escalate",
      modify: "badge-modify",
    }[decision] || "badge-muted";
  return (
    <span className={`badge ${cls}`} data-testid={`decision-badge-${decision}`}>
      <span
        className="dot"
        style={{
          background: {
            allow: "#00e5ff",
            block: "#ff3366",
            escalate: "#ffb800",
            modify: "#8b5cf6",
          }[decision],
        }}
      />
      {decision}
    </span>
  );
}

export function StatusPill({ status }) {
  const map = {
    active: ["#00e5ff", "badge-allow"],
    paused: ["#ffb800", "badge-escalate"],
    revoked: ["#ff3366", "badge-block"],
  };
  const [color, cls] = map[status] || ["#9ca3af", "badge-muted"];
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" style={{ background: color }} />
      {status}
    </span>
  );
}

export function Modal({ open, onClose, title, children, testid }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="dialog-backdrop" onClick={onClose} />
      <div className="dialog-panel" data-testid={testid}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-lg tracking-tight">{title}</div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white"
            data-testid="modal-close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function EmptyState({ title, subtitle, action }) {
  return (
    <div className="surface rounded-xl p-12 flex flex-col items-center justify-center text-center">
      <div className="font-display text-lg">{title}</div>
      {subtitle && (
        <div className="text-neutral-500 text-sm mt-2 max-w-md">{subtitle}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, accent }) {
  return (
    <div className="surface rounded-xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
        {label}
      </div>
      <div className="stat-num mt-3" style={{ color: accent || "#f3f4f6" }}>
        {value}
      </div>
      {hint && (
        <div className="text-xs text-neutral-500 mt-1 font-mono-plex">
          {hint}
        </div>
      )}
    </div>
  );
}
