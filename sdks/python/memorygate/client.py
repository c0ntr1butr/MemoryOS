"""Synchronous and asynchronous clients for the MemoryGate runtime."""
from __future__ import annotations

import os
import logging
from typing import Any, Dict, List, Optional

import httpx

from .exceptions import GovernanceError, NetworkError, UnknownAgent
from .models import Decision

log = logging.getLogger("memorygate")

_DEFAULT_BASE_URL = os.environ.get("MEMORYGATE_URL", "https://api.memorygate.dev")
_DEFAULT_TIMEOUT = 5.0


def _headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "memorygate-python/0.1.0",
    }


def _handle(r: httpx.Response) -> Dict[str, Any]:
    if r.status_code == 404:
        raise UnknownAgent(r.text)
    if r.status_code >= 400:
        raise GovernanceError(f"HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


class Client:
    """Synchronous client. Prefer :class:`AsyncClient` in async codebases.

    Configure once at process start:

        mg = Client(api_key="mg_...", base_url="https://api.memorygate.dev")

    Then call :meth:`evaluate` around every agent action.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
        default_agent_id: Optional[str] = None,
    ):
        api_key = api_key or os.environ.get("MEMORYGATE_API_KEY")
        if not api_key:
            raise GovernanceError("Missing api_key. Pass api_key=... or set MEMORYGATE_API_KEY.")
        self._api_key = api_key
        self._base = base_url.rstrip("/")
        self._client = httpx.Client(timeout=timeout, headers=_headers(api_key))
        self.default_agent_id = default_agent_id

    # ---- public API ------------------------------------------------------
    def evaluate(
        self,
        *,
        resource: str,
        action: str = "read",
        agent_id: Optional[str] = None,
        purpose: str = "",
        payload: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        """Evaluate one agent action. Returns a :class:`Decision`."""
        agent_id = agent_id or self.default_agent_id
        if not agent_id:
            raise GovernanceError("agent_id is required (or set default_agent_id on the client).")
        body = {
            "agent_id": agent_id,
            "resource": resource,
            "action": action,
            "purpose": purpose,
            "payload": payload or {},
            "context": context or {},
        }
        try:
            r = self._client.post(f"{self._base}/api/evaluate", json=body)
        except httpx.HTTPError as e:
            raise NetworkError(str(e)) from e
        return Decision.from_dict(_handle(r))

    def guard(self, resource: str, action: str = "read", **kw) -> Decision:
        """Like :meth:`evaluate`, but raises if the decision is not allow/modify.

        Use in code where an escalation or block should propagate as an exception::

            payload = mg.guard(resource="prod.deploy", action="execute",
                               purpose="release v1.2.3").effective_payload
        """
        d = self.evaluate(resource=resource, action=action, **kw)
        if not d.allowed:
            raise d.to_exception()
        return d

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "Client":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


class AsyncClient:
    """Async version. Same surface as :class:`Client`, awaitable."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
        default_agent_id: Optional[str] = None,
    ):
        api_key = api_key or os.environ.get("MEMORYGATE_API_KEY")
        if not api_key:
            raise GovernanceError("Missing api_key. Pass api_key=... or set MEMORYGATE_API_KEY.")
        self._api_key = api_key
        self._base = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout, headers=_headers(api_key))
        self.default_agent_id = default_agent_id

    async def evaluate(
        self,
        *,
        resource: str,
        action: str = "read",
        agent_id: Optional[str] = None,
        purpose: str = "",
        payload: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        agent_id = agent_id or self.default_agent_id
        if not agent_id:
            raise GovernanceError("agent_id is required (or set default_agent_id on the client).")
        body = {
            "agent_id": agent_id,
            "resource": resource,
            "action": action,
            "purpose": purpose,
            "payload": payload or {},
            "context": context or {},
        }
        try:
            r = await self._client.post(f"{self._base}/api/evaluate", json=body)
        except httpx.HTTPError as e:
            raise NetworkError(str(e)) from e
        return Decision.from_dict(_handle(r))

    async def guard(self, resource: str, action: str = "read", **kw) -> Decision:
        d = await self.evaluate(resource=resource, action=action, **kw)
        if not d.allowed:
            raise d.to_exception()
        return d

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncClient":
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()
