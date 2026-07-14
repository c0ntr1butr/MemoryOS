/**
 * MemoryGate — runtime governance for autonomous AI agents.
 *
 *   npm install @memorygate/sdk
 *
 *   import { MemoryGate } from "@memorygate/sdk";
 *   const mg = new MemoryGate({ apiKey: process.env.MG_KEY! });
 *   const d  = await mg.evaluate({
 *     agentId:  "agent_crm_copilot",
 *     resource: "customers.read",
 *     action:   "read",
 *     purpose:  "Answer support ticket",
 *     payload:  { customerId: 42 },
 *   });
 *   if (d.allowed) return crm.read(d.effectivePayload);
 *   throw d.toException();
 */

export type Effect = "allow" | "block" | "modify" | "escalate";

export interface TraceStep {
  step: string;
  matched: boolean;
  detail: string;
}

export interface EvaluateInput {
  agentId?: string;
  resource: string;
  action?: string;
  purpose?: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export class GovernanceError extends Error {}
export class NetworkError extends GovernanceError {}
export class PermissionDenied extends GovernanceError {
  constructor(public readonly reason: string,
              public readonly decisionId?: string,
              public readonly policyName?: string) {
    super(reason + (policyName ? ` (policy=${policyName})` : ""));
  }
}
export class HumanApprovalRequired extends GovernanceError {
  constructor(public readonly decisionId: string, public readonly reason = "") {
    super(`Human approval required for decision ${decisionId}: ${reason}`);
  }
}

export class Decision {
  readonly id!: string;
  readonly decision!: Effect;
  readonly agentId!: string;
  readonly agentName!: string;
  readonly resource!: string;
  readonly action!: string;
  readonly riskScore!: number;
  readonly policyId!: string | null;
  readonly policyName!: string;
  readonly reason!: string;
  readonly payload!: Record<string, unknown>;
  readonly modifiedPayload!: Record<string, unknown> | null;
  readonly trace!: TraceStep[];
  readonly raw!: Record<string, unknown>;

  constructor(init: Partial<Decision>) { Object.assign(this, init); }

  get effect(): Effect { return this.decision; }
  get allowed(): boolean { return this.decision === "allow" || this.decision === "modify"; }
  get effectivePayload(): Record<string, unknown> | null {
    if (this.decision === "allow") return this.payload;
    if (this.decision === "modify") return this.modifiedPayload;
    return null;
  }
  toException(): Error {
    if (this.decision === "escalate") return new HumanApprovalRequired(this.id, this.reason);
    return new PermissionDenied(this.reason, this.id, this.policyName);
  }

  static fromRaw(d: any): Decision {
    return new Decision({
      id: d.id, decision: d.decision, agentId: d.agent_id, agentName: d.agent_name,
      resource: d.resource, action: d.action, riskScore: d.risk_score,
      policyId: d.policy_id, policyName: d.policy_name, reason: d.reason,
      payload: d.payload ?? {}, modifiedPayload: d.modified_payload,
      trace: (d.evaluation_trace ?? []) as TraceStep[], raw: d,
    });
  }
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  defaultAgentId?: string;
  fetch?: typeof fetch;   // inject for tests
}

export class MemoryGate {
  private readonly base: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly _fetch: typeof fetch;
  public readonly defaultAgentId?: string;

  constructor(opts: ClientOptions) {
    if (!opts.apiKey) throw new GovernanceError("apiKey is required");
    this.base = (opts.baseUrl ?? "https://api.memorygate.dev").replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.apiKey}`,
      "User-Agent": "memorygate-node/0.1.0",
    };
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this._fetch = opts.fetch ?? fetch;
    this.defaultAgentId = opts.defaultAgentId;
  }

  async evaluate(input: EvaluateInput): Promise<Decision> {
    const agentId = input.agentId ?? this.defaultAgentId;
    if (!agentId) throw new GovernanceError("agentId is required");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this._fetch(`${this.base}/api/evaluate`, {
        method: "POST", headers: this.headers, signal: controller.signal,
        body: JSON.stringify({
          agent_id: agentId, resource: input.resource,
          action: input.action ?? "read", purpose: input.purpose ?? "",
          payload: input.payload ?? {}, context: input.context ?? {},
        }),
      });
    } catch (e: any) {
      throw new NetworkError(String(e?.message ?? e));
    } finally { clearTimeout(t); }
    if (!res.ok) throw new GovernanceError(`HTTP ${res.status}: ${await res.text()}`);
    return Decision.fromRaw(await res.json());
  }

  async guard(input: EvaluateInput): Promise<Decision> {
    const d = await this.evaluate(input);
    if (!d.allowed) throw d.toException();
    return d;
  }
}

export default MemoryGate;
