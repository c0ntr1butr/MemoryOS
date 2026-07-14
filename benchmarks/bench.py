"""MemoryGate latency & throughput benchmark.

Runs a burst of concurrent /api/evaluate calls, measures p50/p95/p99 latency
and sustained throughput. Reports as markdown for docs/README.

Usage:
    python benchmarks/bench.py                  # local (http://localhost:8001)
    MEMORYGATE_URL=... TOKEN=... python benchmarks/bench.py  --n 2000 --c 32
"""
from __future__ import annotations

import argparse
import asyncio
import os
import statistics
import time
from typing import List

import httpx

DEFAULTS = dict(
    url=os.environ.get("MEMORYGATE_URL", "http://localhost:8001"),
    token=os.environ.get("TOKEN"),
    n=1000,
    concurrency=16,
    resource="customers.read",
    action="read",
)


async def _one(client: httpx.AsyncClient, base: str, agent_id: str, args) -> float:
    t0 = time.perf_counter()
    r = await client.post(
        f"{base}/api/evaluate",
        json={
            "agent_id": agent_id,
            "resource": args.resource,
            "action": args.action,
            "purpose": "benchmark",
            "payload": {"n": 1},
        },
    )
    r.raise_for_status()
    return (time.perf_counter() - t0) * 1000  # ms


async def _login(base: str) -> str:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{base}/api/auth/login", json={
            "email": "admin@sentinel.ai", "password": "Admin@2026"})
        r.raise_for_status()
        return r.json()["token"]


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULTS["url"])
    ap.add_argument("--token", default=DEFAULTS["token"])
    ap.add_argument("--n", type=int, default=DEFAULTS["n"])
    ap.add_argument("--c", "--concurrency", type=int, dest="concurrency",
                    default=DEFAULTS["concurrency"])
    ap.add_argument("--resource", default=DEFAULTS["resource"])
    ap.add_argument("--action", default=DEFAULTS["action"])
    args = ap.parse_args()

    token = args.token or await _login(args.url)
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(headers=headers, timeout=15.0) as boot:
        r = await boot.get(f"{args.url}/api/agents")
        r.raise_for_status()
        agent_id = r.json()[0]["id"]

    print(f"→ {args.url}  agent={agent_id}  n={args.n}  concurrency={args.concurrency}")
    latencies: List[float] = []

    sem = asyncio.Semaphore(args.concurrency)
    async with httpx.AsyncClient(headers=headers, timeout=15.0, http2=False,
                                  limits=httpx.Limits(max_connections=args.concurrency*2)) as client:
        async def bound(i):
            async with sem:
                latencies.append(await _one(client, args.url, agent_id, args))
        t0 = time.perf_counter()
        await asyncio.gather(*[bound(i) for i in range(args.n)])
        wall = time.perf_counter() - t0

    latencies.sort()
    def pct(p): return latencies[int(len(latencies) * p) - 1]
    p50, p95, p99 = pct(0.50), pct(0.95), pct(0.99)
    mean = statistics.mean(latencies)
    rps  = args.n / wall

    print(f"\n{args.n} requests · {args.concurrency} in-flight · {wall:.2f}s wall")
    print(f"  throughput  : {rps:8.1f} req/s")
    print(f"  latency mean: {mean:8.2f} ms")
    print(f"  latency p50 : {p50:8.2f} ms")
    print(f"  latency p95 : {p95:8.2f} ms")
    print(f"  latency p99 : {p99:8.2f} ms")

    # Markdown table for docs
    print()
    print("| metric | value |")
    print("|--------|------:|")
    print(f"| requests            | {args.n} |")
    print(f"| concurrency         | {args.concurrency} |")
    print(f"| wall time (s)       | {wall:.2f} |")
    print(f"| throughput (req/s)  | {rps:.1f} |")
    print(f"| p50 latency (ms)    | {p50:.2f} |")
    print(f"| p95 latency (ms)    | {p95:.2f} |")
    print(f"| p99 latency (ms)    | {p99:.2f} |")


if __name__ == "__main__":
    asyncio.run(main())
