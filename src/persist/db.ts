// Persistence layer (spec 19): IndexedDB for careers, pending commands and the private image pack.
// Local storage only holds small settings and the last-opened-career pointer.
import type { State } from '../core/types';

const DB = 'tennis-career-2026', VER = 1;
export interface CareerMeta { id: string; name: string; tour: string; status: 'active' | 'retired'; savedUtc: string; year: number; rank: number; rev: number; country: string }
export interface PendingCmd { careerId: string; cmd: any; baseRev: number; preparedUtc: string }

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const d = r.result; for (const s of ['careers', 'meta', 'pending', 'assets']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error ?? new Error('Storage is unavailable in this browser.'));
  });
}
function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return open().then(d => new Promise<T>((res, rej) => {
    const t = d.transaction(stores, mode); let out: any;
    const r = fn(t); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => { d.close(); res(out); }; t.onerror = t.onabort = () => { d.close(); rej(t.error ?? new Error('The save could not be completed.')); };
  }));
}
export const metaOf = (S: State): CareerMeta => ({ id: S.careerId, name: S.players[S.userId].name, tour: S.tour, status: S.phase === 'retired' ? 'retired' : 'active', savedUtc: new Date().toISOString(), year: S.phase === 'retired' ? S.retire!.year : S.year, rank: S.rank[S.userId] ?? 0, rev: S.rev, country: S.players[S.userId].country });

export async function listCareers(): Promise<CareerMeta[]> {
  const all = await tx<CareerMeta[]>(['meta'], 'readonly', t => t.objectStore('meta').getAll());
  return (all ?? []).sort((a, b) => (a.savedUtc < b.savedUtc ? 1 : -1));
}
export const loadCareer = (id: string) => tx<State | undefined>(['careers'], 'readonly', t => t.objectStore('careers').get(id));
/** Atomic commit of state + summary row, clearing the pending command. Rejects a stale tab (spec 19.4). */
export async function saveCareer(S: State, opts: { force?: boolean } = {}): Promise<CareerMeta> {
  const existing = await tx<CareerMeta | undefined>(['meta'], 'readonly', t => t.objectStore('meta').get(S.careerId));
  if (existing && existing.rev > S.rev && !opts.force) throw new Error('STALE: a newer save of this career exists (probably from another tab). This tab is now read-only.');
  const meta = metaOf(S);
  await tx(['careers', 'meta', 'pending'], 'readwrite', t => { t.objectStore('careers').put(S, S.careerId); t.objectStore('meta').put(meta, S.careerId); t.objectStore('pending').delete(S.careerId); });
  try { localStorage.setItem('tc26:last', S.careerId); } catch { /* optional */ }
  return meta;
}
export const deleteCareer = (id: string) => tx(['careers', 'meta', 'pending'], 'readwrite', t => { t.objectStore('careers').delete(id); t.objectStore('meta').delete(id); t.objectStore('pending').delete(id); });
export const setPending = (p: PendingCmd) => tx(['pending'], 'readwrite', t => { t.objectStore('pending').put(p, p.careerId); });
export const getPending = (id: string) => tx<PendingCmd | undefined>(['pending'], 'readonly', t => t.objectStore('pending').get(id));
export const clearPending = (id: string) => tx(['pending'], 'readwrite', t => { t.objectStore('pending').delete(id); });

export interface Asset { key: string; blob: Blob; label?: string }
export const putAssets = (list: Asset[]) => tx(['assets'], 'readwrite', t => { const s = t.objectStore('assets'); s.clear(); for (const a of list) s.put(a, a.key); });
export const allAssets = () => tx<Asset[]>(['assets'], 'readonly', t => t.objectStore('assets').getAll());
export const clearAssets = () => tx(['assets'], 'readwrite', t => { t.objectStore('assets').clear(); });

export async function persistCheck(): Promise<{ ok: boolean; persisted: boolean }> {
  try { await open().then(d => d.close()); } catch { return { ok: false, persisted: false }; }
  let persisted = false; try { persisted = (await navigator.storage?.persist?.()) ?? false; } catch { /* optional */ }
  return { ok: true, persisted };
}
/** Single-writer lock per career (Web Locks). Resolves true when this tab owns the career. */
export function acquireWriter(careerId: string): Promise<boolean> {
  if (!navigator.locks) return Promise.resolve(true); // revision checks still protect against stale writes
  return new Promise(resolve => {
    navigator.locks.request(`tc26-career-${careerId}`, { ifAvailable: true }, lock => {
      if (!lock) { resolve(false); return undefined; }
      resolve(true); return new Promise<void>(release => { releasers.set(careerId, release); });
    });
  });
}
const releasers = new Map<string, () => void>();
export function releaseWriter(careerId: string) { releasers.get(careerId)?.(); releasers.delete(careerId); }
export const getSetting = (k: string, d: string) => { try { return localStorage.getItem(`tc26:${k}`) ?? d; } catch { return d; } };
export const setSetting = (k: string, v: string) => { try { localStorage.setItem(`tc26:${k}`, v); } catch { /* optional */ } };
