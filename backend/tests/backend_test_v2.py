"""V2/V3 backend tests: API keys, webhooks, connectors, members/RBAC,
policy versions, compliance, heatmap, explainability, WebSocket."""
import os
import csv
import io
import uuid
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/decisions"

ADMIN_EMAIL = "admin@sentinel.ai"
ADMIN_PASSWORD = "Admin@2026"


def _client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    session.jwt = data["token"]
    return data


def _register(session, email, password, name, org_name):
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": name, "org_name": org_name,
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    session.jwt = data["token"]
    return data


@pytest.fixture(scope="module")
def admin_session():
    s = _client()
    _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    return s


@pytest.fixture(scope="module")
def viewer_session(admin_session):
    """Create a new user in admin's org and demote to viewer."""
    email = f"test_viewer_{uuid.uuid4().hex[:8]}@example.com"
    r = admin_session.post(f"{API}/members", json={
        "email": email, "name": "TEST Viewer",
        "role": "viewer", "password": "Passw0rd!"
    })
    assert r.status_code == 200, r.text
    s = _client()
    _login(s, email, "Passw0rd!")
    s.user_id = r.json()["id"]
    return s


@pytest.fixture(scope="module")
def editor_session(admin_session):
    email = f"test_editor_{uuid.uuid4().hex[:8]}@example.com"
    r = admin_session.post(f"{API}/members", json={
        "email": email, "name": "TEST Editor",
        "role": "editor", "password": "Passw0rd!"
    })
    assert r.status_code == 200, r.text
    s = _client()
    _login(s, email, "Passw0rd!")
    s.user_id = r.json()["id"]
    return s


# ---------------- API keys ----------------
class TestApiKeys:
    def test_create_returns_secret_only_once(self, admin_session):
        r = admin_session.post(f"{API}/api-keys", json={
            "name": f"TEST_key_{uuid.uuid4().hex[:6]}",
            "role": "editor"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "secret" in data
        assert data["secret"].startswith("mg_")
        assert "hash" not in data
        key_id = data["id"]

        # GET must not return secret/hash
        r = admin_session.get(f"{API}/api-keys")
        assert r.status_code == 200
        found = [k for k in r.json() if k["id"] == key_id]
        assert found, "created key missing from list"
        k = found[0]
        assert "secret" not in k
        assert "hash" not in k

    def test_rotate_returns_new_secret(self, admin_session):
        r = admin_session.post(f"{API}/api-keys", json={
            "name": f"TEST_rot_{uuid.uuid4().hex[:6]}", "role": "editor"})
        kid = r.json()["id"]
        orig = r.json()["secret"]
        r = admin_session.post(f"{API}/api-keys/{kid}/rotate")
        assert r.status_code == 200
        assert r.json()["secret"].startswith("mg_")
        assert r.json()["secret"] != orig

    def test_revoke_removes_from_list(self, admin_session):
        r = admin_session.post(f"{API}/api-keys", json={
            "name": f"TEST_rev_{uuid.uuid4().hex[:6]}", "role": "viewer"})
        kid = r.json()["id"]
        r = admin_session.post(f"{API}/api-keys/{kid}/revoke")
        assert r.status_code == 200
        # list only shows non-revoked
        r = admin_session.get(f"{API}/api-keys")
        assert kid not in [k["id"] for k in r.json()]

    def test_editor_cannot_create_key(self, editor_session):
        r = editor_session.post(f"{API}/api-keys", json={
            "name": f"TEST_ed_{uuid.uuid4().hex[:6]}", "role": "editor"})
        assert r.status_code == 403


# ---------------- Webhooks ----------------
class TestWebhooks:
    def test_crud_and_test(self, admin_session):
        # Create
        r = admin_session.post(f"{API}/webhooks", json={
            "name": f"TEST_wh_{uuid.uuid4().hex[:6]}",
            "url": "https://httpbin.org/status/200",
            "kind": "custom", "events": ["block", "escalate"], "enabled": True
        })
        assert r.status_code == 200, r.text
        wh = r.json()
        wid = wh["id"]
        assert wh["delivery_count"] == 0

        # Test endpoint (fails gracefully even if unreachable)
        r = admin_session.post(f"{API}/webhooks/{wid}/test")
        assert r.status_code == 200
        body = r.json()
        assert "ok" in body and "status" in body

        # Toggle enabled via PATCH
        r = admin_session.patch(f"{API}/webhooks/{wid}", json={
            "name": wh["name"], "url": wh["url"], "kind": "custom",
            "events": ["block"], "enabled": False,
        })
        assert r.status_code == 200
        assert r.json()["enabled"] is False

        # DELETE
        r = admin_session.delete(f"{API}/webhooks/{wid}")
        assert r.status_code == 200
        # 404 for non-existent
        r = admin_session.delete(f"{API}/webhooks/nonexistent-id")
        assert r.status_code == 404

    def test_unreachable_test_returns_gracefully(self, admin_session):
        r = admin_session.post(f"{API}/webhooks", json={
            "name": f"TEST_bad_{uuid.uuid4().hex[:6]}",
            "url": "http://127.0.0.1:1/never",
            "kind": "custom", "events": ["block"], "enabled": True,
        })
        wid = r.json()["id"]
        r = admin_session.post(f"{API}/webhooks/{wid}/test")
        assert r.status_code == 200
        assert r.json()["ok"] is False


# ---------------- Connectors ----------------
class TestConnectors:
    @pytest.mark.parametrize("kind", ["postgres", "mongodb", "surrealdb", "redis", "pinecone", "qdrant", "rest"])
    def test_create_all_kinds(self, admin_session, kind):
        r = admin_session.post(f"{API}/connectors", json={
            "name": f"TEST_c_{kind}_{uuid.uuid4().hex[:4]}",
            "kind": kind,
            "config": {"host": "localhost", "port": 5432, "url": "https://example.com"},
            "scope": ""
        })
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["kind"] == kind
        assert c["status"] == "unknown"
        assert c["config"]["host"] == "localhost"

    def test_test_endpoint_updates_status(self, admin_session):
        r = admin_session.post(f"{API}/connectors", json={
            "name": f"TEST_ctest_{uuid.uuid4().hex[:6]}",
            "kind": "rest",
            "config": {"url": "https://httpbin.org/status/200"},
        })
        cid = r.json()["id"]
        r = admin_session.post(f"{API}/connectors/{cid}/test")
        assert r.status_code == 200
        body = r.json()
        assert "ok" in body and "detail" in body
        # verify status updated
        r = admin_session.get(f"{API}/connectors")
        c = next(x for x in r.json() if x["id"] == cid)
        assert c["status"] in ("healthy", "degraded")


# ---------------- Members / RBAC ----------------
class TestMembers:
    def test_email_uniqueness(self, admin_session):
        email = f"test_dup_{uuid.uuid4().hex[:6]}@example.com"
        r = admin_session.post(f"{API}/members", json={
            "email": email, "name": "TEST Dup", "role": "viewer", "password": "Passw0rd!"})
        assert r.status_code == 200
        r = admin_session.post(f"{API}/members", json={
            "email": email, "name": "TEST Dup 2", "role": "viewer", "password": "Passw0rd!"})
        assert r.status_code == 400

    def test_viewer_cannot_create_policy(self, viewer_session):
        r = viewer_session.post(f"{API}/policies", json={
            "name": f"TEST_vp_{uuid.uuid4().hex[:4]}", "priority": 999,
            "subject": "*", "resource_pattern": "*", "action": "read",
            "conditions": [], "effect": "allow", "enabled": True,
        })
        # policies endpoint doesn't enforce role, but let's verify actual behavior
        # Per spec, viewer cannot POST /api/policies — expect 403
        # Note: current server allows viewer to create policies since no role guard on /policies
        # We'll assert 403 as spec but log if 200
        if r.status_code != 403:
            pytest.fail(f"viewer should not be able to create policies, got {r.status_code}")

    def test_editor_can_create_policy(self, editor_session):
        r = editor_session.post(f"{API}/policies", json={
            "name": f"TEST_ep_{uuid.uuid4().hex[:4]}", "priority": 999,
            "subject": "*", "resource_pattern": "*", "action": "read",
            "conditions": [], "effect": "allow", "enabled": True,
        })
        assert r.status_code == 200, r.text
        # cleanup
        editor_session.delete(f"{API}/policies/{r.json()['id']}")

    def test_cannot_demote_owner(self, admin_session):
        r = admin_session.get(f"{API}/members")
        owner = next(m for m in r.json() if m["role"] == "owner")
        r = admin_session.patch(f"{API}/members/{owner['id']}", json={"role": "viewer"})
        assert r.status_code == 400

    def test_can_demote_editor_to_viewer(self, admin_session, editor_session):
        r = admin_session.patch(f"{API}/members/{editor_session.user_id}", json={"role": "viewer"})
        assert r.status_code == 200
        # restore
        admin_session.patch(f"{API}/members/{editor_session.user_id}", json={"role": "editor"})

    def test_cannot_remove_owner(self, admin_session):
        r = admin_session.get(f"{API}/members")
        owner = next(m for m in r.json() if m["role"] == "owner")
        r = admin_session.delete(f"{API}/members/{owner['id']}")
        assert r.status_code == 400

    def test_cannot_remove_self(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        me = r.json()["user"]
        r = admin_session.delete(f"{API}/members/{me['id']}")
        # admin is also owner; expect 400 (owner check runs first)
        assert r.status_code == 400


# ---------------- Policy versioning ----------------
class TestPolicyVersioning:
    def test_patch_snapshots_and_rollback(self, admin_session):
        # Create policy
        base = {
            "name": f"TEST_ver_{uuid.uuid4().hex[:6]}",
            "priority": 500, "subject": "*", "resource_pattern": "ver.*",
            "action": "read", "conditions": [], "effect": "allow", "enabled": True,
            "description": "v1"
        }
        r = admin_session.post(f"{API}/policies", json=base)
        assert r.status_code == 200
        pid = r.json()["id"]

        # Patch (v1 → v2)
        base["description"] = "v2"
        base["effect"] = "block"
        r = admin_session.patch(f"{API}/policies/{pid}", json=base)
        assert r.status_code == 200
        assert r.json()["version"] == 2

        # Patch again (v2 → v3)
        base["description"] = "v3"
        r = admin_session.patch(f"{API}/policies/{pid}", json=base)
        assert r.json()["version"] == 3

        # List versions
        r = admin_session.get(f"{API}/policies/{pid}/versions")
        assert r.status_code == 200
        versions = r.json()
        assert len(versions) >= 2
        # ordered by version desc
        vs = [v["version"] for v in versions]
        assert vs == sorted(vs, reverse=True)

        # Rollback to v1
        r = admin_session.post(f"{API}/policies/{pid}/rollback/1")
        assert r.status_code == 200, r.text

        # After rollback, version should increment beyond current
        r = admin_session.get(f"{API}/policies")
        p = next(x for x in r.json() if x["id"] == pid)
        assert p["version"] >= 4
        assert p["description"] == "v1"  # restored


# ---------------- Compliance ----------------
class TestCompliance:
    @pytest.mark.parametrize("fw", ["soc2", "iso27001", "gdpr", "hipaa"])
    def test_report_all_frameworks(self, admin_session, fw):
        r = admin_session.get(f"{API}/compliance/report?framework={fw}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["framework"] == fw
        assert "framework_name" in data
        assert "coverage" in data
        assert "stats" in data
        assert "controls" in data
        assert isinstance(data["controls"], list)
        assert len(data["controls"]) >= 3

    @pytest.mark.parametrize("fw", ["soc2", "iso27001", "gdpr", "hipaa"])
    def test_csv_export(self, admin_session, fw):
        r = admin_session.get(f"{API}/compliance/export.csv?framework={fw}")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        content = r.text
        rows = list(csv.reader(io.StringIO(content)))
        assert rows[0] == ["framework", "code", "control", "status", "generated_at", "org_id"]
        assert len(rows) >= 2

    def test_unknown_framework(self, admin_session):
        r = admin_session.get(f"{API}/compliance/report?framework=xyz")
        assert r.status_code == 400


# ---------------- Heatmap ----------------
class TestHeatmap:
    def test_heatmap_shape(self, admin_session):
        # ensure some decisions exist
        admin_session.post(f"{API}/simulate?count=5")
        r = admin_session.get(f"{API}/analytics/heatmap")
        assert r.status_code == 200
        data = r.json()
        assert "resources" in data and "actions" in data and "cells" in data
        assert data["actions"] == ["read", "write", "execute", "delete"]
        assert len(data["cells"]) == len(data["resources"]) * 4


# ---------------- Explainability ----------------
class TestExplainability:
    def test_evaluate_returns_trace(self, admin_session):
        r = admin_session.get(f"{API}/agents")
        a = r.json()[0]
        r = admin_session.post(f"{API}/evaluate", json={
            "agent_id": a["id"], "resource": "docs.public.read", "action": "read",
            "purpose": "test explain",
        })
        assert r.status_code == 200
        data = r.json()
        trace = data.get("evaluation_trace")
        assert isinstance(trace, list) and len(trace) >= 2
        steps = [t["step"] for t in trace]
        assert "identity" in steps
        assert "risk" in steps
        for t in trace:
            assert "step" in t and "matched" in t and "detail" in t


# ---------------- WebSocket ----------------
class TestWebSocket:
    def test_ws_hello_and_decision_stream(self, admin_session):
        async def run():
            token = admin_session.jwt
            # Get first agent to trigger a decision
            r = admin_session.get(f"{API}/agents")
            a = r.json()[0]

            url = f"{WS_URL}?token={token}"
            async with websockets.connect(url, ping_interval=None) as ws:
                # First message should be hello
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                hello = json.loads(msg)
                assert hello["type"] == "hello"

                # Trigger a decision via HTTP
                def trigger():
                    admin_session.post(f"{API}/evaluate", json={
                        "agent_id": a["id"], "resource": "docs.public.read",
                        "action": "read", "purpose": "ws test"
                    })
                await asyncio.get_event_loop().run_in_executor(None, trigger)

                # Wait for a decision event
                got_decision = False
                for _ in range(5):
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=3)
                        parsed = json.loads(msg)
                        if parsed.get("type") == "decision":
                            got_decision = True
                            assert "data" in parsed
                            assert "decision" in parsed["data"]
                            break
                    except asyncio.TimeoutError:
                        break
                assert got_decision, "did not receive a decision event over WebSocket"

        asyncio.run(run())

    def test_ws_bad_token_closes(self):
        async def run():
            url = f"{WS_URL}?token=badtoken"
            try:
                async with websockets.connect(url, ping_interval=None) as ws:
                    await asyncio.wait_for(ws.recv(), timeout=3)
                    # If connect returns and closed, recv raises
            except Exception:
                return  # expected
            pytest.fail("expected WS to close on bad token")

        asyncio.run(run())
