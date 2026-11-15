// Simulation worker (spec 18.1): resolves commands off the main thread. It has no DOM or storage access.
import { CONTENT } from './contentRaw';
import { createCareer } from './core/world';
import { execute, Command } from './core/sim';
import { ensureGoals } from './core/goals';
import type { Setup, State } from './core/types';
export type WorkerReq = { n: number; kind: 'create'; setup: Setup; nowUtc: string } | { n: number; kind: 'exec'; state: State; cmd: Command };
self.onmessage = (e: MessageEvent<WorkerReq>) => {
  const m = e.data;
  try {
    const state = m.kind === 'create' ? createCareer(m.setup, CONTENT, m.nowUtc) : execute(m.state, CONTENT, m.cmd);
    if (m.kind === 'create') ensureGoals(state);
    (self as any).postMessage({ n: m.n, ok: true, state });
  } catch (err: any) { (self as any).postMessage({ n: m.n, ok: false, error: String(err?.message ?? err) }); }
};
