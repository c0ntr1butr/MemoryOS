"""Unit tests for the memorygate Python SDK.

Uses respx to mock httpx traffic so the tests are hermetic.
Run:   pytest -q sdks/python/tests
"""
import pytest
from unittest.mock import patch, MagicMock

from memorygate import Client, Decision, PermissionDenied, HumanApprovalRequired
from memorygate.exceptions import GovernanceError


def _mock_response(payload, status=200):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = payload
    m.text = str(payload)
    return m


DECISION_ALLOW = {
    "id": "d_1", "decision": "allow", "agent_id": "a_1", "agent_name": "SDR",
    "resource": "customers.read", "action": "read", "risk_score": 20,
    "policy_id": None, "policy_name": "default", "reason": "ok",
    "payload": {"customer_id": 1}, "modified_payload": None,
    "evaluation_trace": [{"step": "identity", "matched": True, "detail": "ok"}],
}

DECISION_BLOCK = {**DECISION_ALLOW, "id": "d_2", "decision": "block",
                  "policy_name": "Deny prod.delete", "reason": "prod delete blocked"}

DECISION_ESCALATE = {**DECISION_ALLOW, "id": "d_3", "decision": "escalate",
                     "reason": "risk 82 ≥ 70"}


def test_client_requires_api_key(monkeypatch):
    monkeypatch.delenv("MEMORYGATE_API_KEY", raising=False)
    with pytest.raises(GovernanceError):
        Client()


def test_evaluate_allow_returns_decision():
    with patch("httpx.Client.post", return_value=_mock_response(DECISION_ALLOW)):
        mg = Client(api_key="mg_test", default_agent_id="a_1")
        d = mg.evaluate(resource="customers.read", action="read")
    assert isinstance(d, Decision)
    assert d.allowed is True
    assert d.effect == "allow"
    assert d.effective_payload == {"customer_id": 1}
    assert d.trace and d.trace[0].step == "identity"


def test_evaluate_block_effective_payload_none():
    with patch("httpx.Client.post", return_value=_mock_response(DECISION_BLOCK)):
        mg = Client(api_key="mg_test", default_agent_id="a_1")
        d = mg.evaluate(resource="prod.deploy", action="delete")
    assert d.allowed is False
    assert d.effective_payload is None
    exc = d.to_exception()
    assert isinstance(exc, PermissionDenied)


def test_guard_raises_on_escalate():
    with patch("httpx.Client.post", return_value=_mock_response(DECISION_ESCALATE)):
        mg = Client(api_key="mg_test", default_agent_id="a_1")
        with pytest.raises(HumanApprovalRequired):
            mg.guard(resource="billing.write", action="write")


def test_missing_agent_id_raises():
    mg = Client(api_key="mg_test")
    with pytest.raises(GovernanceError):
        mg.evaluate(resource="x", action="read")
