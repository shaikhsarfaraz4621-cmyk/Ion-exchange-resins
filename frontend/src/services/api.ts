/**
 * API Service — Frontend client for the FastAPI backend.
 * Centralizes all backend communication.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

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
  async chatWithAdvisor(message: string): Promise<{ reply: string }> {
    const res = await fetch(`${this.baseUrl}/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
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
}

export const api = new ApiService(API_BASE);
