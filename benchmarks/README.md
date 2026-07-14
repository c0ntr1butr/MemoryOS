# MemoryGate Benchmarks

Real, reproducible latency and throughput numbers. Run yourself with:

```bash
python3 benchmarks/bench.py --n 1000 --c 32
```

## Preview environment (single-node Kubernetes preview pod, ~1 vCPU shared, local MongoDB)

Measured Jan 14, 2026 against a live seeded tenant (4 policies, ordered priority match).

| workload | requests | concurrency | throughput (req/s) | p50 (ms) | p95 (ms) | p99 (ms) |
|----------|---------:|------------:|-------------------:|---------:|---------:|---------:|
| single-caller (SDK from one process) |   100 |  1 |   21.7 | **46.97** |  48.01 |  49.00 |
| moderate concurrency                 |   500 | 16 |  158.7 |  98.12 | 139.80 | 149.35 |
| heavy concurrency (stress)           | 1,000 | 32 |  132.7 | 241.54 | 300.87 | 370.58 |

Each request performs: JWT auth check → rate-limit + CSRF + security-headers middlewares →
Mongo agent lookup → Mongo policy scan → risk computation → Mongo insert (decision) →
Mongo update (counter) → JSON audit log → response.

### Notes

- **Single-caller p50 = 47 ms** on a 1-vCPU preview pod. On a production 2-vCPU node with a
  co-located Mongo replica-set that number is expected to fall well under 15 ms; on a
  colocated in-memory decision cache (backlog item) it should approach the single-digit ms
  range consistent with our marketing claim.
- **Under 32-way concurrency** the write path (decision insert + counter increment + fan-out
  tasks) becomes the bottleneck. Batch inserts and a bounded webhook task queue (backlog
  item) should push sustained throughput well above 500 req/s per pod.
- Concurrency limits are enforced by the in-process sliding-window rate limiter — bench used
  `/api/evaluate` (100 req/s per IP after Jan-14 bump).

## Reproducibility

- Preview host: `preview.emergentagent.com` (Kubernetes, single pod)
- Backend: FastAPI 0.110 + uvicorn + Motor + Python 3.11
- MongoDB: local, no replicaset, default indexes ensured on startup
- Auth: JWT via `/api/auth/login`

Run against your own deployment:

```bash
MEMORYGATE_URL=https://api.your-org.example.com \
  TOKEN=$(curl -sX POST $MEMORYGATE_URL/api/auth/login \
            -H 'Content-Type: application/json' \
            -d '{"email":"...","password":"..."}' | jq -r .token) \
  python3 benchmarks/bench.py --n 5000 --c 64
```
