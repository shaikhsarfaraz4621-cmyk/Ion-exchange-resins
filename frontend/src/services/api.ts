/**
 * API Service — Frontend client for the FastAPI backend.
 * Centralizes all backend communication.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8002';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // ─── Health ──────────────────────────────────────────────────
  async health(): Promise<{ status: string; service: string; tick: number }> {
    const res = await fetch(`${this.baseUrl}/`);
    return res.json();
  }

  // ─── State ───────────────────────────────────────────────────
  async getState(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/state`);
    return res.json();
  }

  async updateState(partialState: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/state/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialState),
    });
    return res.json();
  }

  async resetState(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/state/reset`, { method: 'POST' });
    return res.json();
  }

  // ─── Simulation Control ──────────────────────────────────────
  async startSimulation(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/simulate/start`, { method: 'POST' });
    return res.json();
  }

  async stopSimulation(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/simulate/stop`, { method: 'POST' });
    return res.json();
  }

  async mitigate(action: string, nodeId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/simulate/mitigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, nodeId }),
    });
    return res.json();
  }

  async tick(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/simulate/tick`, { method: 'POST' });
    return res.json();
  }

  async triggerDemoScenario(scenario: 'reactor_overheat' | 'feed_starvation' | 'buffer_overflow'): Promise<any> {
    const res = await fetch(`${this.baseUrl}/simulate/demo-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) {
      throw new Error(`Demo scenario error: ${res.status}`);
    }
    return res.json();
  }

  // ─── Inventory ───────────────────────────────────────────────
  async getInventory(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/inventory`);
    return res.json();
  }

  // ─── AI Advisor ──────────────────────────────────────────────
  /**
   * Sends the user message plus an optional clientContext snapshot so the LLM
   * reasons on the same tick/nodes/recipe the operator sees (stays aligned with live sim).
   */
  async chatWithAdvisor(message: string, clientContext?: Record<string, unknown>): Promise<{ reply: string }> {
    const res = await fetch(`${this.baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, clientContext: clientContext ?? null }),
    });
    if (!res.ok) {
      throw new Error(`AI Advisor error: ${res.status}`);
    }
    return res.json();
  }

  async getAiMitigation(alertMessage: string, nodeId?: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/advisor/mitigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertMessage, nodeId }),
    });
    if (!res.ok) {
      throw new Error(`AI Mitigation error: ${res.status}`);
    }
    return res.json();
  }

  // ─── Phase 3: Structured Recommendations ────────────────────
  async getRecommendations(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/recommendations`);
    if (!res.ok) {
      console.warn(`[api] GET /recommendations failed: ${res.status} — restart backend or check VITE_API_URL`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getMitigationLog(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/mitigation-log`);
    if (!res.ok) {
      console.warn(`[api] GET /mitigation-log failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async applyRecommendation(command: string, nodeId: string, condition: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/mitigation-log/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, nodeId, condition }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apply failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  // ─── Phase 4: Run Records ────────────────────────────────────
  async startRun(label: string, scenarioTag?: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/runs/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, scenarioTag: scenarioTag ?? null }),
    });
    if (!res.ok) throw new Error(`startRun failed: ${res.status}`);
    return res.json();
  }

  async endRun(runId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/runs/${runId}/end`, { method: 'POST' });
    if (!res.ok) throw new Error(`endRun failed: ${res.status}`);
    return res.json();
  }

  async abortRun(runId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/runs/${runId}/abort`, { method: 'POST' });
    if (!res.ok) throw new Error(`abortRun failed: ${res.status}`);
    return res.json();
  }

  async listRuns(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/runs`);
    if (!res.ok) { console.warn('[api] GET /runs failed'); return []; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getActiveRun(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/runs/active`);
    if (!res.ok) return { active: false, runId: null };
    return res.json();
  }

  async getRun(runId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/runs/${runId}`);
    if (!res.ok) throw new Error(`getRun failed: ${res.status}`);
    return res.json();
  }

  async compareRuns(runIdA: string, runIdB: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/runs/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runIdA, runIdB }),
    });
    if (!res.ok) throw new Error(`compareRuns failed: ${res.status}`);
    return res.json();
  }

  async deleteRuns(runIds: string[]): Promise<any> {
    const res = await fetch(`${this.baseUrl}/run-actions/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runIds }),
    });
    if (!res.ok) throw new Error(`deleteRuns failed: ${res.status}`);
    return res.json();
  }

  async exportRun(runId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/runs/${runId}/export`);
    if (!res.ok) throw new Error(`exportRun failed: ${res.status}`);
    return res.json();
  }

  // ── Phase 5: Decision Intelligence ──────────────────────────────

  async getRunRanking(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/decisions/run-ranking`);
    if (!res.ok) { console.warn('[api] GET /decisions/run-ranking failed'); return { ranking: [], scoringWeights: {} }; }
    return res.json();
  }

  async optimizeDecisions(payload: {
    goal: Record<string, unknown>;
    constraints: Record<string, unknown>;
    topN?: number;
  }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/decisions/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`optimizeDecisions failed: ${res.status}`);
    return res.json();
  }

  async getRecommendNext(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/decisions/recommend-next`);
    if (!res.ok) { console.warn('[api] GET /decisions/recommend-next failed'); return null; }
    return res.json();
  }

  async explainRun(runId: string, goal?: Record<string, unknown>, constraints?: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/decisions/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, goal: goal ?? {}, constraints: constraints ?? {} }),
    });
    if (!res.ok) throw new Error(`explainRun failed: ${res.status}`);
    return res.json();
  }
}

export const api = new ApiService(API_BASE);
