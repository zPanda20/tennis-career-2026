// Application controller: React renders this state and dispatches commands (spec 18.1).
import { useSyncExternalStore } from 'react';
import type { Command } from '../core/sim';
import type { Setup, State } from '../core/types';
import { buildBackup, validateBackup } from '../core/selectors';
import * as db from '../persist/db';

export type Tab = 'career' | 'calendar' | 'player' | 'world' | 'records' | 'settings';
export type Overlay = { kind: 'tourney'; ed: string } | { kind: 'match'; id: string } | { kind: 'player'; id: string } | { kind: 'planner' } | { kind: 'reveal' } | null;
export interface App {
  view: 'boot' | 'library' | 'create' | 'game'; careers: db.CareerMeta[]; S: State | null; tab: Tab; overlay: Overlay; busy: string | null; save: 'saved' | 'saving' | 'error' | 'readonly'; error: string | null; notice: string | null;
  assets: Record<string, string>; labels: Record<string, string>; storageOk: boolean; reduced: boolean;
}
let app: App = { view: 'boot', careers: [], S: null, tab: 'career', overlay: null, busy: null, save: 'saved', error: null, notice: null, assets: {}, labels: {}, storageOk: true, reduced: db.getSetting('reduced', '0') === '1' };
const subs = new Set<() => void>();
export const set = (p: Partial<App>) => { app = { ...app, ...p }; subs.forEach(f => f()); };
export const useApp = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => app);
export const get = () => app;

let worker: Worker | null = null, seq = 0;
const waiting = new Map<number, { res: (s: State) => void; rej: (e: Error) => void }>();
function call(req: any): Promise<State> {
  if (!worker) {
    worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = e => { const w = waiting.get(e.data.n); if (!w) return; waiting.delete(e.data.n); e.data.ok ? w.res(e.data.state) : w.rej(new Error(e.data.error)); };
    worker.onerror = e => { for (const w of waiting.values()) w.rej(new Error(e.message || 'The simulation worker failed.')); waiting.clear(); };
  }
  const n = ++seq; return new Promise((res, rej) => { waiting.set(n, { res, rej }); worker!.postMessage({ ...req, n }); });
}
export async function loadAssets() {
  try {
    const list = await db.allAssets(); const assets: Record<string, string> = {}, labels: Record<string, string> = {};
    for (const url of Object.values(app.assets)) URL.revokeObjectURL(url);
    for (const a of list ?? []) { assets[a.key] = URL.createObjectURL(a.blob); if (a.label) labels[a.key] = a.label; }
    set({ assets, labels });
  } catch { /* image pack is optional */ }
}
export async function boot() {
  const chk = await db.persistCheck();
  let careers: db.CareerMeta[] = [];
  try { careers = await db.listCareers(); } catch { /* handled by storageOk */ }
  set({ view: 'library', careers, storageOk: chk.ok });
  loadAssets();
}
export async function refreshLibrary() { set({ careers: await db.listCareers().catch(() => []) }); }
async function commit(S: State) {
  set({ S, save: 'saving' });
  try { await db.saveCareer(S); set({ save: 'saved' }); }
  catch (e: any) { const stale = String(e.message).startsWith('STALE'); set({ save: stale ? 'readonly' : 'error', error: stale ? 'A newer save of this career exists in another tab. This tab is now read-only.' : `Saving failed: ${e.message}. Your last saved state is intact. Export a backup from Settings, then try again.` }); }
}
export async function newCareer(setup: Setup) {
  set({ busy: 'Creating the 2026 tennis world…' });
  try {
    const S = await call({ kind: 'create', setup, nowUtc: new Date().toISOString() });
    await db.acquireWriter(S.careerId); await commit(S);
    set({ view: 'game', tab: 'career', overlay: null, busy: null }); refreshLibrary();
  } catch (e: any) { set({ busy: null, error: e.message }); }
}
export async function openCareer(id: string) {
  set({ busy: 'Opening career…' });
  try {
    let S = await db.loadCareer(id); if (!S) throw new Error('This career could not be found.');
    const writer = S.phase === 'retired' ? false : await db.acquireWriter(id);
    set({ S, view: 'game', tab: S.phase === 'retired' ? 'records' : 'career', overlay: null, busy: null, save: writer ? 'saved' : 'readonly', notice: !writer && S.phase !== 'retired' ? 'This career is open in another tab. You can look around here, but not play.' : null });
    const pend = writer ? await db.getPending(id) : undefined;
    if (pend && pend.baseRev === S.rev) { // resume a prepared command with the same deterministic input (spec 19.2)
      set({ busy: 'Resuming an interrupted simulation…' });
      S = await call({ kind: 'exec', state: S, cmd: pend.cmd }); await commit(S); set({ busy: null, notice: 'An interrupted simulation was resumed. The result is the one that was already committed to happen.' });
    } else if (pend) await db.clearPending(id);
  } catch (e: any) { set({ busy: null, error: e.message }); }
}
type NoId<T> = T extends any ? Omit<T, 'id'> : never;
export async function dispatch(cmd: NoId<Command>, busy = 'Simulating…'): Promise<boolean> {
  const S = app.S; if (!S || app.save === 'readonly' || app.busy) return false;
  const full = { ...cmd, id: `${S.careerId}:${S.rev + 1}:${cmd.type}` } as Command;
  set({ busy, error: null });
  try {
    await db.setPending({ careerId: S.careerId, cmd: full, baseRev: S.rev, preparedUtc: new Date().toISOString() });
    const next = await call({ kind: 'exec', state: S, cmd: full });
    await commit(next); set({ busy: null }); if (next.phase === 'retired') refreshLibrary();
    return true;
  } catch (e: any) { await db.clearPending(S.careerId).catch(() => { }); set({ busy: null, error: e.message }); return false; }
}
export function closeCareer() { const S = app.S; if (S) db.releaseWriter(S.careerId); set({ S: null, view: 'library', overlay: null, notice: null, error: null, save: 'saved' }); refreshLibrary(); }
export async function removeCareer(id: string) { await db.deleteCareer(id); refreshLibrary(); }
export function download(name: string, data: Blob | string, type = 'application/json') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data, url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export async function saveFile(name: string, data: Blob | string, type: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data, w = window as any;
  if (w.showSaveFilePicker) {
    try { const h = await w.showSaveFilePicker({ suggestedName: name }); const s = await h.createWritable(); await s.write(blob); await s.close(); return; }
    catch (e: any) { if (e?.name === 'AbortError') return; /* permission refused or unsupported: fall back to a standard download */ }
  }
  download(name, blob, type);
}
export function exportBackup() { const S = app.S; if (!S) return; saveFile(`${S.players[S.userId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-backup-${S.year}.json`, JSON.stringify(buildBackup(S, new Date().toISOString())), 'application/json'); }
export async function importBackup(file: File) {
  try {
    if (file.size > 60 * 1024 * 1024) throw new Error('This file is too large to be a career backup.');
    const S = validateBackup(JSON.parse(await file.text()));
    const exists = app.careers.find(c => c.id === S.careerId);
    if (exists && !confirm(`A career for ${exists.name} already exists on this device. Replace it with the backup?`)) return;
    S.ledger.push({ seq: S.seq++, wk: S.wk, date: new Date().toISOString().slice(0, 10), type: 'BackupRestored', cmd: 'import' }); S.rev++;
    await db.saveCareer(S, { force: true }); await refreshLibrary(); set({ notice: `Backup restored for ${S.players[S.userId].name}.` });
  } catch (e: any) { set({ error: e.message?.includes('JSON') ? 'This file could not be read as a career backup.' : e.message }); }
}
