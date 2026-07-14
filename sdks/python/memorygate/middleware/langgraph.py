"""LangGraph integration.

Wrap any tool node so that every invocation is evaluated by MemoryGate first.
Blocks and escalations short-circuit the graph and set `state["governance"]`.

Example::

    from langgraph.graph import StateGraph
    from memorygate import Client
    from memorygate.middleware.langgraph import governed_node

    mg = Client(api_key="mg_...")

    def call_crm(state):
        return {"result": crm_query(state["query"])}

    graph = StateGraph(dict)
    graph.add_node(
        "crm",
        governed_node(
            call_crm,
            mg=mg,
            agent_id="agent_sales_copilot",
            resource_from=lambda s: f"crm.{s['action']}",
            action_from=lambda s: s["action"],
            purpose_from=lambda s: s.get("reason", ""),
            payload_from=lambda s: s.get("query", {}),
        ),
    )
    graph.compile()
"""
from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from ..client import Client
from ..models import Decision


def governed_node(
    inner: Callable[[Dict[str, Any]], Dict[str, Any]],
    *,
    mg: Client,
    agent_id: str,
    resource_from: Callable[[Dict[str, Any]], str],
    action_from: Callable[[Dict[str, Any]], str] = lambda s: "read",
    purpose_from: Callable[[Dict[str, Any]], str] = lambda s: "",
    payload_from: Callable[[Dict[str, Any]], Dict[str, Any]] = lambda s: {},
    on_block: Optional[Callable[[Dict[str, Any], Decision], Dict[str, Any]]] = None,
    on_escalate: Optional[Callable[[Dict[str, Any], Decision], Dict[str, Any]]] = None,
) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    """Return a LangGraph node function that is governed by MemoryGate.

    The returned callable is a drop-in replacement for `inner`. It:
      1. Calls ``mg.evaluate(...)`` with fields extracted from state.
      2. On ``allow`` — invokes the inner node with the original payload.
      3. On ``modify`` — invokes the inner node with the redacted payload.
      4. On ``block`` — returns ``{"halt": True, "governance": {...}}``.
      5. On ``escalate`` — returns ``{"halt": True, "governance": {...}}`` and
         records the escalation in MemoryGate for a human to approve.

    ``on_block`` / ``on_escalate`` let callers override the halt behaviour.
    """
    def node(state: Dict[str, Any]) -> Dict[str, Any]:
        decision = mg.evaluate(
            agent_id=agent_id,
            resource=resource_from(state),
            action=action_from(state),
            purpose=purpose_from(state),
            payload=payload_from(state),
        )
        if decision.decision in ("allow", "modify"):
            merged = dict(state)
            merged["governance"] = {"decision_id": decision.id,
                                    "policy": decision.policy_name,
                                    "risk_score": decision.risk_score}
            if decision.decision == "modify":
                merged["_gov_payload"] = decision.modified_payload
            out = inner(merged)
            return out or {}
        # blocked or escalated
        payload = {"halt": True,
                   "governance": {
                       "decision": decision.decision,
                       "decision_id": decision.id,
                       "reason": decision.reason,
                       "policy": decision.policy_name,
                       "trace": [t.__dict__ for t in decision.trace],
                   }}
        if decision.decision == "block" and on_block:
            return on_block(state, decision)
        if decision.decision == "escalate" and on_escalate:
            return on_escalate(state, decision)
        return payload
    return node
