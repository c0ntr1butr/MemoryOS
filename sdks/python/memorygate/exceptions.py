"""Exceptions raised by the MemoryGate SDK."""
from __future__ import annotations

from typing import Optional


class GovernanceError(Exception):
    """Base class for every SDK-raised error."""


class NetworkError(GovernanceError):
    """Raised when the SDK cannot reach the MemoryGate runtime."""


class UnknownAgent(GovernanceError):
    """Raised when the referenced agent_id does not exist for this tenant."""


class PermissionDenied(GovernanceError):
    """Raised (or convertible from a Decision) when the runtime blocked the request."""

    def __init__(self, reason: str, *, decision_id: Optional[str] = None,
                 policy_name: Optional[str] = None):
        self.reason = reason
        self.decision_id = decision_id
        self.policy_name = policy_name
        super().__init__(f"{reason}" + (f" (policy={policy_name})" if policy_name else ""))


class HumanApprovalRequired(GovernanceError):
    """Raised (or convertible from a Decision) when the request was escalated to a human."""

    def __init__(self, decision_id: str, reason: str = ""):
        self.decision_id = decision_id
        self.reason = reason
        super().__init__(f"Human approval required for decision {decision_id}: {reason}")
