# memorygate — runtime governance for autonomous AI agents

Framework-agnostic middleware that evaluates every agent action against
identity, policy, context, and risk **before** it reaches your enterprise
systems.

    pip install memorygate

## Quickstart

```python
from memorygate import Client

mg = Client(api_key="mg_...")   # from the MemoryGate console

decision = mg.evaluate(
    agent_id="agent_crm_copilot",
    resource="customers.read",
    action="read",
    purpose="Answer support ticket #4212",
    payload={"customer_id": 42},
)

if decision.allowed:
    result = crm.read(decision.effective_payload)
else:
    raise decision.to_exception()      # PermissionDenied or HumanApprovalRequired
```

Or use `.guard()` which raises on non-allow decisions:

```python
payload = mg.guard(
    resource="prod.deploy", action="execute",
    purpose="Release v1.2.3", payload={"version": "1.2.3"},
).effective_payload
run_deploy(payload)
```

## Framework middleware

Install with the extra you need:

```bash
pip install memorygate[langgraph]     # LangGraph
pip install memorygate[openai]        # OpenAI Agents SDK
pip install memorygate[crewai]        # CrewAI
pip install memorygate[google]        # Google ADK
pip install memorygate[mcp]           # MCP proxy
```

### LangGraph
```python
from memorygate.middleware.langgraph import governed_node
graph.add_node("crm", governed_node(call_crm, mg=mg,
    agent_id="agent_crm_copilot",
    resource_from=lambda s: f"crm.{s['action']}",
    payload_from=lambda s: s["query"]))
```

### OpenAI Agents SDK
```python
from memorygate.middleware.openai_agents import governed
guarded = governed(agent, mg=mg, agent_id="agent_crm_copilot")
```

### CrewAI
```python
from memorygate.middleware.crewai import GovernedCrew
crew = GovernedCrew(agents=[analyst], tasks=[task], mg=mg,
                    agent_id_for=lambda a: f"agent_{a.role}")
```

### Google ADK
```python
from memorygate.middleware.google_adk import governed
guarded = governed(agent, mg=mg, agent_id="agent_gemini_crm")
```

### MCP proxy
```bash
memorygate mcp-proxy \
    --upstream https://mcp.internal.example.com \
    --api-key mg_... \
    --agent-id agent_mcp_gateway \
    --listen 0.0.0.0:7443
```

Point any MCP client at `http://localhost:7443/mcp` and every `tools/call`
is evaluated by MemoryGate before it reaches the real server.

## Environment variables

- `MEMORYGATE_API_KEY` — used if `api_key=` is not passed to `Client()`.
- `MEMORYGATE_URL`     — defaults to `https://api.memorygate.dev`.

## License

Apache-2.0.
