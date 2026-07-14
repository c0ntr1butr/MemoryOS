import { useState } from "react";
import { PublicShell } from "./PublicShell";
import { Link } from "react-router-dom";
import { Terminal, Copy, Boxes, Cloud, Server, ArrowRight, BookOpen, Code2 } from "lucide-react";
import { toast } from "sonner";

const QUICKSTART = `# 1. Install the SDK
pip install memorygate

# 2. Create an API key in the console (Settings → API keys)
export MEMORYGATE_API_KEY=mg_...

# 3. Guard your first agent action
from memorygate import Client
mg = Client(default_agent_id="agent_crm_copilot")

decision = mg.evaluate(
    resource="customers.read",
    action="read",
    purpose="Summarize account 42",
    payload={"customer_id": 42},
)
if decision.allowed:
    result = crm.read(decision.effective_payload)
else:
    raise decision.to_exception()
`;

const DEPLOY = {
  docker: `# Single-node pilot (works on a laptop or a bastion)
docker run --name memorygate \\
    -p 8080:8080 \\
    -e MONGO_URL="mongodb://mongo:27017" \\
    -e JWT_SECRET="$(openssl rand -hex 32)" \\
    -e ENVIRONMENT=production \\
    -e ALLOWED_ORIGINS="https://console.your-org.example.com" \\
    ghcr.io/memorygate/runtime:0.4

# Then point your agents at http://<host>:8080 via the SDK's base_url.
`,
  kubernetes: `# helm repo add memorygate https://charts.memorygate.dev
# helm install memorygate memorygate/runtime \\
#     --namespace memorygate --create-namespace \\
#     -f values.yaml

# values.yaml (production-ready)
replicas: 3
image:
  repository: ghcr.io/memorygate/runtime
  tag: "0.4"
mongo:
  # bring your own replica set — do NOT run the embedded single-node in prod
  externalUrl: "mongodb+srv://memorygate:...@cluster0.mongodb.net/memorygate"
ingress:
  enabled: true
  host: api.your-org.internal
  tls: true
  className: nginx
resources:
  requests: { cpu: 500m, memory: 512Mi }
  limits:   { cpu: 2,    memory: 2Gi   }
autoscaling:
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 65
podDisruptionBudget:
  enabled: true
  minAvailable: 2
env:
  JWT_SECRET: { valueFrom: { secretKeyRef: { name: mg-secrets, key: jwt-secret } } }
  ALLOWED_ORIGINS: "https://console.your-org.example.com"
  ENVIRONMENT: production
`,
  aws: `# terraform module (excerpt)
module "memorygate" {
  source  = "memorygate/runtime/aws"
  version = "0.4"

  vpc_id             = aws_vpc.main.id
  private_subnet_ids = aws_subnet.private[*].id
  desired_count      = 3
  cpu                = 1024
  memory             = 2048

  documentdb_engine  = "mongodb"
  documentdb_size    = "db.r6g.large"

  domain_name        = "api.memorygate.your-org.io"
  route53_zone_id    = data.aws_route53_zone.main.id
  acm_certificate    = aws_acm_certificate.mg.arn

  env = {
    ENVIRONMENT     = "production"
    ALLOWED_ORIGINS = "https://console.your-org.io"
  }

  tags = { Owner = "ai-platform", Compliance = "soc2" }
}

# ECS Fargate service + DocumentDB + ALB + WAF + CloudWatch dashboards
# are provisioned in-module. Terraform apply typically < 10 minutes.
`,
  azure: `# Azure Container Apps + Cosmos DB (Mongo API)
# az containerapp create ...

# Bicep module (excerpt)
module memorygate './memorygate/runtime.bicep' = {
  name: 'memorygate'
  params: {
    location:        location
    replicaCount:    3
    cpu:             '1.0'
    memoryGb:        '2.0'
    cosmosMongoName: 'mg-prod-mongo'
    ingressExternal: true
    keyVaultName:    kv.outputs.name
    logAnalyticsId:  law.outputs.id
    env: {
      ENVIRONMENT:      'production'
      ALLOWED_ORIGINS:  'https://console.your-org.io'
    }
  }
}
`,
  gcp: `# GCP: Cloud Run + Firestore (MongoDB compat via Atlas) OR MongoDB Atlas on GCP
# gcloud run deploy memorygate ...

# terraform (excerpt)
resource "google_cloud_run_v2_service" "memorygate" {
  name     = "memorygate-runtime"
  location = var.region
  template {
    scaling { min_instance_count = 3, max_instance_count = 20 }
    containers {
      image = "ghcr.io/memorygate/runtime:0.4"
      resources { limits = { cpu = "2", memory = "2Gi" } }
      env {
        name  = "MONGO_URL"
        value_source { secret_key_ref { secret = "mg-mongo-url", version = "latest" } }
      }
      env { name = "ENVIRONMENT", value = "production" }
    }
    vpc_access { connector = google_vpc_access_connector.serverless.id }
  }
}
`,
};

const DEPLOY_TARGETS = [
  { id: "docker",     label: "Docker",     icon: Boxes,  hint: "pilots & single-node" },
  { id: "kubernetes", label: "Kubernetes", icon: Server, hint: "production · Helm chart" },
  { id: "aws",        label: "AWS",        icon: Cloud,  hint: "ECS Fargate + DocumentDB" },
  { id: "azure",      label: "Azure",      icon: Cloud,  hint: "Container Apps + Cosmos" },
  { id: "gcp",        label: "GCP",        icon: Cloud,  hint: "Cloud Run + Atlas" },
];

const SECTIONS = [
  ["quickstart", "Quickstart"],
  ["deploy",     "Deployment"],
  ["python",     "Python SDK"],
  ["typescript", "TypeScript SDK"],
  ["middleware", "Framework middleware"],
  ["mcp",        "MCP proxy"],
  ["api",        "API reference"],
];

export default function Docs() {
  const [target, setTarget] = useState("kubernetes");
  const copy = (s) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  return (
    <PublicShell>
      <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <aside className="lg:sticky lg:top-24 self-start h-fit">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex mb-3 flex items-center gap-2">
            <BookOpen size={12} /> Docs
          </div>
          <nav className="space-y-1">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="sidebar-link text-sm"
              >
                {label}
              </a>
            ))}
            <a href="/api/docs" className="sidebar-link text-sm" target="_blank" rel="noreferrer">
              OpenAPI / Swagger ↗
            </a>
          </nav>
        </aside>

        <div className="min-w-0 space-y-16">
          {/* Quickstart */}
          <div id="quickstart">
            <div className="text-[11px] tracking-[0.2em] uppercase text-cyan-300 font-mono-plex mb-3">
              5-minute quickstart
            </div>
            <h1 className="font-display text-4xl tracking-tight">From zero to first governed decision.</h1>
            <p className="text-neutral-400 mt-4 max-w-2xl">
              Install the SDK, drop <code className="font-mono-plex text-cyan-300">mg.evaluate()</code>
              around your first agent action, and inspect the trace in the console.
            </p>
            <CodeBlock code={QUICKSTART} onCopy={copy} />
          </div>

          {/* Deployment */}
          <div id="deploy">
            <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 font-mono-plex mb-3">
              deployment
            </div>
            <h2 className="font-display text-3xl tracking-tight">
              Deploy where your agents already run.
            </h2>
            <p className="text-neutral-400 mt-3 max-w-2xl">
              MemoryGate is a single stateless FastAPI service backed by MongoDB. Ship it on
              Kubernetes, ECS/Fargate, Container Apps, or Cloud Run — same image, same config.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {DEPLOY_TARGETS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTarget(t.id)}
                  data-testid={`deploy-${t.id}`}
                  className={`surface rounded-lg px-4 py-3 flex items-center gap-2.5 transition-colors ${
                    target === t.id ? "border-cyan-500/40 bg-cyan-500/[0.04]" : ""
                  }`}
                >
                  <t.icon size={14} className={target === t.id ? "text-cyan-300" : "text-neutral-400"} />
                  <div className="text-left">
                    <div className="text-sm">{t.label}</div>
                    <div className="text-[10.5px] text-neutral-500">{t.hint}</div>
                  </div>
                </button>
              ))}
            </div>
            <CodeBlock code={DEPLOY[target]} onCopy={copy} />
          </div>

          {/* Python SDK */}
          <div id="python">
            <h2 className="font-display text-3xl tracking-tight">Python SDK</h2>
            <p className="text-neutral-400 mt-3">
              Sync and async clients. Typed <code className="font-mono-plex text-cyan-300">Decision</code>
              with <code className="font-mono-plex">.allowed</code>, <code className="font-mono-plex">.effective_payload</code>,
              <code className="font-mono-plex">.trace</code>, and <code className="font-mono-plex">.to_exception()</code>.
            </p>
            <CodeBlock onCopy={copy} code={`from memorygate import Client, AsyncClient

# Sync — one Client per process
mg = Client(api_key="mg_...", default_agent_id="agent_crm_copilot")

d = mg.evaluate(resource="customers.read", action="read",
                purpose="answer ticket", payload={"customer_id": 42})

# .guard() raises on block/escalate — great inside your existing exception paths
payload = mg.guard(resource="prod.deploy", action="execute",
                   purpose="release v1.2.3").effective_payload

# Async — same surface, awaitable
async with AsyncClient(api_key="mg_...") as mg:
    d = await mg.evaluate(agent_id="a_1", resource="billing.write", action="write")
`}/>
          </div>

          {/* TypeScript SDK */}
          <div id="typescript">
            <h2 className="font-display text-3xl tracking-tight">TypeScript SDK</h2>
            <CodeBlock onCopy={copy} code={`import { MemoryGate } from "@memorygate/sdk";

const mg = new MemoryGate({ apiKey: process.env.MG_KEY! });

const d = await mg.evaluate({
  agentId: "agent_crm_copilot",
  resource: "customers.read",
  action: "read",
  purpose: "Summarize account 42",
  payload: { customerId: 42 },
});

if (d.allowed) return crm.read(d.effectivePayload!);
throw d.toException();
`}/>
          </div>

          {/* Framework middleware */}
          <div id="middleware">
            <h2 className="font-display text-3xl tracking-tight">Framework middleware</h2>
            <p className="text-neutral-400 mt-3">
              Every middleware wraps your tool call sites so the governance layer stays invisible in application code.
            </p>
            {[
              ["LangGraph",  `from memorygate.middleware.langgraph import governed_node
graph.add_node("crm", governed_node(call_crm, mg=mg,
    agent_id="agent_crm_copilot",
    resource_from=lambda s: f"crm.{s['op']}",
    payload_from=lambda s: s["args"]))`],
              ["OpenAI Agents SDK", `from memorygate.middleware.openai_agents import governed
guarded = governed(agent, mg=mg, agent_id="agent_crm_copilot")
Runner.run_sync(guarded, "Summarize account 42")`],
              ["CrewAI", `from memorygate.middleware.crewai import GovernedCrew
crew = GovernedCrew(agents=[analyst], tasks=[t], mg=mg,
                    agent_id_for=lambda a: f"agent_{a.role}")`],
              ["Google ADK", `from memorygate.middleware.google_adk import governed
governed(agent, mg=mg, agent_id="agent_gemini_crm")`],
            ].map(([label, code]) => (
              <div key={label} className="mt-4">
                <div className="text-sm text-neutral-300 mb-1">{label}</div>
                <CodeBlock onCopy={copy} code={code} />
              </div>
            ))}
          </div>

          {/* MCP */}
          <div id="mcp">
            <h2 className="font-display text-3xl tracking-tight">MCP proxy</h2>
            <p className="text-neutral-400 mt-3">
              Governance in front of any Model Context Protocol server. Zero code changes in
              the calling agent — just repoint the MCP URL.
            </p>
            <CodeBlock onCopy={copy} code={`memorygate mcp-proxy \\
    --upstream https://mcp.internal.example.com \\
    --api-key mg_... \\
    --agent-id agent_mcp_gateway \\
    --listen 0.0.0.0:7443

# Then in your MCP client:
#   MCP_URL=http://memorygate-mcp.internal:7443/mcp
`}/>
          </div>

          {/* API */}
          <div id="api">
            <h2 className="font-display text-3xl tracking-tight">API reference</h2>
            <p className="text-neutral-400 mt-3">
              Full OpenAPI 3.1 spec with 35+ endpoints across 13 tag groups. Try any endpoint
              inline with Swagger.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="/api/docs" target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-2">
                <Code2 size={13} /> Swagger UI
              </a>
              <a href="/api/redoc" target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2">
                ReDoc
              </a>
              <a href="/api/openapi.json" target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2">
                openapi.json
              </a>
              <Link to="/playground" className="btn-secondary flex items-center gap-2">
                Live playground <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function CodeBlock({ code, onCopy }) {
  return (
    <div className="surface rounded-xl overflow-hidden mt-4 relative group">
      <button
        onClick={() => onCopy(code)}
        className="absolute right-3 top-3 btn-secondary text-xs flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
      >
        <Copy size={11} /> Copy
      </button>
      <pre className="font-mono-plex text-[12.5px] p-5 pt-4 overflow-auto text-neutral-300 leading-relaxed max-h-[520px]">
{code}
      </pre>
    </div>
  );
}
