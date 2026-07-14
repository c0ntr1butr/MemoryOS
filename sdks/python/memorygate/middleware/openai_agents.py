"""OpenAI Agents SDK integration.

Wraps every tool call routed through an ``Agent`` so it flows through
MemoryGate first. Zero rewrites of tool implementations.

Example::

    from agents import Agent, function_tool, Runner
    from memorygate import Client
    from memorygate.middleware.openai_agents import governed

    mg = Client(api_key="mg_...")

    @function_tool
    def read_customer(customer_id: int) -> dict:
        return crm.fetch(customer_id)

    agent = Agent(name="crm-copilot",
                  instructions="Help sales reps summarize accounts",
                  tools=[read_customer])

    guarded = governed(agent, mg=mg, agent_id="agent_crm_copilot")
    result = Runner.run_sync(guarded, "Summarize account 42 for me")
"""
from __future__ import annotations

import functools
import inspect
from typing import Any, Callable

from ..client import Client
from ..exceptions import PermissionDenied, HumanApprovalRequired


def _wrap_tool(tool: Any, *, mg: Client, agent_id: str) -> Any:
    """Return a copy of ``tool`` whose invocation is governed by MemoryGate."""
    # openai-agents tools expose either ``.callable`` / ``.func`` or ``__call__``.
    # We defensively look up whichever the running version uses.
    for attr in ("callable", "func", "fn"):
        original = getattr(tool, attr, None)
        if callable(original):
            break
    else:
        original = tool if callable(tool) else None
    if original is None:
        return tool

    tool_name = getattr(tool, "name", getattr(original, "__name__", "tool"))

    @functools.wraps(original)
    def _governed(*args, **kwargs):
        payload = kwargs or ({"args": list(args)} if args else {})
        decision = mg.evaluate(
            agent_id=agent_id,
            resource=f"tool.{tool_name}",
            action="execute",
            purpose=str(payload.get("purpose") or ""),
            payload=payload,
        )
        if decision.decision == "allow":
            return original(*args, **kwargs)
        if decision.decision == "modify":
            new = decision.modified_payload or {}
            return original(**{k: v for k, v in new.items() if k != "_governance"})
        if decision.decision == "escalate":
            raise HumanApprovalRequired(decision.id, decision.reason)
        raise PermissionDenied(decision.reason, decision_id=decision.id,
                               policy_name=decision.policy_name)

    for attr in ("callable", "func", "fn"):
        if hasattr(tool, attr) and callable(getattr(tool, attr)):
            setattr(tool, attr, _governed)
            return tool
    return _governed


def governed(agent: Any, *, mg: Client, agent_id: str) -> Any:
    """Wrap every tool on ``agent`` so its execution runs through MemoryGate.

    Returns the same ``agent`` (mutated in place). The wrapper is
    idempotent — safe to call twice.
    """
    tools = getattr(agent, "tools", None) or []
    for i, t in enumerate(tools):
        tools[i] = _wrap_tool(t, mg=mg, agent_id=agent_id)
    return agent


__all__ = ["governed"]
