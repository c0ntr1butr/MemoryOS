"""CrewAI integration.

Wrap a Crew so that every tool execution across every agent in the crew is
governed by MemoryGate first.

Example::

    from crewai import Agent, Task, Crew
    from memorygate import Client
    from memorygate.middleware.crewai import GovernedCrew

    mg = Client(api_key="mg_...")

    analyst = Agent(role="analyst", goal="Summarize customers", tools=[crm_tool])
    task    = Task(description="Summarize account 42", agent=analyst)

    crew = GovernedCrew(agents=[analyst], tasks=[task], mg=mg,
                        agent_id_for=lambda a: f"agent_{a.role}")
    crew.kickoff()
"""
from __future__ import annotations

import functools
from typing import Any, Callable, Optional

from ..client import Client
from ..exceptions import PermissionDenied, HumanApprovalRequired

try:  # optional import — only needed when the user actually uses CrewAI
    from crewai import Crew  # type: ignore
except Exception:  # pragma: no cover
    Crew = object  # type: ignore


def _wrap_tool_run(tool: Any, *, mg: Client, agent_id: str) -> Any:
    """Wrap a CrewAI BaseTool so its `.run()` / `._run()` goes through MG."""
    if getattr(tool, "_memorygate_wrapped", False):
        return tool
    original = getattr(tool, "_run", None) or getattr(tool, "run", None)
    if not callable(original):
        return tool
    tool_name = getattr(tool, "name", type(tool).__name__)

    @functools.wraps(original)
    def _governed(*args, **kwargs):
        payload = kwargs or ({"args": list(args)} if args else {})
        d = mg.evaluate(
            agent_id=agent_id,
            resource=f"tool.{tool_name}",
            action="execute",
            purpose=str(payload.get("purpose") or ""),
            payload=payload,
        )
        if d.decision == "allow":
            return original(*args, **kwargs)
        if d.decision == "modify":
            new = d.modified_payload or {}
            return original(**{k: v for k, v in new.items() if k != "_governance"})
        if d.decision == "escalate":
            raise HumanApprovalRequired(d.id, d.reason)
        raise PermissionDenied(d.reason, decision_id=d.id, policy_name=d.policy_name)

    # Overwrite the underlying method — CrewAI calls `.run()` which routes to `_run`.
    if getattr(tool, "_run", None):
        tool._run = _governed
    else:
        tool.run = _governed
    tool._memorygate_wrapped = True
    return tool


class GovernedCrew(Crew):  # type: ignore[misc]
    """Drop-in ``Crew`` that wires every tool through MemoryGate.

    Constructor gains two extra kwargs:
      - ``mg`` — a MemoryGate ``Client``.
      - ``agent_id_for`` — callable mapping a CrewAI ``Agent`` to a MemoryGate agent id.
        Defaults to a hash of the agent's role.
    """

    def __init__(self, *args, mg: Client, agent_id_for: Optional[Callable[[Any], str]] = None, **kwargs):
        super().__init__(*args, **kwargs)  # type: ignore[misc]
        agent_id_for = agent_id_for or (lambda a: f"agent_{getattr(a, 'role', 'default')}")
        for a in getattr(self, "agents", []) or []:
            aid = agent_id_for(a)
            for tool in getattr(a, "tools", []) or []:
                _wrap_tool_run(tool, mg=mg, agent_id=aid)


__all__ = ["GovernedCrew"]
