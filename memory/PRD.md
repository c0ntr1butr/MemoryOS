# Sentinel — AI Runtime Governance (PRD)

## Problem statement (verbatim)
AI Runtime Governance is the infrastructure layer that continuously evaluates every autonomous AI interaction—who the agent is, what it is trying to access, why it needs it, what policies apply, and whether the action should be allowed, modified, escalated, or blocked.

User elaboration: framework-agnostic AI Runtime Governance Layer that sits between AI agents and enterprise systems, evaluating every request using identity, policies, context, risk, and approvals. Multi-tenant auth, agent registry, policy builder, runtime decision engine (Allow/Block/Modify/Escalate), audit logs, analytics, and a simulated agent traffic demo. Dark enterprise security console inspired by Stripe, Datadog, and Vercel.

## User personas
- **Security / Platform engineer** — registers agents, authors policies, monitors decisions.
- **Compliance / Risk officer** — audits decisions, reviews escalations, exports evidence.
- **AI application team** — integrates the `/api/evaluate` gate into their agent runtime.

## Architecture
- **Backend**: FastAPI + Motor MongoDB, JWT (httpOnly cookie + Bearer fallback), bcrypt.
- **Frontend**: React 19, React Router, Recharts, Tailwind, framer-motion (via slide-in CSS), Sonner, lucide-react. Dark theme with Outfit / Manrope / IBM Plex Mono.
- **Multi-tenancy**: every resource (agents, policies, decisions, escalations) scoped by `org_id`; the auth token carries it.
- **Decision engine**: ordered policies (by priority) with pattern-matched `resource_pattern`, action, subject, and conditions on `risk_score` / `agent_trust` / `purpose` / etc. Computes a per-request risk score.

## Implemented (Jan 2026)

### V1 — Runtime Governance MVP
- Multi-tenant JWT auth (register auto-creates org, login, logout, `/auth/me`).
- Agent registry, priority-ordered policy engine, `/api/evaluate`, audit logs, escalation queue with human approve/reject.
- Analytics: 12-h timeline, decision mix, top agents, top blocked resources.
- Traffic simulator, seeded demo data (4 agents, 5 policies).
- Production security stack: env-driven CORS allowlist + wildcard suffixes, Origin CSRF guard on mutations, in-process sliding-window rate limiter, security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`), tight pydantic validation, structured JSON audit stream, client-IP + user-agent captured on every decision.

### V2 / V3 — Enterprise platform
- Rebrand to **MemoryGate**, grouped sidebar.
- **API keys** (rotate/revoke), **Webhooks** (Slack/Teams/PagerDuty/custom via real `httpx` delivery), **Connectors** (Postgres/Mongo/SurrealDB/Redis/Pinecone/Qdrant/REST), **Members** + full **RBAC** (owner/admin/editor/viewer) across every mutation, **Policy versioning + rollback**, **Compliance center** (SOC 2 / ISO 27001 / GDPR / HIPAA + CSV export), **Explainable AI decisions** (evaluation trace), **Real-time WebSocket** decision stream, **Risk heatmap**, **Interactive SDK docs**, **Runtime Architecture** page.
- Verified: **58/58 pytest cases** (23 V1 + 35 V2).

### V4 — Real infrastructure (Jan 14, 2026)
- **Real `memorygate` Python SDK** — installable via `pip install -e ./sdks/python`. Sync `Client` + async `AsyncClient`, typed `Decision` model with `.allowed`, `.effective_payload`, `.trace`, `.to_exception()`. Includes `.guard()` helper that raises on non-allow decisions.
  - Framework middleware in `memorygate.middleware.*`:
    - **`langgraph.governed_node`** — wraps any LangGraph node so its state passes through MemoryGate first; blocks/escalates halt the graph.
    - **`openai_agents.governed`** — walks an Agents-SDK `Agent`, wraps every tool's callable in place.
    - **`crewai.GovernedCrew`** — drop-in `Crew` subclass that wraps every tool's `.run()` / `._run()`.
    - **`google_adk.governed`** — wraps callables on Google ADK `LlmAgent.tools` / `.tool_registry`.
    - **`mcp.MCPProxy`** — JSON-RPC proxy that governs every MCP `tools/call` before forwarding to the real MCP server. Also exposed as a CLI: `memorygate mcp-proxy --upstream ... --api-key ...`.
  - Verified: **5/5 SDK unit tests** + a live end-to-end run through the local backend returning correct `modify` (with 5-step trace) and `block` decisions; `.guard()` correctly raised `PermissionDenied`.
- **TypeScript SDK skeleton** (`@memorygate/sdk`) — `Decision` class, `MemoryGate` client, typed exceptions, ESM+CJS build config.
- **Public no-signup playground** — new `/playground` route (outside auth wrapper) with:
  - Hero + live decisions stream (public tenant, polled every 5 s).
  - 4 canned scenarios (PII redact / prod delete / high-risk billing / public docs) with expected badges + one "compose your own" custom mode.
  - Real `POST /api/public/evaluate` — no auth, seeded `public_demo_org` tenant with 4 agents + 4 policies, rate-limited to **15 req/min per IP**, CSRF-exempt.
  - SDK section with Python + TypeScript snippets and install commands for every framework extra.
  - Footer CTA: "Open console" / "Book an enterprise pilot".
- **Latency & throughput benchmark** (`benchmarks/bench.py` + `benchmarks/README.md`):
  - Single-caller: **p50 = 47 ms**, throughput 22 req/s.
  - 16-way concurrency: 159 req/s, p50 98 ms, p99 149 ms.
  - 32-way stress: 133 req/s, p50 242 ms, p99 370 ms.
- **OpenAPI polish**: 13 tags, per-endpoint summaries, description block. Swagger UI at `/api/docs`, ReDoc at `/api/redoc`, spec at `/api/openapi.json`.
- **Rate-limit tuning**: bumped `/api/evaluate` to 6 000 req/min (100 rps) per IP so the SDK can actually be used at production throughput.
- **Rebrand** to *MemoryGate*, grouped sidebar (Security / Policy / Agents & Access / Integrations / Observability / System).
- **API keys**: `POST /api-keys` returns secret once, `rotate`, `revoke`, hashed at rest (sha256), prefix + suffix display. Admin+ role required.
- **Webhooks**: Slack / Teams / PagerDuty / custom endpoints, per-event filters, real `httpx` delivery via `asyncio.create_task`, `POST /webhooks/{id}/test`, delivery counters + last status persisted.
- **Enterprise connectors**: PostgreSQL / MongoDB / SurrealDB / Redis / Pinecone / Qdrant / REST — configurable, testable, scope-bound. `POST /connectors/{id}/test` does a real ping for MongoDB & REST, heuristic for others.
- **Members & RBAC**: 4 roles (owner/admin/editor/viewer), invite / role-change / remove; RBAC enforced on every mutation across agents, policies, escalations, keys, webhooks, connectors, members.
- **Policy versioning & rollback**: every PATCH snapshots the previous version to `policy_versions`; `GET /policies/{id}/versions` returns history; `POST /policies/{id}/rollback/{v}` restores.
- **Compliance center**: SOC 2 Type II, ISO 27001:2022, GDPR, HIPAA — controls mapped from runtime evidence; CSV export via `GET /compliance/export.csv?framework=…`.
- **Explainable AI decisions**: every `/api/evaluate` response now includes `evaluation_trace` — an ordered array of `{step, matched, detail}` showing identity check, risk score, per-policy attempts (with the exact reason each didn't match), and the final effect. Surfaced in the Runtime drawer.
- **Real-time WebSocket stream**: `wss://.../api/ws/decisions?token=<jwt>` — JWT-authenticated per-tenant fan-out, connected from the Runtime page (falls back to polling on failure).
- **Risk heatmap**: `GET /analytics/heatmap` returns a resource × action matrix with volume + average-risk cells; rendered as a colored grid on the Analytics page.
- **Interactive SDK docs**: 6 tabs (Python / TypeScript / LangGraph / OpenAI Agents SDK / CrewAI / MCP) with copy-paste snippets + a live `/api/evaluate` playground.
- **Runtime Architecture page**: 3-column visual (agents → MemoryGate → enterprise systems), decision-engine steps, deployment models (managed / VPC / air-gapped), zero-trust principles.

### Verified
- **Backend**: 58/58 pytest cases pass (23 V1 regression + 35 V2). RBAC verified across all mutation endpoints; a viewer POSTing `/api/policies` now correctly gets 403.
- **Frontend**: all 15 sidebar routes render, SDKs playground returns real decisions, Compliance framework switching + CSV export work, Runtime shows real WebSocket "ws live" badge + evaluation trace drawer, Analytics heatmap renders with live data.

## Roadmap
- ✅ **V1**: Runtime governance platform (23/23 tests, hardened)
- ✅ **V2**: SDKs + integrations (dashboard side)
- ✅ **V3**: Visual policy builder + compliance
- ✅ **V4**: Real `pip install memorygate` SDK with 5 middleware modules + public no-signup playground + benchmarks + OpenAPI docs
- 🚀 **V5**: **Pilot with 3 enterprise teams.** Stop building UI. Talk to security engineers, CTOs, and AI platform leads. Turn feedback into a pricing sheet and an actual SLA.

## Prioritized backlog (deferred, non-blocking)
- Split `server.py` into `routers/*.py` (auth, agents, policies, evaluate, analytics, api_keys, webhooks, connectors, members, versions, compliance, heatmap, ws) — it's ~1600 lines now.
- Move WebSocket auth off query-string JWT (leaks into access logs) → `Sec-WebSocket-Protocol` sub-protocol.
- Bounded task queue for `_deliver_webhooks` / `_ws_broadcast` to protect against `/simulate` bursts.
- Invitation-token flow for `POST /members` instead of plain-text password.
- Bump `/api/auth/*` rate limit or add an internal-IP allowlist for CI runs.
- CSV escaping hardening in `compliance/export.csv` (quotes-in-name double-escaping).

## Credentials
See `/app/memory/test_credentials.md`.
