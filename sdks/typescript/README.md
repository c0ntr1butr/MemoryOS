# @memorygate/sdk — MemoryGate for Node & TypeScript

```bash
npm i @memorygate/sdk
```

```ts
import { MemoryGate } from "@memorygate/sdk";

const mg = new MemoryGate({ apiKey: process.env.MG_KEY! });

const d = await mg.evaluate({
  agentId: "agent_crm_copilot",
  resource: "customers.read",
  action:   "read",
  purpose:  "Answer support ticket #4212",
  payload:  { customerId: 42 },
});

if (d.allowed) console.log(d.effectivePayload);
else throw d.toException();
```

## Types

- `Decision` — `.allowed`, `.effect`, `.effectivePayload`, `.trace`, `.toException()`
- `PermissionDenied`, `HumanApprovalRequired`, `GovernanceError`, `NetworkError`

## Middleware

Framework middleware for LangChain.js, Vercel AI SDK and OpenAI Agents (JS)
ships in `@memorygate/sdk-middleware` (coming soon).
