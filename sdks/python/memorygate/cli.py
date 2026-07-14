"""memorygate CLI — currently exposes the MCP proxy runner.

    memorygate mcp-proxy --upstream https://mcp.example.com \
        --api-key mg_... --agent-id agent_mcp --listen 0.0.0.0:7443
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from typing import List, Optional

from .client import Client


def _mcp_proxy(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(prog="memorygate mcp-proxy")
    ap.add_argument("--upstream", required=True, help="Real MCP endpoint URL")
    ap.add_argument("--api-key", required=True, help="MemoryGate API key (mg_...)")
    ap.add_argument("--agent-id", required=True, help="Agent id registered in MemoryGate")
    ap.add_argument("--base-url", default="https://api.memorygate.dev")
    ap.add_argument("--listen", default="0.0.0.0:7443")
    args = ap.parse_args(argv)

    from .middleware.mcp import MCPProxy
    host, port = args.listen.rsplit(":", 1)
    mg = Client(api_key=args.api_key, base_url=args.base_url)
    proxy = MCPProxy(mg=mg, agent_id=args.agent_id, upstream=args.upstream)
    print(f"memorygate mcp-proxy → {args.upstream}  |  listening on {host}:{port}", flush=True)
    asyncio.run(proxy.serve(host=host, port=int(port)))
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] in ("-h", "--help"):
        print("Usage: memorygate <command>\n\nCommands:\n  mcp-proxy    Governance proxy for MCP servers")
        return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == "mcp-proxy":
        return _mcp_proxy(rest)
    print(f"Unknown command: {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
