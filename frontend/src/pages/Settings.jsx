import { useAuth } from "@/lib/auth";
import { PageHeader, PageWrap } from "@/components/ui-lib";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Manage your organization and integration keys."
        testid="settings-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
            Account
          </div>
          <div className="font-display text-lg mt-1 mb-4">Profile</div>
          <div className="space-y-3 text-sm">
            <Row k="Name" v={user?.name} />
            <Row k="Email" v={user?.email} />
            <Row k="Role" v={user?.role} />
            <Row k="Organization ID" v={user?.org_id} mono onCopy={copy} />
          </div>
        </div>

        <div className="surface rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex">
            Integration
          </div>
          <div className="font-display text-lg mt-1 mb-4">Endpoint</div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-[11px] uppercase text-neutral-500 font-mono-plex">
                Evaluate request
              </div>
              <div className="mt-2 surface rounded-lg p-3 font-mono-plex text-[12.5px] overflow-auto">
                POST {`{{BACKEND}}`}/api/evaluate
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-neutral-500 font-mono-plex">
                Sample body
              </div>
              <pre className="mt-2 surface rounded-lg p-3 font-mono-plex text-[12px] overflow-auto text-neutral-300">
{`{
  "agent_id": "<AGENT_ID>",
  "resource": "customers.read",
  "action": "read",
  "purpose": "Summarize recent tickets",
  "context": {"ip": "10.0.0.5"},
  "payload": {"customer_id": 42}
}`}
              </pre>
            </div>
            <div className="text-xs text-neutral-500">
              The engine returns a decision (allow/block/modify/escalate) with
              the matched policy, computed risk and reason.
            </div>
          </div>
        </div>
      </div>
    </PageWrap>
  );
}

function Row({ k, v, mono, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b hairline pb-3 last:border-b-0">
      <div className="text-neutral-500 text-xs uppercase tracking-wider font-mono-plex">
        {k}
      </div>
      <div className="flex items-center gap-2">
        <div className={mono ? "font-mono-plex text-[12.5px]" : ""}>{v}</div>
        {onCopy && (
          <button
            onClick={() => onCopy(v)}
            className="text-neutral-500 hover:text-white"
          >
            <Copy size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
