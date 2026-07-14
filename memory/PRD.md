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

### V2 / V3 — Enterprise platform (Jan 14, 2026)
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
- ✅ **V1**: Runtime governance platform (done, 23/23 tests, hardened)
- ✅ **V2**: SDKs + integrations (done, Python / TS / LangGraph / OpenAI Agents / CrewAI / MCP examples, connectors, webhooks, WebSocket, API keys)
- ✅ **V3**: Visual policy builder + compliance (done — SOC 2 / ISO 27001 / GDPR / HIPAA, policy versioning + rollback, explainability trace)
- 🚀 **V4**: Real integrations with LangGraph, OpenAI Agents SDK, CrewAI, MCP — ship an actual `pip install memorygate` package with runnable middleware. Publish an MCP proxy binary.
- 🚀 **V5**: Pilot with an enterprise — after V4, **stop building UI**. Talk to security engineers. Real feedback from three enterprise teams > another dashboard page.

## Prioritized backlog (deferred, non-blocking)
- Split `server.py` into `routers/*.py` (auth, agents, policies, evaluate, analytics, api_keys, webhooks, connectors, members, versions, compliance, heatmap, ws) — it's ~1600 lines now.
- Move WebSocket auth off query-string JWT (leaks into access logs) → `Sec-WebSocket-Protocol` sub-protocol.
- Bounded task queue for `_deliver_webhooks` / `_ws_broadcast` to protect against `/simulate` bursts.
- Invitation-token flow for `POST /members` instead of plain-text password.
- Bump `/api/auth/*` rate limit or add an internal-IP allowlist for CI runs.
- CSV escaping hardening in `compliance/export.csv` (quotes-in-name double-escaping).

## Credentials
See `/app/memory/test_credentials.md`.
