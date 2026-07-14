"""MCP (Model Context Protocol) proxy.

Any MCP client can point at this proxy instead of the real MCP server. Every
``tools/call`` request is evaluated by MemoryGate. Blocked or escalated calls
never touch the upstream server.

Usage as a Python coroutine (embed in your own server)::

    from memorygate import Client
    from memorygate.middleware.mcp import MCPProxy

    mg = Client(api_key="mg_...")
    proxy = MCPProxy(mg=mg, agent_id="agent_mcp_gateway",
                     upstream="https://mcp.internal.example.com")
    await proxy.serve(host="0.0.0.0", port=7443)

Or as a CLI (see ``memorygate.cli``)::

    memorygate mcp-proxy --upstream https://mcp.internal.example.com \
        --api-key mg_... --agent-id agent_mcp_gateway --listen 0.0.0.0:7443
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

import httpx

from ..client import Client
from ..exceptions import PermissionDenied, HumanApprovalRequired

log = logging.getLogger("memorygate.mcp")


class MCPProxy:
    """A minimal streaming JSON-RPC proxy that governs every MCP tool call.

    This class doesn't bind to a server framework — call :meth:`handle` from
    your ASGI / FastAPI / aiohttp app for each incoming request. A convenience
    :meth:`serve` binds a standalone Starlette server if `starlette` is
    installed.
    """

    def __init__(self, *, mg: Client, agent_id: str, upstream: str,
                 timeout: float = 10.0):
        self._mg = mg
        self._agent_id = agent_id
        self._upstream = upstream.rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)

    async def handle(self, request_body: bytes,
                     headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Governance-aware forward of a JSON-RPC MCP request."""
        try:
            msg = json.loads(request_body)
        except json.JSONDecodeError:
            return {"jsonrpc": "2.0", "id": None,
                    "error": {"code": -32700, "message": "Parse error"}}
        method = msg.get("method", "")
        params = msg.get("params") or {}
        if method == "tools/call":
            tool_name = params.get("name", "unknown")
            arguments = params.get("arguments") or {}
            d = self._mg.evaluate(
                agent_id=self._agent_id,
                resource=f"mcp.tool.{tool_name}",
                action="execute",
                purpose=str(arguments.get("purpose") or ""),
                payload=arguments,
            )
            if d.decision == "block":
                return {"jsonrpc": "2.0", "id": msg.get("id"),
                        "error": {"code": -32000, "message": d.reason,
                                  "data": {"policy": d.policy_name,
                                           "decision_id": d.id}}}
            if d.decision == "escalate":
                return {"jsonrpc": "2.0", "id": msg.get("id"),
                        "error": {"code": -32001,
                                  "message": "Human approval required",
                                  "data": {"decision_id": d.id, "reason": d.reason}}}
            if d.decision == "modify":
                params["arguments"] = {k: v for k, v in (d.modified_payload or {}).items()
                                       if k != "_governance"}
                msg["params"] = params
                request_body = json.dumps(msg).encode()
        # Forward to upstream MCP server.
        r = await self._client.post(self._upstream, content=request_body,
                                    headers={"Content-Type": "application/json",
                                             **(headers or {})})
        try:
            return r.json()
        except json.JSONDecodeError:
            return {"jsonrpc": "2.0", "id": msg.get("id"),
                    "error": {"code": -32603, "message": "Upstream returned non-JSON",
                              "data": {"status": r.status_code}}}

    async def serve(self, host: str = "0.0.0.0", port: int = 7443) -> None:  # pragma: no cover
        """Standalone Starlette server. Requires `starlette` and `uvicorn`."""
        try:
            from starlette.applications import Starlette
            from starlette.responses import JSONResponse
            from starlette.routing import Route
            from starlette.requests import Request
            import uvicorn
        except Exception as e:
            raise RuntimeError("pip install starlette uvicorn to use MCPProxy.serve") from e

        async def endpoint(req: Request):
            body = await req.body()
            headers = {k: v for k, v in req.headers.items()
                       if k.lower() in ("authorization", "mcp-session-id")}
            data = await self.handle(body, headers=headers)
            return JSONResponse(data)

        app = Starlette(routes=[Route("/mcp", endpoint, methods=["POST"])])
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        await uvicorn.Server(config).serve()

    async def close(self) -> None:
        await self._client.aclose()


__all__ = ["MCPProxy"]
