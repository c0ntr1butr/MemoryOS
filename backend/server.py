"""AI Runtime Governance backend."""
from dotenv import load_dotenv
load_dotenv()

import os
import re
import uuid
import jwt
import bcrypt
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Literal
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
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

app = FastAPI(title="AI Runtime Governance API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("governance")


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
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)
    org_name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AgentIn(BaseModel):
    name: str
    description: Optional[str] = ""
    framework: str = "custom"  # openai, langchain, anthropic, custom, ...
    capabilities: List[str] = []
    trust_level: Literal["low", "medium", "high"] = "medium"
    status: Literal["active", "paused", "revoked"] = "active"


class PolicyCondition(BaseModel):
    field: str  # resource, purpose, agent_trust, risk_score, action
    op: Literal["equals", "not_equals", "contains", "gt", "lt", "in", "not_in"]
    value: Any


class PolicyIn(BaseModel):
    name: str
    description: Optional[str] = ""
    priority: int = 100  # lower = higher priority
    subject: str = "*"  # agent id or "*"
    resource_pattern: str = "*"  # e.g. "customers.*" or "billing.write"
    action: str = "*"  # read, write, delete, execute, *
    conditions: List[PolicyCondition] = []
    effect: Literal["allow", "block", "modify", "escalate"] = "allow"
    modify_instructions: Optional[str] = None
    enabled: bool = True


class EvaluateIn(BaseModel):
    agent_id: str
    resource: str
    action: str = "read"
    purpose: Optional[str] = ""
    context: Dict[str, Any] = {}
    payload: Dict[str, Any] = {}


class EscalationDecisionIn(BaseModel):
    approve: bool
    note: Optional[str] = ""


# ------------------------ auth ------------------------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
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
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"user": user_doc, "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["org_id"])
    set_auth_cookie(response, token)
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user, "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
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
    await db.agents.delete_one({"id": agent_id, "org_id": user["org_id"]})
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
    r = await db.policies.update_one(
        {"id": policy_id, "org_id": user["org_id"]}, {"$set": body.model_dump()}
    )
    if not r.matched_count:
        raise HTTPException(404, "Policy not found")
    return await db.policies.find_one({"id": policy_id}, {"_id": 0})


@api.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, user=Depends(get_current_user)):
    await db.policies.delete_one({"id": policy_id, "org_id": user["org_id"]})
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
                        modified_payload: Optional[dict], reason: str) -> dict:
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
    entry.pop("_id", None)
    return entry


async def _evaluate(org_id: str, req: EvaluateIn) -> dict:
    agent = await db.agents.find_one({"id": req.agent_id, "org_id": org_id}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "Unknown agent")
    if agent.get("status") != "active":
        entry = await _log_decision(org_id, agent, req, "block", None, 100, None,
                                    f"Agent status is {agent.get('status')}")
        return entry
    risk = _compute_risk(agent, req)
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
            continue
        if not _match_pattern(p["resource_pattern"], req.resource):
            continue
        if p["action"] != "*" and p["action"] != req.action:
            continue
        if not all(_cond_ok(c, ctx) for c in p.get("conditions", [])):
            continue
        # matched
        modified = None
        reason = f"Matched policy '{p['name']}' (priority {p['priority']})"
        if p["effect"] == "modify":
            modified = {**req.payload, "_governance": {"redacted_fields": ["email", "phone", "ssn"],
                                                        "notes": p.get("modify_instructions") or "PII stripped"}}
        return await _log_decision(org_id, agent, req, p["effect"], p, risk, modified, reason)

    # default: escalate if high risk, else allow
    if risk >= 70:
        return await _log_decision(org_id, agent, req, "escalate", None, risk, None,
                                   f"No policy matched and risk {risk} ≥ 70")
    return await _log_decision(org_id, agent, req, "allow", None, risk, None,
                               "No policy matched, low risk — default allow")


@api.post("/evaluate")
async def evaluate(body: EvaluateIn, user=Depends(get_current_user)):
    return await _evaluate(user["org_id"], body)


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
async def simulate(count: int = 10, user=Depends(get_current_user)):
    org_id = user["org_id"]
    agents = await db.agents.find({"org_id": org_id, "status": "active"}, {"_id": 0}).to_list(50)
    if not agents:
        raise HTTPException(400, "Create at least one active agent first")
    count = max(1, min(50, int(count)))
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
        made.append(await _evaluate(org_id, req))
    return {"created": len(made), "decisions": made}


# ------------------------ health ------------------------
@api.get("/")
async def root():
    return {"ok": True, "service": "AI Runtime Governance"}


# ------------------------ startup ------------------------
async def _ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.orgs.create_index("id", unique=True)
    await db.agents.create_index([("org_id", 1), ("created_at", -1)])
    await db.policies.create_index([("org_id", 1), ("priority", 1)])
    await db.decisions.create_index([("org_id", 1), ("created_at", -1)])
    await db.escalations.create_index([("org_id", 1), ("status", 1)])


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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
