"""MemoryGate — runtime governance for autonomous AI agents.

Quickstart:

    from memorygate import Client

    mg = Client(api_key="mg_...")
    decision = mg.evaluate(
        agent_id="agent_123",
        resource="customers.read",
        action="read",
        purpose="Answer support ticket",
        payload={"customer_id": 42},
    )

    if decision.allowed:
        run_your_tool(decision.effective_payload)
    else:
        raise decision.to_exception()
"""
from .client import Client, AsyncClient
from .models import Decision, TraceStep, Effect
from .exceptions import (
    GovernanceError,
    PermissionDenied,
    HumanApprovalRequired,
    UnknownAgent,
    NetworkError,
)

__all__ = [
    "Client",
    "AsyncClient",
    "Decision",
    "TraceStep",
    "Effect",
    "GovernanceError",
    "PermissionDenied",
    "HumanApprovalRequired",
    "UnknownAgent",
    "NetworkError",
]

__version__ = "0.1.0"
