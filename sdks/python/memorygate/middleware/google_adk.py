"""Google Agent Development Kit (ADK) integration.

Google ADK models each tool as a callable exposed to a `LlmAgent`. This
middleware wraps every callable so MemoryGate evaluates the call before it
reaches the tool.

Example::

    from google.adk.agents import LlmAgent
    from memorygate import Client
    from memorygate.middleware.google_adk import governed

    mg = Client(api_key="mg_...")

    agent = LlmAgent(model="gemini-2.5-pro", instruction="...",
                     tools=[read_customer, send_email])
    guarded = governed(agent, mg=mg, agent_id="agent_gemini_crm")
"""
from __future__ import annotations

import functools
from typing import Any, Callable

from ..client import Client
from ..exceptions import PermissionDenied, HumanApprovalRequired


def _wrap_callable(fn: Callable[..., Any], *, mg: Client, agent_id: str, name: str) -> Callable[..., Any]:
    @functools.wraps(fn)
    def wrapped(*args, **kwargs):
        payload = kwargs or ({"args": list(args)} if args else {})
        d = mg.evaluate(
            agent_id=agent_id,
            resource=f"tool.{name}",
            action="execute",
            purpose=str(payload.get("purpose") or ""),
            payload=payload,
        )
        if d.decision == "allow":
            return fn(*args, **kwargs)
        if d.decision == "modify":
            new = d.modified_payload or {}
            return fn(**{k: v for k, v in new.items() if k != "_governance"})
        if d.decision == "escalate":
            raise HumanApprovalRequired(d.id, d.reason)
        raise PermissionDenied(d.reason, decision_id=d.id, policy_name=d.policy_name)
    wrapped.__memorygate__ = True  # type: ignore[attr-defined]
    return wrapped


def governed(agent: Any, *, mg: Client, agent_id: str) -> Any:
    """Wrap every tool attached to a Google ADK agent through MemoryGate.

    ADK stores tools either on ``.tools`` (list of callables) or on
    ``.tool_registry`` — we handle both. The agent is mutated in place and
    returned for chaining.
    """
    tools = getattr(agent, "tools", None)
    if isinstance(tools, list):
        for i, t in enumerate(tools):
            if callable(t) and not getattr(t, "__memorygate__", False):
                tools[i] = _wrap_callable(t, mg=mg, agent_id=agent_id,
                                          name=getattr(t, "__name__", f"tool_{i}"))
    registry = getattr(agent, "tool_registry", None)
    if registry is not None and hasattr(registry, "items"):
        for name, t in list(registry.items()):
            if callable(t) and not getattr(t, "__memorygate__", False):
                registry[name] = _wrap_callable(t, mg=mg, agent_id=agent_id, name=name)
    return agent


__all__ = ["governed"]
