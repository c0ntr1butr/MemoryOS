import { useState } from "react";
import api from "@/lib/api";
import { PageHeader, PageWrap, DecisionBadge } from "@/components/ui-lib";
import { toast } from "sonner";
import { Copy, Play, Code2 } from "lucide-react";

const SNIPPETS = {
  python: `# pip install memorygate
from memorygate import Client

mg = Client(api_key="mg_...")           # from your MemoryGate console

decision = mg.evaluate(
    agent_id="agent_123",
    resource="customers.read",
    action="read",
    purpose="user asked to summarize account",
    payload={"customer_id": 42},
)

if decision.effect == "allow":
    data = your_db.query(decision.payload)
elif decision.effect == "modify":
    data = your_db.query(decision.modified_payload)   # PII-redacted
elif decision.effect == "escalate":
    raise HumanApprovalRequired(decision.id)
else:
    raise PermissionDenied(decision.reason)`,

  typescript: `// npm i @memorygate/sdk
import { MemoryGate } from "@memorygate/sdk";

const mg = new MemoryGate({ apiKey: process.env.MG_KEY! });

const decision = await mg.evaluate({
  agentId: "agent_123",
  resource: "customers.read",
  action: "read",
  purpose: "user asked to summarize account",
  payload: { customerId: 42 },
});

switch (decision.effect) {
  case "allow":    return db.query(decision.payload);
  case "modify":   return db.query(decision.modifiedPayload);
  case "escalate": throw new HumanApprovalRequired(decision.id);
  default:         throw new PermissionDenied(decision.reason);
}`,

  langgraph: `# pip install memorygate langgraph
from memorygate import Client
from langgraph.graph import StateGraph

mg = Client(api_key="mg_...")

def governed_tool(state):
    d = mg.evaluate(
        agent_id=state["agent_id"],
        resource=state["target"],
        action=state["op"],
        purpose=state["reasoning"],
        payload=state["args"],
    )
    if d.effect in ("block", "escalate"):
        return {"halt": True, "reason": d.reason, "decision_id": d.id}
    args = d.modified_payload if d.effect == "modify" else d.args
    return {"result": call_downstream(args)}

graph = StateGraph(dict)
graph.add_node("tool", governed_tool)
graph.compile()`,

  openai: `# pip install memorygate openai-agents
from memorygate.middleware.openai_agents import governed
from agents import Agent, Runner

mg_agent = governed(
    Agent(name="crm-copilot", instructions="Help sales reps..."),
    api_key="mg_...",
    agent_id="agent_123",
)

result = Runner.run(mg_agent, "Summarize account 42 for me")
# Every tool call inside the Agents SDK is routed through mg.evaluate()
# before it reaches the tool implementation.`,

  crewai: `# pip install memorygate crewai
from memorygate.middleware.crewai import GovernedCrew
from crewai import Agent, Task, Crew

crew = GovernedCrew(
    agents=[Agent(role="analyst", goal="Summarize accounts", tools=[...])],
    tasks=[Task(description="Summarize account 42")],
    api_key="mg_...",
)

crew.kickoff()   # tool executions are wrapped by MemoryGate transparently`,

  mcp: `# pip install memorygate mcp
# MemoryGate ships an MCP proxy: place it in front of any MCP server and
# every tool call is evaluated against your policies before reaching the
# real server. Zero code changes in the calling agent.

memorygate mcp-proxy \\
    --upstream https://mcp.example.com \\
    --api-key mg_... \\
    --agent-id agent_123 \\
    --listen 0.0.0.0:7443`,
};

const TABS = [
  { id: "python",     label: "Python SDK" },
  { id: "typescript", label: "TypeScript SDK" },
  { id: "langgraph",  label: "LangGraph" },
  { id: "openai",     label: "OpenAI Agents" },
  { id: "crewai",     label: "CrewAI" },
  { id: "mcp",        label: "MCP" },
];

export default function SDKs() {
  const [tab, setTab] = useState("python");
  const [pb, setPb] = useState({
    agent_id: "",
    resource: "customers.read",
    action: "read",
    purpose: "user asked to summarize account",
    payload: '{"customer_id": 42}',
  });
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const copy = (t) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied");
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      let payload = {};
      try { payload = JSON.parse(pb.payload || "{}"); } catch { payload = {}; }
      const agents = (await api.get("/agents")).data;
      const agent_id = pb.agent_id || agents[0]?.id;
      if (!agent_id) {
        toast.error("Create an agent first");
        return;
      }
      const { data } = await api.post("/evaluate", { ...pb, agent_id, payload });
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Developers"
        title="SDKs & interactive docs"
        subtitle="Drop MemoryGate into any agent framework in under 10 lines. Every example is copy-pasteable and production-shaped."
        testid="sdks-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="surface rounded-xl lg:col-span-3 overflow-hidden">
          <div className="border-b hairline flex overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-xs uppercase tracking-wider font-mono-plex whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? "text-white border-b-2 border-cyan-400"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
                data-testid={`sdk-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              className="absolute right-3 top-3 btn-secondary text-xs flex items-center gap-1"
              onClick={() => copy(SNIPPETS[tab])}
            >
              <Copy size={12} /> Copy
            </button>
            <pre className="font-mono-plex text-[12.5px] p-5 pt-4 overflow-auto max-h-[520px] text-neutral-300 leading-relaxed">
{SNIPPETS[tab]}
            </pre>
          </div>
        </div>

        <div className="surface rounded-xl lg:col-span-2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={16} className="text-cyan-300" />
            <div className="font-display text-lg">Interactive playground</div>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Fires a real <span className="font-mono-plex">/api/evaluate</span> against
            your live policies.
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-[11px] uppercase text-neutral-500 font-mono-plex">Resource</label>
              <input
                className="input mt-1 font-mono-plex"
                value={pb.resource}
                onChange={(e) => setPb({ ...pb, resource: e.target.value })}
                data-testid="playground-resource"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] uppercase text-neutral-500 font-mono-plex">Action</label>
                <select
                  className="select mt-1"
                  value={pb.action}
                  onChange={(e) => setPb({ ...pb, action: e.target.value })}
                >
                  {["read", "write", "execute", "delete"].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase text-neutral-500 font-mono-plex">Purpose</label>
                <input
                  className="input mt-1"
                  value={pb.purpose}
                  onChange={(e) => setPb({ ...pb, purpose: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase text-neutral-500 font-mono-plex">Payload (JSON)</label>
              <textarea
                className="input mt-1 font-mono-plex text-[12px] min-h-[80px]"
                value={pb.payload}
                onChange={(e) => setPb({ ...pb, payload: e.target.value })}
              />
            </div>
            <button
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              onClick={run}
              disabled={running}
              data-testid="playground-run"
            >
              <Play size={14} /> {running ? "Evaluating…" : "Send request"}
            </button>
          </div>

          {result && (
            <div className="mt-5 pt-4 border-t hairline space-y-3" data-testid="playground-result">
              <div className="flex items-center gap-3">
                <DecisionBadge decision={result.decision} />
                <div className="text-xs text-neutral-500 font-mono-plex">
                  risk {result.risk_score} · {result.policy_name}
                </div>
              </div>
              <div className="text-xs text-neutral-400">{result.reason}</div>
              <pre className="font-mono-plex text-[11.5px] surface rounded-lg p-3 overflow-auto max-h-40 text-neutral-300">
{JSON.stringify(result.modified_payload || result.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </PageWrap>
  );
}
