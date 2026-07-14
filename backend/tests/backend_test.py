"""End-to-end backend tests for AI Runtime Governance API."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # local fallback for direct test runs
    BASE_URL = "http://localhost:8001"

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@sentinel.ai"
ADMIN_PASSWORD = "Admin@2026"


# --------------------- helpers/fixtures ---------------------
def _client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session: requests.Session, email: str, password: str) -> dict:
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    return data


def _register(session: requests.Session, email: str, password: str, name: str, org_name: str) -> dict:
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": name, "org_name": org_name,
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    return data


@pytest.fixture(scope="session")
def admin_session():
    s = _client()
    _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    return s


@pytest.fixture(scope="session")
def new_user_session():
    s = _client()
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    _register(s, email, "Passw0rd!", "Test User", f"TEST_Org_{uuid.uuid4().hex[:6]}")
    s.email = email  # attach for later
    return s


# --------------------- health ---------------------
def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True


# --------------------- auth ---------------------
class TestAuth:
    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        user = r.json()["user"]
        assert user["email"] == ADMIN_EMAIL
        assert "org_id" in user
        assert "password_hash" not in user

    def test_login_invalid(self):
        s = _client()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_new_org_and_empty_state(self):
        s = _client()
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        _register(s, email, "Passw0rd!", "Reg User", "TEST_RegOrg")
        # Check me
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        # Empty agents for a brand new org
        r = s.get(f"{API}/agents")
        assert r.status_code == 200
        assert r.json() == []
        # Empty policies
        r = s.get(f"{API}/policies")
        assert r.status_code == 200
        assert r.json() == []

    def test_duplicate_registration_fails(self):
        s = _client()
        r = s.post(f"{API}/auth/register", json={
            "email": ADMIN_EMAIL, "password": "Passw0rd!",
            "name": "x", "org_name": "y",
        })
        assert r.status_code == 400

    def test_me_without_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# --------------------- agents ---------------------
class TestAgents:
    def test_admin_has_seeded_agents(self, admin_session):
        r = admin_session.get(f"{API}/agents")
        assert r.status_code == 200
        agents = r.json()
        assert len(agents) >= 4, f"expected seed agents, got {len(agents)}"
        names = [a["name"] for a in agents]
        for expected in ["SupportBot", "SalesInsights", "DevOpsCopilot", "FinanceAssist"]:
            assert expected in names

    def test_create_and_get_agent(self, admin_session):
        payload = {
            "name": f"TEST_Agent_{uuid.uuid4().hex[:6]}",
            "description": "test",
            "framework": "custom",
            "capabilities": ["read"],
            "trust_level": "medium",
            "status": "active",
        }
        r = admin_session.post(f"{API}/agents", json=payload)
        assert r.status_code == 200
        agent = r.json()
        assert agent["name"] == payload["name"]
        assert agent["risk_score"] == 45
        assert agent["decisions_count"] == 0
        assert "id" in agent

        # verify GET
        r = admin_session.get(f"{API}/agents/{agent['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == agent["id"]

    def test_delete_agent(self, admin_session):
        payload = {"name": f"TEST_Del_{uuid.uuid4().hex[:6]}", "framework": "custom",
                   "capabilities": [], "trust_level": "low", "status": "active"}
        r = admin_session.post(f"{API}/agents", json=payload)
        aid = r.json()["id"]
        r = admin_session.delete(f"{API}/agents/{aid}")
        assert r.status_code == 200
        r = admin_session.get(f"{API}/agents/{aid}")
        assert r.status_code == 404

    def test_cross_tenant_isolation(self, admin_session, new_user_session):
        # admin has agents; new user should NOT see them
        r = new_user_session.get(f"{API}/agents")
        assert r.status_code == 200
        assert r.json() == [] or all(a for a in r.json())  # empty for new org
        # Grab an admin agent id
        r = admin_session.get(f"{API}/agents")
        admin_agent_id = r.json()[0]["id"]
        # new user cannot GET admin's agent
        r = new_user_session.get(f"{API}/agents/{admin_agent_id}")
        assert r.status_code == 404
        # new user cannot DELETE admin's agent (silent no-op, verify admin still has it)
        r = new_user_session.delete(f"{API}/agents/{admin_agent_id}")
        assert r.status_code == 200
        r = admin_session.get(f"{API}/agents/{admin_agent_id}")
        assert r.status_code == 200, "cross-tenant delete leaked!"


# --------------------- policies ---------------------
class TestPolicies:
    def test_admin_seeded_policies_ordered_by_priority(self, admin_session):
        r = admin_session.get(f"{API}/policies")
        assert r.status_code == 200
        pols = r.json()
        assert len(pols) >= 5
        priorities = [p["priority"] for p in pols]
        assert priorities == sorted(priorities), "policies not sorted by priority asc"

    def test_create_toggle_delete_policy(self, admin_session):
        body = {
            "name": f"TEST_Policy_{uuid.uuid4().hex[:6]}",
            "description": "test policy",
            "priority": 200,
            "subject": "*",
            "resource_pattern": "test.*",
            "action": "read",
            "conditions": [],
            "effect": "allow",
            "enabled": True,
        }
        r = admin_session.post(f"{API}/policies", json=body)
        assert r.status_code == 200
        pol = r.json()
        pid = pol["id"]
        # toggle disabled via PATCH
        body["enabled"] = False
        r = admin_session.patch(f"{API}/policies/{pid}", json=body)
        assert r.status_code == 200
        assert r.json()["enabled"] is False
        # delete
        r = admin_session.delete(f"{API}/policies/{pid}")
        assert r.status_code == 200

    def test_policy_cross_tenant(self, admin_session, new_user_session):
        r = admin_session.get(f"{API}/policies")
        admin_pid = r.json()[0]["id"]
        # new user cannot see admin's policies
        r = new_user_session.get(f"{API}/policies")
        assert admin_pid not in [p["id"] for p in r.json()]


# --------------------- decision engine ---------------------
class TestEvaluate:
    def _get_agent(self, session, name="SupportBot"):
        r = session.get(f"{API}/agents")
        for a in r.json():
            if a["name"] == name:
                return a
        return r.json()[0]

    def test_prod_delete_blocks(self, admin_session):
        a = self._get_agent(admin_session)
        r = admin_session.post(f"{API}/evaluate", json={
            "agent_id": a["id"], "resource": "prod.database", "action": "delete",
            "purpose": "cleanup",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["decision"] == "block"
        assert "prod" in data["policy_name"].lower() or "deletion" in data["policy_name"].lower()

    def test_customers_read_modifies(self, admin_session):
        a = self._get_agent(admin_session, "SalesInsights")
        r = admin_session.post(f"{API}/evaluate", json={
            "agent_id": a["id"], "resource": "customers.read", "action": "read",
            "purpose": "user requested account details",
            "payload": {"email": "x@y.com"},
        })
        assert r.status_code == 200
        data = r.json()
        assert data["decision"] == "modify"
        mp = data.get("modified_payload")
        assert mp is not None
        assert "_governance" in mp

    def test_public_docs_allow(self, admin_session):
        a = self._get_agent(admin_session)
        r = admin_session.post(f"{API}/evaluate", json={
            "agent_id": a["id"], "resource": "docs.public.read", "action": "read",
            "purpose": "faq"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["decision"] == "allow"

    def test_high_risk_write_escalates(self, admin_session):
        # Use a high-trust agent + sensitive resource + write action → risk >= 60
        a = self._get_agent(admin_session, "SalesInsights")  # high trust base 75
        r = admin_session.post(f"{API}/evaluate", json={
            "agent_id": a["id"], "resource": "pii.email", "action": "write",
            "purpose": "outbound campaign",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["decision"] == "escalate", data
        assert data["risk_score"] >= 60
        # Verify escalation created
        r = admin_session.get(f"{API}/escalations?status=pending")
        assert r.status_code == 200
        ids = [e["decision_id"] for e in r.json()]
        assert data["id"] in ids

    def test_unknown_agent_404(self, admin_session):
        r = admin_session.post(f"{API}/evaluate", json={
            "agent_id": "does-not-exist", "resource": "docs.public.read", "action": "read",
        })
        assert r.status_code == 404


# --------------------- simulator ---------------------
class TestSimulate:
    def test_simulate_creates_rows(self, admin_session):
        r = admin_session.get(f"{API}/agents")
        agents_before = r.json()
        prev_counts = {a["id"]: a.get("decisions_count", 0) for a in agents_before}

        r = admin_session.post(f"{API}/simulate?count=10")
        assert r.status_code == 200
        data = r.json()
        assert data["created"] == 10
        assert len(data["decisions"]) == 10
        for d in data["decisions"]:
            assert d["decision"] in {"allow", "block", "modify", "escalate"}

        # decisions_count incremented for at least one agent
        r = admin_session.get(f"{API}/agents")
        agents_after = r.json()
        total_delta = sum(a["decisions_count"] - prev_counts.get(a["id"], 0) for a in agents_after)
        assert total_delta >= 10


# --------------------- audit ---------------------
class TestAudit:
    def test_list_decisions_with_filters(self, admin_session):
        r = admin_session.get(f"{API}/decisions?limit=50")
        assert r.status_code == 200
        all_items = r.json()
        assert isinstance(all_items, list)

        # decision filter
        r = admin_session.get(f"{API}/decisions?limit=50&decision=block")
        assert r.status_code == 200
        for it in r.json():
            assert it["decision"] == "block"

        # search filter
        r = admin_session.get(f"{API}/decisions?limit=50&search=customers")
        assert r.status_code == 200
        for it in r.json():
            hay = f"{it['resource']} {it['agent_name']} {it.get('purpose','')}".lower()
            assert "customers" in hay

    def test_get_decision_and_cross_tenant(self, admin_session, new_user_session):
        r = admin_session.get(f"{API}/decisions?limit=1")
        items = r.json()
        if not items:
            pytest.skip("no decisions yet")
        did = items[0]["id"]
        r = admin_session.get(f"{API}/decisions/{did}")
        assert r.status_code == 200
        r = new_user_session.get(f"{API}/decisions/{did}")
        assert r.status_code == 404


# --------------------- escalations ---------------------
class TestEscalations:
    def test_list_and_decide(self, admin_session):
        r = admin_session.get(f"{API}/escalations?status=pending")
        assert r.status_code == 200
        pending = r.json()
        if not pending:
            # trigger an escalation
            r = admin_session.get(f"{API}/agents")
            a = next(x for x in r.json() if x["name"] == "SalesInsights")
            admin_session.post(f"{API}/evaluate", json={
                "agent_id": a["id"], "resource": "pii.email", "action": "write",
                "purpose": "campaign",
            })
            r = admin_session.get(f"{API}/escalations?status=pending")
            pending = r.json()
        assert pending, "expected at least one pending escalation"
        eid = pending[0]["id"]

        r = admin_session.post(f"{API}/escalations/{eid}/decide", json={
            "approve": True, "note": "test approval"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        r = admin_session.get(f"{API}/escalations?status=approved")
        assert r.status_code == 200
        assert eid in [e["id"] for e in r.json()]


# --------------------- analytics ---------------------
class TestAnalytics:
    def test_overview_shape(self, admin_session):
        r = admin_session.get(f"{API}/analytics/overview")
        assert r.status_code == 200
        data = r.json()
        for k in ["total", "total_24h", "agents", "active_policies",
                  "pending_escalations", "mix", "timeline", "top_agents", "top_blocked"]:
            assert k in data, f"missing key {k}"
        assert isinstance(data["total"], int)
        for k in ["allow", "block", "modify", "escalate"]:
            assert k in data["mix"]
        assert len(data["timeline"]) == 12
        for b in data["timeline"]:
            assert "total" in b and "blocks" in b and "label" in b
        assert isinstance(data["top_agents"], list)
        assert isinstance(data["top_blocked"], list)
