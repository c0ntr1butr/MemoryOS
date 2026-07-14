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
- Auth: register (auto-creates org), login, logout, `/auth/me` (cookie + Bearer fallback).
- Agent registry: CRUD, trust levels, capabilities, per-agent decision counter.
- Policy builder: priority-ordered rules with subject/resource/action/conditions/effect + modify instructions; enable/disable toggle.
- Runtime decision engine: `/api/evaluate` — allow / block / modify / escalate; writes decision + escalation records with client IP + user-agent.
- Audit logs page: searchable, filterable table.
- Analytics: 12-h timeline, decision mix, top agents, top blocked resources.
- Escalations queue: pending / approved / rejected with human approve/reject actions.
- Traffic simulator: injects N random requests through the engine.
- Sample seed data (only for the seeded admin org): 4 sample agents, 5 sample policies.
- Settings page with copy-able Org ID and sample `/api/evaluate` payload.
- Full data-testid coverage; tested by testing agent: 23/23 backend, 7/7 UI flows.
- **Production security hardening** (Jan 14, 2026):
  - Env-driven CORS allowlist (`ALLOWED_ORIGINS` + wildcard suffixes); permissive regex only when `ENVIRONMENT=development`.
  - `httpOnly`, `secure`, `samesite=None` auth cookies.
  - Origin-based CSRF guard on every mutating `/api/*` request (Bearer requests exempt).
  - In-process sliding-window rate limiter: auth 20/min, evaluate 300/min, simulate 10/min, default 240/min. Returns 429 + `Retry-After`.
  - Security response headers: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (non-dev).
  - Tighter pydantic input validation: length caps + name/pattern regex on all mutating endpoints.
  - Structured JSON audit log stream (dedicated `audit` logger) — one line per `auth.login`, `auth.register`, `auth.logout`, `decision`, `csrf.blocked`, `ratelimit.blocked` event.

## Prioritized backlog
- **P1** — SDK snippets (Python / TS) on the Settings page + per-tenant API keys.
- **P1** — Policy simulator / dry-run mode (upload a batch, see what would happen).
- **P2** — LLM-assisted reasoning for ambiguous escalations (Emergent Universal Key).
- **P2** — CSV export of audit logs; scheduled reports.
- **P2** — Webhook / Slack notifications for escalations.
- **P3** — RBAC (owner / admin / viewer) and invite flow.
- **P3** — Split `server.py` into `routers/` modules.

## Credentials
See `/app/memory/test_credentials.md`.
