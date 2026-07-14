"""Typed models returned by the MemoryGate client."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

Effect = Literal["allow", "block", "modify", "escalate"]


@dataclass
class TraceStep:
    """One step of the decision engine's reasoning trace."""
    step: str
    matched: bool
    detail: str

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TraceStep":
        return cls(step=d.get("step", ""), matched=bool(d.get("matched")), detail=d.get("detail", ""))


@dataclass
class Decision:
    """The decision returned by MemoryGate for one agent action.

    - `effect` is one of "allow" / "block" / "modify" / "escalate".
    - `effective_payload` is the payload the caller should actually use:
      the original for allow, the redacted one for modify, None for block/escalate.
    - `trace` is the ordered explainability trace (empty on legacy servers).
    """
    id: str
    decision: Effect
    agent_id: str
    agent_name: str
    resource: str
    action: str
    risk_score: int
    policy_id: Optional[str]
    policy_name: str
    reason: str
    payload: Dict[str, Any] = field(default_factory=dict)
    modified_payload: Optional[Dict[str, Any]] = None
    trace: List[TraceStep] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)

    # --- convenience -----------------------------------------------------
    @property
    def effect(self) -> Effect:
        return self.decision

    @property
    def allowed(self) -> bool:
        return self.decision in ("allow", "modify")

    @property
    def effective_payload(self) -> Optional[Dict[str, Any]]:
        if self.decision == "allow":
            return self.payload
        if self.decision == "modify":
            return self.modified_payload
        return None

    def to_exception(self) -> Exception:
        from .exceptions import PermissionDenied, HumanApprovalRequired
        if self.decision == "escalate":
            return HumanApprovalRequired(self.id, self.reason)
        return PermissionDenied(self.reason, decision_id=self.id, policy_name=self.policy_name)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Decision":
        return cls(
            id=d["id"],
            decision=d["decision"],
            agent_id=d.get("agent_id", ""),
            agent_name=d.get("agent_name", ""),
            resource=d.get("resource", ""),
            action=d.get("action", ""),
            risk_score=int(d.get("risk_score", 0)),
            policy_id=d.get("policy_id"),
            policy_name=d.get("policy_name", ""),
            reason=d.get("reason", ""),
            payload=d.get("payload") or {},
            modified_payload=d.get("modified_payload"),
            trace=[TraceStep.from_dict(t) for t in (d.get("evaluation_trace") or [])],
            raw=d,
        )
