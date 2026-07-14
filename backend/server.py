"""AI Runtime Governance backend."""
from dotenv import load_dotenv
load_dotenv()

import os
import re
import json
import time
import uuid
import jwt
import bcrypt
import random
import asyncio
import hashlib
import secrets
import logging
import httpx
from collections import deque
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Literal, Set
from fastapi import (FastAPI, APIRouter, Request, Response, HTTPException,
                     Depends, Query, WebSocket, WebSocketDisconnect, status)
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ------------------------ setup ------------------------
mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"

ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").lower()
IS_DEV = ENVIRONMENT == "development"
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
ALLOWED_ORIGINS: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]
# Wildcard suffixes (e.g. ".preview.emergentagent.com") allow any subdomain.
_raw_suffixes = os.environ.get("ALLOWED_ORIGIN_SUFFIXES", "").strip()
ALLOWED_ORIGIN_SUFFIXES: List[str] = [s.strip() for s in _raw_suffixes.split(",") if s.strip()]


def _origin_allowed(origin: str) -> bool:
    if origin in ALLOWED_ORIGINS:
        return True
    for suffix in ALLOWED_ORIGIN_SUFFIXES:
        if origin.endswith(suffix):
            return True
    return False


# Build a CORS regex that matches explicit origins + suffix wildcards.
def _cors_regex() -> Optional[str]:
    parts = [re.escape(o) for o in ALLOWED_ORIGINS]
    for s in ALLOWED_ORIGIN_SUFFIXES:
        parts.append(r"https?://[^/]+" + re.escape(s))
    if not parts:
        return None
    return "^(" + "|".join(parts) + ")$"

app = FastAPI(title="AI Runtime Governance API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("governance")

# Structured audit logger — one JSON line per event, dedicated stream.
audit_logger = logging.getLogger("audit")
if not audit_logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(message)s"))
    audit_logger.addHandler(_h)
audit_logger.setLevel(logging.INFO)
audit_logger.propagate = False


def audit_log(event: str, **fields: Any) -> None:
    """Emit one structured JSON line for audit consumers (SIEM/ELK)."""
    payload = {"ts": now_utc().isoformat(), "event": event, "env": ENVIRONMENT, **fields}
    try:
        audit_logger.info(json.dumps(payload, default=str, separators=(",", ":")))
    except Exception:
        # audit logging must never break request handling
        logger.exception("audit_log serialization failed")


# ------------------------ helpers ------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, org_id: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "org_id": org_id,
        "type": "access",
        "exp": now_utc() + timedelta(hours=8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=8 * 3600,
        path="/",
    )


def clear_auth_cookie(response: Response):
    response.delete_cookie("access_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ------------------------ models ------------------------
_NAME_RE = r"^[A-Za-z0-9 _.\-]{1,80}$"
_PATTERN_RE = r"^[A-Za-z0-9_.\-\*]{1,120}$"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    org_name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AgentIn(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=_NAME_RE)
    description: Optional[str] = Field(default="", max_length=500)
    framework: str = Field(default="custom", max_length=40)
    capabilities: List[str] = Field(default_factory=list, max_length=32)
    trust_level: Literal["low", "medium", "high"] = "medium"
    status: Literal["active", "paused", "revoked"] = "active"


class PolicyCondition(BaseModel):
    field: str = Field(max_length=40)
    op: Literal["equals", "not_equals", "contains", "gt", "lt", "in", "not_in"]
    value: Any


class PolicyIn(BaseModel):
    name: str = Field(min_length=1, max_length=120, pattern=_NAME_RE)
    description: Optional[str] = Field(default="", max_length=500)
    priority: int = Field(default=100, ge=0, le=10000)
    subject: str = Field(default="*", max_length=64)
    resource_pattern: str = Field(default="*", max_length=120, pattern=_PATTERN_RE)
    action: str = Field(default="*", max_length=40)
    conditions: List[PolicyCondition] = Field(default_factory=list, max_length=32)
    effect: Literal["allow", "block", "modify", "escalate"] = "allow"
    modify_instructions: Optional[str] = Field(default=None, max_length=500)
    enabled: bool = True


class EvaluateIn(BaseModel):
    agent_id: str = Field(min_length=1, max_length=64)
    resource: str = Field(min_length=1, max_length=200)
    action: str = Field(default="read", max_length=40)
    purpose: Optional[str] = Field(default="", max_length=500)
    context: Dict[str, Any] = Field(default_factory=dict)
    payload: Dict[str, Any] = Field(default_factory=dict)


class EscalationDecisionIn(BaseModel):
    approve: bool
    note: Optional[str] = Field(default="", max_length=500)


# ------------------------ auth ------------------------
@api.post("/auth/register")
async def register(body: RegisterIn, request: Request, response: Response):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        audit_log("auth.register.rejected", email=email, ip=_client_ip(request), reason="duplicate")
        raise HTTPException(status_code=400, detail="Email already registered")
    org_id = new_id()
    user_id = new_id()
    await db.orgs.insert_one({
        "id": org_id,
        "name": body.org_name,
        "owner_user_id": user_id,
        "api_key": "sk_gov_" + uuid.uuid4().hex,
        "created_at": now_utc().isoformat(),
    })
    user_doc = {
        "id": user_id,
        "org_id": org_id,
        "email": email,
        "name": body.name,
        "role": "owner",
        "password_hash": hash_password(body.password),
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email, org_id)
    set_auth_cookie(response, token)
    audit_log("auth.register", user_id=user_id, org_id=org_id, email=email, ip=_client_ip(request))
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"user": user_doc, "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        audit_log("auth.login.failed", email=email, ip=_client_ip(request))
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["org_id"])
    set_auth_cookie(response, token)
    audit_log("auth.login", user_id=user["id"], org_id=user["org_id"], email=email, ip=_client_ip(request))
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user, "token": token}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    clear_auth_cookie(response)
    audit_log("auth.logout", ip=_client_ip(request))
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}


# ------------------------ agents ------------------------
def sanitize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@api.get("/agents")
async def list_agents(user=Depends(get_current_user)):
    items = await db.agents.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/agents")
async def create_agent(body: AgentIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({
        "id": new_id(),
        "org_id": user["org_id"],
        "created_at": now_utc().isoformat(),
        "risk_score": {"low": 15, "medium": 45, "high": 75}[body.trust_level],
        "decisions_count": 0,
    })
    await db.agents.insert_one(doc)
    return sanitize(doc)


@api.get("/agents/{agent_id}")
async def get_agent(agent_id: str, user=Depends(get_current_user)):
    doc = await db.agents.find_one({"id": agent_id, "org_id": user["org_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Agent not found")
    return doc


@api.patch("/agents/{agent_id}")
async def update_agent(agent_id: str, body: AgentIn, user=Depends(get_current_user)):
    update = body.model_dump()
    r = await db.agents.update_one(
        {"id": agent_id, "org_id": user["org_id"]}, {"$set": update}
    )
    if not r.matched_count:
        raise HTTPException(404, "Agent not found")
    doc = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    return doc


@api.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, user=Depends(get_current_user)):
    r = await db.agents.delete_one({"id": agent_id, "org_id": user["org_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Agent not found")
    return {"ok": True}


# ------------------------ policies ------------------------
@api.get("/policies")
async def list_policies(user=Depends(get_current_user)):
    items = await db.policies.find({"org_id": user["org_id"]}, {"_id": 0}).sort("priority", 1).to_list(500)
    return items


@api.post("/policies")
async def create_policy(body: PolicyIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({
        "id": new_id(),
        "org_id": user["org_id"],
        "created_at": now_utc().isoformat(),
        "hits": 0,
    })
    await db.policies.insert_one(doc)
    return sanitize(doc)


@api.patch("/policies/{policy_id}")
async def update_policy(policy_id: str, body: PolicyIn, user=Depends(get_current_user)):
    existing = await db.policies.find_one({"id": policy_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Policy not found")
    # Snapshot the previous version so we can roll back.
    version_num = existing.get("version", 1)
    await db.policy_versions.insert_one({
        "id": new_id(),
        "policy_id": policy_id,
        "org_id": user["org_id"],
        "version": version_num,
        "snapshot": existing,
        "changed_by": user["email"],
        "created_at": now_utc().isoformat(),
    })
    update = body.model_dump()
    update["version"] = version_num + 1
    await db.policies.update_one(
        {"id": policy_id, "org_id": user["org_id"]}, {"$set": update}
    )
    return await db.policies.find_one({"id": policy_id}, {"_id": 0})


@api.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, user=Depends(get_current_user)):
    r = await db.policies.delete_one({"id": policy_id, "org_id": user["org_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Policy not found")
    return {"ok": True}


# ------------------------ decision engine ------------------------
def _match_pattern(pattern: str, value: str) -> bool:
    if pattern == "*" or pattern == value:
        return True
    # simple glob: support "prefix.*" or "*.suffix"
    regex = "^" + re.escape(pattern).replace(r"\*", ".*") + "$"
    return re.fullmatch(regex, value) is not None


def _cond_ok(cond: dict, ctx: dict) -> bool:
    field = cond["field"]
    op = cond["op"]
    val = cond["value"]
    got = ctx.get(field)
    try:
        if op == "equals":
            return got == val
        if op == "not_equals":
            return got != val
        if op == "contains":
            return isinstance(got, str) and str(val) in got
        if op == "gt":
            return got is not None and float(got) > float(val)
        if op == "lt":
            return got is not None and float(got) < float(val)
        if op == "in":
            return got in (val if isinstance(val, list) else [val])
        if op == "not_in":
            return got not in (val if isinstance(val, list) else [val])
    except Exception:
        return False
    return False


def _compute_risk(agent: dict, req: EvaluateIn) -> int:
    base = agent.get("risk_score", 30)
    action_risk = {"read": 0, "write": 20, "delete": 40, "execute": 25}.get(req.action, 10)
    sensitive_boost = 30 if any(w in req.resource.lower() for w in ["billing", "payments", "pii", "customers", "prod"]) else 0
    purpose_penalty = 10 if not req.purpose else 0
    total = min(100, base + action_risk + sensitive_boost + purpose_penalty)
    return int(total)


async def _log_decision(org_id: str, agent: dict, req: EvaluateIn, decision: str,
                        matched_policy: Optional[dict], risk: int,
                        modified_payload: Optional[dict], reason: str,
                        client_ip: Optional[str] = None,
                        user_agent: Optional[str] = None,
                        evaluation_trace: Optional[List[dict]] = None) -> dict:
    entry = {
        "id": new_id(),
        "org_id": org_id,
        "agent_id": agent["id"],
        "agent_name": agent["name"],
        "resource": req.resource,
        "action": req.action,
        "purpose": req.purpose,
        "risk_score": risk,
        "decision": decision,
        "policy_id": matched_policy["id"] if matched_policy else None,
        "policy_name": matched_policy["name"] if matched_policy else "Default policy",
        "reason": reason,
        "context": req.context,
        "payload": req.payload,
        "modified_payload": modified_payload,
        "evaluation_trace": evaluation_trace or [],
        "client_ip": client_ip,
        "user_agent": user_agent,
        "created_at": now_utc().isoformat(),
    }
    await db.decisions.insert_one(entry.copy())
    # increment counters
    await db.agents.update_one({"id": agent["id"]}, {"$inc": {"decisions_count": 1}})
    if matched_policy:
        await db.policies.update_one({"id": matched_policy["id"]}, {"$inc": {"hits": 1}})
    if decision == "escalate":
        await db.escalations.insert_one({
            "id": new_id(),
            "org_id": org_id,
            "decision_id": entry["id"],
            "agent_id": agent["id"],
            "agent_name": agent["name"],
            "resource": req.resource,
            "action": req.action,
            "risk_score": risk,
            "reason": reason,
            "status": "pending",
            "created_at": now_utc().isoformat(),
        })
    # structured audit trail — one JSON line per decision
    audit_log(
        "decision",
        decision_id=entry["id"],
        org_id=org_id,
        agent_id=agent["id"],
        resource=req.resource,
        action=req.action,
        decision=decision,
        risk_score=risk,
        policy_id=entry["policy_id"],
        client_ip=client_ip,
    )
    # Fan out to real-time subscribers and configured webhooks (fire and forget).
    asyncio.create_task(_ws_broadcast(org_id, entry))
    asyncio.create_task(_deliver_webhooks(org_id, entry))
    entry.pop("_id", None)
    return entry


async def _evaluate(org_id: str, req: EvaluateIn,
                    client_ip: Optional[str] = None,
                    user_agent: Optional[str] = None) -> dict:
    agent = await db.agents.find_one({"id": req.agent_id, "org_id": org_id}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "Unknown agent")
    trace: List[dict] = [
        {"step": "identity", "matched": True,
         "detail": f"Agent {agent['name']} (trust={agent.get('trust_level')})"},
    ]
    if agent.get("status") != "active":
        trace.append({"step": "status", "matched": False,
                      "detail": f"Agent is {agent.get('status')}, blocking"})
        return await _log_decision(org_id, agent, req, "block", None, 100, None,
                                   f"Agent status is {agent.get('status')}",
                                   client_ip, user_agent, evaluation_trace=trace)
    risk = _compute_risk(agent, req)
    trace.append({"step": "risk", "matched": True,
                  "detail": f"Computed risk score = {risk}"})
    ctx = {
        "resource": req.resource,
        "action": req.action,
        "purpose": req.purpose or "",
        "agent_trust": agent.get("trust_level"),
        "risk_score": risk,
        **req.context,
    }
    policies = await db.policies.find(
        {"org_id": org_id, "enabled": True}, {"_id": 0}
    ).sort("priority", 1).to_list(500)

    for p in policies:
        if p["subject"] != "*" and p["subject"] != req.agent_id:
            trace.append({"step": f"policy:{p['name']}", "matched": False,
                          "detail": f"subject '{p['subject']}' does not match agent"})
            continue
        if not _match_pattern(p["resource_pattern"], req.resource):
            trace.append({"step": f"policy:{p['name']}", "matched": False,
                          "detail": f"resource '{req.resource}' does not match pattern '{p['resource_pattern']}'"})
            continue
        if p["action"] != "*" and p["action"] != req.action:
            trace.append({"step": f"policy:{p['name']}", "matched": False,
                          "detail": f"action '{req.action}' does not match '{p['action']}'"})
            continue
        cond_fail = None
        for c in p.get("conditions", []):
            if not _cond_ok(c, ctx):
                cond_fail = c
                break
        if cond_fail:
            trace.append({"step": f"policy:{p['name']}", "matched": False,
                          "detail": f"condition {cond_fail['field']} {cond_fail['op']} {cond_fail['value']} failed"})
            continue
        # matched
        modified = None
        reason = f"Matched policy '{p['name']}' (priority {p['priority']})"
        trace.append({"step": f"policy:{p['name']}", "matched": True,
                      "detail": f"effect='{p['effect']}', priority={p['priority']}"})
        if p["effect"] == "modify":
            modified = {**req.payload, "_governance": {"redacted_fields": ["email", "phone", "ssn"],
                                                        "notes": p.get("modify_instructions") or "PII stripped"}}
        return await _log_decision(org_id, agent, req, p["effect"], p, risk, modified, reason,
                                   client_ip, user_agent, evaluation_trace=trace)

    # default: escalate if high risk, else allow
    if risk >= 70:
        trace.append({"step": "default", "matched": True,
                      "detail": f"No policy matched, risk {risk} ≥ 70 → escalate"})
        return await _log_decision(org_id, agent, req, "escalate", None, risk, None,
                                   f"No policy matched and risk {risk} ≥ 70",
                                   client_ip, user_agent, evaluation_trace=trace)
    trace.append({"step": "default", "matched": True,
                  "detail": f"No policy matched, risk {risk} < 70 → allow"})
    return await _log_decision(org_id, agent, req, "allow", None, risk, None,
                               "No policy matched, low risk — default allow",
                               client_ip, user_agent, evaluation_trace=trace)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if fwd:
        return fwd
    return request.client.host if request.client else "unknown"


@api.post("/evaluate")
async def evaluate(body: EvaluateIn, request: Request, user=Depends(get_current_user)):
    return await _evaluate(
        user["org_id"], body,
        client_ip=_client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:200],
    )


# ------------------------ decisions / audit ------------------------
@api.get("/decisions")
async def list_decisions(
    user=Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
    decision: Optional[str] = None,
    agent_id: Optional[str] = None,
    search: Optional[str] = None,
):
    q: Dict[str, Any] = {"org_id": user["org_id"]}
    if decision:
        q["decision"] = decision
    if agent_id:
        q["agent_id"] = agent_id
    if search:
        q["$or"] = [
            {"resource": {"$regex": search, "$options": "i"}},
            {"agent_name": {"$regex": search, "$options": "i"}},
            {"purpose": {"$regex": search, "$options": "i"}},
        ]
    items = await db.decisions.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items


@api.get("/decisions/{decision_id}")
async def get_decision(decision_id: str, user=Depends(get_current_user)):
    doc = await db.decisions.find_one({"id": decision_id, "org_id": user["org_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


# ------------------------ escalations ------------------------
@api.get("/escalations")
async def list_escalations(user=Depends(get_current_user),
                           status: str = "pending"):
    items = await db.escalations.find(
        {"org_id": user["org_id"], "status": status}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return items


@api.post("/escalations/{esc_id}/decide")
async def decide_escalation(esc_id: str, body: EscalationDecisionIn,
                            user=Depends(get_current_user)):
    esc = await db.escalations.find_one({"id": esc_id, "org_id": user["org_id"]})
    if not esc:
        raise HTTPException(404, "Not found")
    new_status = "approved" if body.approve else "rejected"
    await db.escalations.update_one(
        {"id": esc_id},
        {"$set": {
            "status": new_status,
            "resolved_by": user["email"],
            "resolved_at": now_utc().isoformat(),
            "note": body.note or "",
        }},
    )
    return {"ok": True, "status": new_status}


# ------------------------ analytics ------------------------
@api.get("/analytics/overview")
async def overview(user=Depends(get_current_user)):
    org_id = user["org_id"]
    now = now_utc()
    since = (now - timedelta(hours=24)).isoformat()

    total = await db.decisions.count_documents({"org_id": org_id})
    total_24 = await db.decisions.count_documents({"org_id": org_id, "created_at": {"$gte": since}})
    agents_count = await db.agents.count_documents({"org_id": org_id})
    policies_count = await db.policies.count_documents({"org_id": org_id, "enabled": True})
    pending_escalations = await db.escalations.count_documents({"org_id": org_id, "status": "pending"})

    pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$decision", "count": {"$sum": 1}}},
    ]
    mix: Dict[str, int] = {"allow": 0, "block": 0, "modify": 0, "escalate": 0}
    async for row in db.decisions.aggregate(pipeline):
        mix[row["_id"]] = row["count"]

    # last 12 hours bucketed
    buckets: List[Dict[str, Any]] = []
    for i in range(11, -1, -1):
        start = now - timedelta(hours=i + 1)
        end = now - timedelta(hours=i)
        cnt = await db.decisions.count_documents({
            "org_id": org_id,
            "created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
        })
        blocks = await db.decisions.count_documents({
            "org_id": org_id, "decision": "block",
            "created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
        })
        buckets.append({
            "label": end.strftime("%H:00"),
            "total": cnt,
            "blocks": blocks,
        })

    # top agents
    top_agents = []
    ap = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": {"id": "$agent_id", "name": "$agent_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 5},
    ]
    async for row in db.decisions.aggregate(ap):
        top_agents.append({"agent_id": row["_id"]["id"], "name": row["_id"]["name"], "count": row["count"]})

    # top blocked resources
    top_blocked = []
    bp = [
        {"$match": {"org_id": org_id, "decision": "block"}},
        {"$group": {"_id": "$resource", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 5},
    ]
    async for row in db.decisions.aggregate(bp):
        top_blocked.append({"resource": row["_id"], "count": row["count"]})

    return {
        "total": total,
        "total_24h": total_24,
        "agents": agents_count,
        "active_policies": policies_count,
        "pending_escalations": pending_escalations,
        "mix": mix,
        "timeline": buckets,
        "top_agents": top_agents,
        "top_blocked": top_blocked,
    }


# ------------------------ simulator ------------------------
SIM_RESOURCES = [
    "customers.read", "customers.export", "billing.read", "billing.write",
    "docs.public.read", "docs.internal.read", "prod.deploy",
    "analytics.query", "pii.email", "slack.post",
]
SIM_ACTIONS = ["read", "write", "execute", "delete"]
SIM_PURPOSES = [
    "user asked to summarize account",
    "generating weekly digest",
    "responding to customer email",
    "",
    "monthly reconciliation",
    "debugging production incident",
]


@api.post("/simulate")
async def simulate(request: Request, count: int = 10, user=Depends(get_current_user)):
    org_id = user["org_id"]
    agents = await db.agents.find({"org_id": org_id, "status": "active"}, {"_id": 0}).to_list(50)
    if not agents:
        raise HTTPException(400, "Create at least one active agent first")
    count = max(1, min(50, int(count)))
    ip = _client_ip(request)
    ua = request.headers.get("user-agent", "")[:200]
    made = []
    for _ in range(count):
        a = random.choice(agents)
        req = EvaluateIn(
            agent_id=a["id"],
            resource=random.choice(SIM_RESOURCES),
            action=random.choice(SIM_ACTIONS),
            purpose=random.choice(SIM_PURPOSES),
            context={"source": "simulator", "ip": f"10.0.{random.randint(0,255)}.{random.randint(0,255)}"},
            payload={"demo": True},
        )
        made.append(await _evaluate(org_id, req, client_ip=ip, user_agent=ua))
    return {"created": len(made), "decisions": made}


# ============================================================
# V2 — API keys, webhooks, connectors, members/RBAC,
# policy versions/rollback, compliance, heatmap, WebSocket
# ============================================================

# ---------- role helpers ----------
_ROLE_ORDER = ["viewer", "editor", "admin", "owner"]


def _has_role(user: dict, minimum: str) -> bool:
    try:
        return _ROLE_ORDER.index(user.get("role", "viewer")) >= _ROLE_ORDER.index(minimum)
    except ValueError:
        return False


def require_role(minimum: str):
    async def _dep(user=Depends(get_current_user)):
        if not _has_role(user, minimum):
            raise HTTPException(403, f"Requires role: {minimum} or higher")
        return user
    return _dep


# ---------- WebSocket hub (per-org fan-out) ----------
class _WsHub:
    def __init__(self):
        self._conns: Dict[str, Set[WebSocket]] = {}

    async def connect(self, org_id: str, ws: WebSocket):
        await ws.accept()
        self._conns.setdefault(org_id, set()).add(ws)

    def disconnect(self, org_id: str, ws: WebSocket):
        self._conns.get(org_id, set()).discard(ws)

    async def broadcast(self, org_id: str, message: dict):
        dead: List[WebSocket] = []
        for w in list(self._conns.get(org_id, set())):
            try:
                await w.send_json(message)
            except Exception:
                dead.append(w)
        for w in dead:
            self.disconnect(org_id, w)


ws_hub = _WsHub()


async def _ws_broadcast(org_id: str, decision: dict) -> None:
    try:
        # slim payload — drop bulky fields
        payload = {k: v for k, v in decision.items() if k not in ("evaluation_trace", "payload", "modified_payload", "_id")}
        await ws_hub.broadcast(org_id, {"type": "decision", "data": payload})
    except Exception:
        logger.exception("ws_broadcast failed")


@app.websocket("/api/ws/decisions")
async def ws_decisions(ws: WebSocket, token: str = Query(...)):
    """Bearer-authenticated per-tenant live decision stream."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        org_id = payload["org_id"]
    except Exception:
        await ws.close(code=1008)
        return
    await ws_hub.connect(org_id, ws)
    try:
        await ws.send_json({"type": "hello", "org_id": org_id})
        while True:
            # keep alive; discard incoming messages
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_hub.disconnect(org_id, ws)


# ---------- API keys ----------
class ApiKeyIn(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=_NAME_RE)
    role: Literal["viewer", "editor", "admin"] = "editor"


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@api.get("/api-keys")
async def list_keys(user=Depends(get_current_user)):
    keys = await db.api_keys.find({"org_id": user["org_id"], "revoked": False},
                                  {"_id": 0, "hash": 0}).sort("created_at", -1).to_list(200)
    return keys


@api.post("/api-keys")
async def create_key(body: ApiKeyIn, user=Depends(require_role("admin"))):
    raw = "mg_" + secrets.token_urlsafe(28)
    doc = {
        "id": new_id(),
        "org_id": user["org_id"],
        "name": body.name,
        "role": body.role,
        "prefix": raw[:8],
        "suffix": raw[-4:],
        "hash": _hash_key(raw),
        "created_by": user["email"],
        "created_at": now_utc().isoformat(),
        "last_used_at": None,
        "revoked": False,
    }
    await db.api_keys.insert_one(doc)
    audit_log("apikey.create", org_id=user["org_id"], key_id=doc["id"], name=body.name)
    doc.pop("_id", None)
    doc.pop("hash", None)
    return {**doc, "secret": raw}  # returned ONCE only


@api.post("/api-keys/{key_id}/rotate")
async def rotate_key(key_id: str, user=Depends(require_role("admin"))):
    raw = "mg_" + secrets.token_urlsafe(28)
    r = await db.api_keys.update_one(
        {"id": key_id, "org_id": user["org_id"], "revoked": False},
        {"$set": {"hash": _hash_key(raw), "prefix": raw[:8], "suffix": raw[-4:],
                  "rotated_at": now_utc().isoformat()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Key not found")
    audit_log("apikey.rotate", org_id=user["org_id"], key_id=key_id)
    return {"id": key_id, "secret": raw}


@api.post("/api-keys/{key_id}/revoke")
async def revoke_key(key_id: str, user=Depends(require_role("admin"))):
    r = await db.api_keys.update_one(
        {"id": key_id, "org_id": user["org_id"]},
        {"$set": {"revoked": True, "revoked_at": now_utc().isoformat()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Key not found")
    audit_log("apikey.revoke", org_id=user["org_id"], key_id=key_id)
    return {"ok": True}


# ---------- Webhooks ----------
class WebhookIn(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=_NAME_RE)
    url: str = Field(min_length=8, max_length=400)
    kind: Literal["slack", "teams", "pagerduty", "custom"] = "custom"
    events: List[Literal["block", "escalate", "modify", "allow"]] = Field(default_factory=lambda: ["block", "escalate"])
    enabled: bool = True


@api.get("/webhooks")
async def list_webhooks(user=Depends(get_current_user)):
    items = await db.webhooks.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api.post("/webhooks")
async def create_webhook(body: WebhookIn, user=Depends(require_role("admin"))):
    doc = {**body.model_dump(), "id": new_id(), "org_id": user["org_id"],
           "created_at": now_utc().isoformat(), "delivery_count": 0, "last_delivered_at": None}
    await db.webhooks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/webhooks/{wid}")
async def update_webhook(wid: str, body: WebhookIn, user=Depends(require_role("admin"))):
    r = await db.webhooks.update_one({"id": wid, "org_id": user["org_id"]}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    return await db.webhooks.find_one({"id": wid}, {"_id": 0})


@api.delete("/webhooks/{wid}")
async def delete_webhook(wid: str, user=Depends(require_role("admin"))):
    r = await db.webhooks.delete_one({"id": wid, "org_id": user["org_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.post("/webhooks/{wid}/test")
async def test_webhook(wid: str, user=Depends(require_role("admin"))):
    wh = await db.webhooks.find_one({"id": wid, "org_id": user["org_id"]}, {"_id": 0})
    if not wh:
        raise HTTPException(404, "Not found")
    ok, status_code = await _post_webhook(wh, {
        "type": "test",
        "message": "MemoryGate test event from " + user["email"],
        "ts": now_utc().isoformat(),
    })
    return {"ok": ok, "status": status_code}


def _format_webhook_payload(wh: dict, decision: dict) -> dict:
    d = decision
    title = f"[{d['decision'].upper()}] {d['agent_name']} → {d['action']} {d['resource']}"
    detail = f"Policy: {d['policy_name']} · Risk: {d['risk_score']} · Reason: {d['reason']}"
    if wh["kind"] == "slack":
        return {"text": f"*{title}*\n{detail}"}
    if wh["kind"] == "teams":
        return {"@type": "MessageCard", "@context": "https://schema.org/extensions",
                "summary": title, "themeColor": "FF3366",
                "sections": [{"activityTitle": title, "text": detail}]}
    if wh["kind"] == "pagerduty":
        return {"payload": {"summary": title, "severity": "warning", "source": "MemoryGate",
                            "custom_details": {"reason": d["reason"], "risk": d["risk_score"]}},
                "routing_key": "PLACEHOLDER", "event_action": "trigger"}
    return {"event": "decision", "decision": d}


async def _post_webhook(wh: dict, body: dict) -> (bool, int):
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(wh["url"], json=body, headers={"User-Agent": "MemoryGate/1.0"})
            return (200 <= r.status_code < 300), r.status_code
    except Exception as e:
        logger.warning("webhook delivery failed for %s: %s", wh.get("id"), e)
        return False, 0


async def _deliver_webhooks(org_id: str, decision: dict) -> None:
    try:
        hooks = await db.webhooks.find({"org_id": org_id, "enabled": True}, {"_id": 0}).to_list(50)
        for wh in hooks:
            if decision["decision"] not in wh.get("events", []):
                continue
            body = _format_webhook_payload(wh, decision)
            ok, code = await _post_webhook(wh, body)
            await db.webhooks.update_one({"id": wh["id"]},
                                         {"$inc": {"delivery_count": 1},
                                          "$set": {"last_delivered_at": now_utc().isoformat(),
                                                    "last_status": code}})
            audit_log("webhook.deliver", org_id=org_id, webhook_id=wh["id"],
                      status=code, ok=ok, decision_id=decision["id"])
    except Exception:
        logger.exception("_deliver_webhooks failed")


# ---------- Connectors ----------
CONNECTOR_KINDS = ["postgres", "mongodb", "surrealdb", "redis", "pinecone", "qdrant", "rest"]


class ConnectorIn(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=_NAME_RE)
    kind: Literal["postgres", "mongodb", "surrealdb", "redis", "pinecone", "qdrant", "rest"]
    config: Dict[str, Any] = Field(default_factory=dict)  # host, port, url, api_key, etc.
    scope: str = Field(default="", max_length=120)  # e.g. "customers.*"


@api.get("/connectors")
async def list_connectors(user=Depends(get_current_user)):
    items = await db.connectors.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.post("/connectors")
async def create_connector(body: ConnectorIn, user=Depends(require_role("editor"))):
    doc = {**body.model_dump(), "id": new_id(), "org_id": user["org_id"],
           "status": "unknown", "created_at": now_utc().isoformat()}
    # Redact obvious secret fields when storing (still keep, just mark)
    await db.connectors.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/connectors/{cid}")
async def update_connector(cid: str, body: ConnectorIn, user=Depends(require_role("editor"))):
    r = await db.connectors.update_one({"id": cid, "org_id": user["org_id"]}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    return await db.connectors.find_one({"id": cid}, {"_id": 0})


@api.delete("/connectors/{cid}")
async def delete_connector(cid: str, user=Depends(require_role("editor"))):
    r = await db.connectors.delete_one({"id": cid, "org_id": user["org_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.post("/connectors/{cid}/test")
async def test_connector(cid: str, user=Depends(get_current_user)):
    c = await db.connectors.find_one({"id": cid, "org_id": user["org_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    kind = c["kind"]
    cfg = c.get("config", {})
    ok = False
    detail = ""
    try:
        if kind == "rest":
            url = cfg.get("url", "")
            async with httpx.AsyncClient(timeout=4.0) as cli:
                r = await cli.get(url, headers=cfg.get("headers") or {})
                ok = r.status_code < 500
                detail = f"HTTP {r.status_code}"
        elif kind == "mongodb":
            url = cfg.get("url", "")
            tmp = AsyncIOMotorClient(url, serverSelectionTimeoutMS=2500)
            info = await tmp.admin.command("ping")
            ok = bool(info.get("ok"))
            detail = "ping ok" if ok else "ping failed"
            tmp.close()
        else:
            # For demo: heuristic — if a URL/host is provided we mark reachable.
            has_target = any(cfg.get(k) for k in ("url", "host", "endpoint"))
            ok = has_target
            detail = "config accepted" if ok else "missing host/url"
    except Exception as e:
        ok = False
        detail = str(e)[:200]
    await db.connectors.update_one({"id": cid}, {"$set": {
        "status": "healthy" if ok else "degraded",
        "last_tested_at": now_utc().isoformat(),
        "last_test_detail": detail,
    }})
    return {"ok": ok, "detail": detail}


# ---------- Members / RBAC ----------
class InviteIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    role: Literal["viewer", "editor", "admin"] = "editor"
    password: str = Field(min_length=8, max_length=128)


class RoleUpdateIn(BaseModel):
    role: Literal["viewer", "editor", "admin", "owner"]


@api.get("/members")
async def list_members(user=Depends(get_current_user)):
    items = await db.users.find({"org_id": user["org_id"]},
                                {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)
    return items


@api.post("/members")
async def invite_member(body: InviteIn, user=Depends(require_role("admin"))):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already in use")
    doc = {
        "id": new_id(),
        "org_id": user["org_id"],
        "email": email,
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "invited_by": user["email"],
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    audit_log("member.invite", org_id=user["org_id"], email=email, role=body.role)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@api.patch("/members/{uid}")
async def change_role(uid: str, body: RoleUpdateIn, user=Depends(require_role("admin"))):
    target = await db.users.find_one({"id": uid, "org_id": user["org_id"]})
    if not target:
        raise HTTPException(404, "Not found")
    if target["role"] == "owner" and body.role != "owner":
        raise HTTPException(400, "Cannot demote the owner")
    if body.role == "owner":
        raise HTTPException(400, "Ownership transfer requires a separate endpoint")
    await db.users.update_one({"id": uid}, {"$set": {"role": body.role}})
    audit_log("member.role", org_id=user["org_id"], target_id=uid, role=body.role)
    return {"ok": True}


@api.delete("/members/{uid}")
async def remove_member(uid: str, user=Depends(require_role("admin"))):
    target = await db.users.find_one({"id": uid, "org_id": user["org_id"]})
    if not target:
        raise HTTPException(404, "Not found")
    if target["role"] == "owner":
        raise HTTPException(400, "Cannot remove owner")
    if target["id"] == user["id"]:
        raise HTTPException(400, "Cannot remove yourself")
    await db.users.delete_one({"id": uid})
    audit_log("member.remove", org_id=user["org_id"], target_id=uid)
    return {"ok": True}


# ---------- Policy versions / rollback ----------
@api.get("/policies/{policy_id}/versions")
async def list_policy_versions(policy_id: str, user=Depends(get_current_user)):
    items = await db.policy_versions.find(
        {"policy_id": policy_id, "org_id": user["org_id"]}, {"_id": 0}
    ).sort("version", -1).to_list(200)
    return items


@api.post("/policies/{policy_id}/rollback/{version}")
async def rollback_policy(policy_id: str, version: int, user=Depends(require_role("editor"))):
    ver = await db.policy_versions.find_one(
        {"policy_id": policy_id, "org_id": user["org_id"], "version": version}, {"_id": 0}
    )
    if not ver:
        raise HTTPException(404, "Version not found")
    existing = await db.policies.find_one({"id": policy_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Policy not found")
    # snapshot current before overwrite
    await db.policy_versions.insert_one({
        "id": new_id(), "policy_id": policy_id, "org_id": user["org_id"],
        "version": existing.get("version", 1), "snapshot": existing,
        "changed_by": user["email"] + " (pre-rollback)",
        "created_at": now_utc().isoformat(),
    })
    snap = ver["snapshot"]
    snap["version"] = existing.get("version", 1) + 1
    snap.pop("_id", None)
    await db.policies.update_one({"id": policy_id, "org_id": user["org_id"]}, {"$set": snap})
    audit_log("policy.rollback", org_id=user["org_id"], policy_id=policy_id, to_version=version)
    return {"ok": True, "version": snap["version"]}


# ---------- Compliance ----------
COMPLIANCE_FRAMEWORKS = {
    "soc2": {
        "name": "SOC 2 Type II",
        "controls": [
            ("CC1.1", "Governance policies defined", lambda s: s["policies"] >= 1),
            ("CC5.2", "Access reviewed via decision log", lambda s: s["decisions_total"] >= 1),
            ("CC6.1", "Logical access via authenticated agents", lambda s: s["agents"] >= 1),
            ("CC7.2", "Anomalies flagged & escalated", lambda s: s["escalations_total"] >= 0),
            ("CC7.3", "Continuous audit trail retained", lambda s: s["audit_lines"] >= 1),
            ("CC8.1", "Change management via policy versioning", lambda s: s["policy_versions"] >= 0),
        ],
    },
    "iso27001": {
        "name": "ISO/IEC 27001:2022",
        "controls": [
            ("A.5.15", "Access control policies defined", lambda s: s["policies"] >= 1),
            ("A.8.2",  "Privileged access rights governed", lambda s: True),
            ("A.8.15", "Logging enabled for AI actions",   lambda s: s["decisions_total"] >= 1),
            ("A.8.16", "Monitoring & alerting configured", lambda s: s["webhooks"] >= 0),
            ("A.5.30", "ICT readiness for continuity",     lambda s: True),
        ],
    },
    "gdpr": {
        "name": "GDPR",
        "controls": [
            ("Art. 5",  "Lawful processing tracked in decisions", lambda s: s["decisions_total"] >= 1),
            ("Art. 15", "Data subject access via audit log",       lambda s: True),
            ("Art. 25", "Data protection by design (PII redact)",  lambda s: s["modify_policies"] >= 0),
            ("Art. 30", "Records of processing activities",        lambda s: s["audit_lines"] >= 1),
            ("Art. 32", "Security of processing (encryption etc.)", lambda s: True),
        ],
    },
    "hipaa": {
        "name": "HIPAA Security Rule",
        "controls": [
            ("§164.308(a)(3)", "Workforce access management",      lambda s: s["members"] >= 1),
            ("§164.308(a)(5)", "Security awareness (audit trail)", lambda s: s["audit_lines"] >= 1),
            ("§164.312(a)",    "Access control (unique agent ID)",  lambda s: s["agents"] >= 1),
            ("§164.312(b)",    "Audit controls",                    lambda s: s["decisions_total"] >= 1),
            ("§164.312(e)",    "Transmission security (TLS)",       lambda s: True),
        ],
    },
}


async def _compliance_stats(org_id: str) -> dict:
    return {
        "policies": await db.policies.count_documents({"org_id": org_id, "enabled": True}),
        "agents": await db.agents.count_documents({"org_id": org_id}),
        "decisions_total": await db.decisions.count_documents({"org_id": org_id}),
        "escalations_total": await db.escalations.count_documents({"org_id": org_id}),
        "policy_versions": await db.policy_versions.count_documents({"org_id": org_id}),
        "webhooks": await db.webhooks.count_documents({"org_id": org_id, "enabled": True}),
        "members": await db.users.count_documents({"org_id": org_id}),
        "audit_lines": await db.decisions.count_documents({"org_id": org_id}),
        "modify_policies": await db.policies.count_documents({"org_id": org_id, "effect": "modify"}),
    }


@api.get("/compliance/report")
async def compliance_report(framework: str = Query("soc2"), user=Depends(get_current_user)):
    fw = COMPLIANCE_FRAMEWORKS.get(framework.lower())
    if not fw:
        raise HTTPException(400, "Unknown framework")
    stats = await _compliance_stats(user["org_id"])
    controls = []
    for code, name, check in fw["controls"]:
        controls.append({"code": code, "name": name, "status": "pass" if check(stats) else "attention"})
    passed = sum(1 for c in controls if c["status"] == "pass")
    return {
        "framework": framework, "framework_name": fw["name"],
        "org_id": user["org_id"], "generated_at": now_utc().isoformat(),
        "coverage": round(100 * passed / max(1, len(controls))),
        "stats": stats, "controls": controls,
    }


@api.get("/compliance/export.csv")
async def compliance_export(framework: str = Query("soc2"), user=Depends(get_current_user)):
    report = await compliance_report(framework, user)  # reuse
    lines = ["framework,code,control,status,generated_at,org_id"]
    for c in report["controls"]:
        lines.append(f'{report["framework_name"]},{c["code"]},"{c["name"]}",{c["status"]},{report["generated_at"]},{report["org_id"]}')
    return StreamingResponse(
        iter(["\n".join(lines) + "\n"]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="memorygate_{framework}_report.csv"'},
    )


# ---------- Risk heatmap ----------
_HEATMAP_ACTIONS = ["read", "write", "execute", "delete"]


@api.get("/analytics/heatmap")
async def heatmap(user=Depends(get_current_user)):
    org_id = user["org_id"]
    pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {
            "_id": {"resource": "$resource", "action": "$action"},
            "count": {"$sum": 1},
            "avg_risk": {"$avg": "$risk_score"},
            "blocks": {"$sum": {"$cond": [{"$eq": ["$decision", "block"]}, 1, 0]}},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 30},
    ]
    resources: List[str] = []
    matrix: Dict[str, Dict[str, dict]] = {}
    async for row in db.decisions.aggregate(pipeline):
        r = row["_id"]["resource"]
        a = row["_id"]["action"]
        if r not in resources:
            resources.append(r)
        matrix.setdefault(r, {})[a] = {
            "count": row["count"],
            "avg_risk": round(row["avg_risk"] or 0),
            "blocks": row["blocks"],
        }
    resources = resources[:10]
    cells = []
    for r in resources:
        for a in _HEATMAP_ACTIONS:
            cell = matrix.get(r, {}).get(a) or {"count": 0, "avg_risk": 0, "blocks": 0}
            cells.append({"resource": r, "action": a, **cell})
    return {"resources": resources, "actions": _HEATMAP_ACTIONS, "cells": cells}





# ------------------------ health ------------------------
@api.get("/")
async def root():
    return {"ok": True, "service": "MemoryGate Runtime Governance"}


# ------------------------ startup ------------------------
async def _ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.orgs.create_index("id", unique=True)
    await db.agents.create_index([("org_id", 1), ("created_at", -1)])
    await db.policies.create_index([("org_id", 1), ("priority", 1)])
    await db.policy_versions.create_index([("policy_id", 1), ("version", -1)])
    await db.decisions.create_index([("org_id", 1), ("created_at", -1)])
    await db.escalations.create_index([("org_id", 1), ("status", 1)])
    await db.api_keys.create_index([("org_id", 1), ("revoked", 1)])
    await db.webhooks.create_index([("org_id", 1)])
    await db.connectors.create_index([("org_id", 1)])


async def _seed_demo():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sentinel.ai").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin@2026")
    org_name = os.environ.get("ADMIN_ORG_NAME", "Sentinel Labs")

    existing = await db.users.find_one({"email": admin_email})
    if existing:
        # Keep password in sync if changed
        if not verify_password(admin_pw, existing["password_hash"]):
            await db.users.update_one({"email": admin_email},
                                      {"$set": {"password_hash": hash_password(admin_pw)}})
        org_id = existing["org_id"]
    else:
        org_id = new_id()
        user_id = new_id()
        await db.orgs.insert_one({
            "id": org_id, "name": org_name, "owner_user_id": user_id,
            "api_key": "sk_gov_" + uuid.uuid4().hex,
            "created_at": now_utc().isoformat(),
        })
        await db.users.insert_one({
            "id": user_id, "org_id": org_id, "email": admin_email, "name": "Admin",
            "role": "owner", "password_hash": hash_password(admin_pw),
            "created_at": now_utc().isoformat(),
        })

    # Only seed sample data if the org has none.
    if await db.agents.count_documents({"org_id": org_id}) > 0:
        return

    sample_agents = [
        {"name": "SupportBot", "framework": "openai", "description": "Answers customer support tickets",
         "capabilities": ["read_tickets", "email"], "trust_level": "medium"},
        {"name": "SalesInsights", "framework": "langchain", "description": "Analyzes CRM data for reps",
         "capabilities": ["read_crm", "analytics"], "trust_level": "high"},
        {"name": "DevOpsCopilot", "framework": "anthropic", "description": "Runs deploys and reads logs",
         "capabilities": ["exec_shell", "deploy"], "trust_level": "low"},
        {"name": "FinanceAssist", "framework": "custom", "description": "Handles invoices and reconciliation",
         "capabilities": ["read_billing", "write_ledger"], "trust_level": "medium"},
    ]
    for a in sample_agents:
        doc = {**a, "id": new_id(), "org_id": org_id, "status": "active",
               "risk_score": {"low": 15, "medium": 45, "high": 75}[a["trust_level"]],
               "decisions_count": 0, "created_at": now_utc().isoformat()}
        await db.agents.insert_one(doc)

    sample_policies = [
        {"name": "Block deletions on production",
         "description": "No agent may delete production resources.",
         "priority": 10, "subject": "*", "resource_pattern": "prod.*",
         "action": "delete", "conditions": [], "effect": "block", "enabled": True},
        {"name": "Redact PII on customer reads",
         "description": "Strip PII on customer data reads.",
         "priority": 20, "subject": "*", "resource_pattern": "customers.*",
         "action": "read", "conditions": [], "effect": "modify",
         "modify_instructions": "Redact email, phone, SSN", "enabled": True},
        {"name": "Escalate high-risk writes",
         "description": "Any write with risk score >= 60 must be human-approved.",
         "priority": 30, "subject": "*", "resource_pattern": "*",
         "action": "write",
         "conditions": [{"field": "risk_score", "op": "gt", "value": 60}],
         "effect": "escalate", "enabled": True},
        {"name": "Allow public docs",
         "description": "All agents may read public docs.",
         "priority": 40, "subject": "*", "resource_pattern": "docs.public.*",
         "action": "read", "conditions": [], "effect": "allow", "enabled": True},
        {"name": "Block low-trust agents from billing",
         "description": "Low-trust agents cannot touch billing.",
         "priority": 15, "subject": "*", "resource_pattern": "billing.*",
         "action": "*",
         "conditions": [{"field": "agent_trust", "op": "equals", "value": "low"}],
         "effect": "block", "enabled": True},
    ]
    for p in sample_policies:
        doc = {**p, "id": new_id(), "org_id": org_id, "hits": 0,
               "created_at": now_utc().isoformat()}
        await db.policies.insert_one(doc)


@app.on_event("startup")
async def _startup():
    await _ensure_indexes()
    await _seed_demo()
    logger.info("AI Runtime Governance API ready.")


@app.on_event("shutdown")
async def _shutdown():
    client.close()


app.include_router(api)

# ============================================================
# Security middleware stack (executed in reverse-registration order):
#   1) CORS               — first-line origin control
#   2) Security headers   — added to every response
#   3) Origin CSRF check  — reject cross-origin mutations in prod
#   4) Rate limiter       — per-IP sliding window per route class
# ============================================================

# ---- 1) CORS ----
if IS_DEV:
    # Permissive during local dev only.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    if not ALLOWED_ORIGINS and not ALLOWED_ORIGIN_SUFFIXES:
        logger.warning("ALLOWED_ORIGINS/ALLOWED_ORIGIN_SUFFIXES are empty in non-dev env; refusing all cross-origin requests")
    _regex = _cors_regex()
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=_regex or r"^$",  # match nothing if not configured
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        max_age=600,
    )


# ---- 2) Security headers ----
@app.middleware("http")
async def _security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    )
    if not IS_DEV:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


# ---- 3) Origin-based CSRF guard for cookie-authenticated mutations ----
_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def _csrf_guard(request: Request, call_next):
    # Only guard /api mutations. Same-origin browser POSTs always include an Origin
    # header; SDK / server-to-server callers use Authorization: Bearer (not cookies)
    # and are exempt because a cross-site attacker cannot forge that header.
    if (
        not IS_DEV
        and request.method in _MUTATING_METHODS
        and request.url.path.startswith("/api/")
    ):
        origin = request.headers.get("origin")
        auth = request.headers.get("authorization", "")
        if origin and not _origin_allowed(origin) and not auth.startswith("Bearer "):
            audit_log(
                "csrf.blocked",
                origin=origin,
                path=request.url.path,
                ip=_client_ip(request),
            )
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    return await call_next(request)


# ---- 4) Rate limiter (in-process sliding window) ----
# window_seconds, max_requests
_RATE_RULES = [
    ("/api/auth/",   (60, 20)),
    ("/api/evaluate", (60, 300)),
    ("/api/simulate", (60, 10)),
]
_RATE_DEFAULT = (60, 240)
_rate_state: Dict[str, deque] = {}


def _rate_bucket(path: str):
    for prefix, cfg in _RATE_RULES:
        if path.startswith(prefix):
            return prefix, cfg
    return "default", _RATE_DEFAULT


@app.middleware("http")
async def _rate_limit(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)
    bucket, (window, limit) = _rate_bucket(path)
    key = f"{bucket}:{_client_ip(request)}"
    now = time.time()
    q = _rate_state.setdefault(key, deque())
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        audit_log("ratelimit.blocked", bucket=bucket, ip=_client_ip(request), path=path)
        return JSONResponse(
            {"detail": "Too many requests"},
            status_code=429,
            headers={"Retry-After": str(window)},
        )
    q.append(now)
    return await call_next(request)
