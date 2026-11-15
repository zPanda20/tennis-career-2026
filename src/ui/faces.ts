// Generated faces for fictional players, from a private face pack the user loads into this browser.
// Each fictional player gets a stable face picked from groups weighted by their nation, so the field looks
// regionally plausible. Real players never get a generated face. Nothing is uploaded or bundled with the game.
import { useEffect, useState } from 'react';
import type { Player } from '../core/types';
import * as db from '../persist/db';
import { set } from './store';

// Ethnicity groups in the pack (from its file names): 0 northern/central European, 1 Mediterranean and Hispanic,
// 2 North African and Middle Eastern, 3 African and Caribbean, 4 Japanese-looking East Asian, 5 Southeast Asian,
// 6 Pacific and Filipino, 7 Indigenous American, 9 mixed Black and white, 10 Chinese and Korean-looking East Asian.
type W = Record<number, number>;
const EU_N: W = { 0: 92, 1: 8 }, MED: W = { 1: 78, 0: 22 }, BALK: W = { 0: 70, 1: 30 }, AFR: W = { 3: 92, 9: 8 }, MAGH: W = { 2: 88, 1: 8, 3: 4 }, ME: W = { 2: 90, 1: 10 };
const BY_COUNTRY: Record<string, W> = {
  FRA: { 0: 55, 1: 14, 9: 12, 3: 10, 2: 9 }, GBR: { 0: 76, 9: 8, 3: 7, 1: 5, 2: 4 }, GER: { 0: 82, 1: 6, 2: 6, 9: 6 }, NED: { 0: 80, 9: 8, 2: 6, 3: 6 }, BEL: { 0: 78, 1: 6, 2: 8, 9: 8 },
  SUI: { 0: 82, 1: 12, 9: 6 }, SWE: { 0: 86, 2: 8, 9: 6 }, NOR: { 0: 92, 9: 8 }, DEN: { 0: 92, 2: 8 }, ESP: MED, ITA: MED, POR: { 1: 70, 0: 18, 9: 12 }, GRE: MED, CYP: MED, MLT: MED, MON: MED, SMR: MED, AND: MED,
  TUR: { 1: 50, 2: 50 }, ALB: BALK, KOS: BALK, MKD: BALK, SRB: BALK, CRO: BALK, BIH: BALK, MNE: BALK, BUL: BALK, ROU: BALK, GEO: { 1: 60, 0: 40 }, ARM: { 1: 55, 2: 45 }, AZE: { 2: 60, 1: 40 },
  ARG: { 1: 70, 0: 22, 7: 8 }, URU: { 1: 70, 0: 25, 9: 5 }, CHI: { 1: 65, 7: 25, 0: 10 }, BRA: { 1: 45, 9: 25, 0: 18, 3: 12 }, COL: { 1: 55, 7: 25, 9: 20 }, PER: { 7: 55, 1: 45 }, ECU: { 7: 55, 1: 45 }, BOL: { 7: 65, 1: 35 }, PAR: { 1: 60, 7: 40 }, VEN: { 1: 60, 9: 25, 7: 15 },
  MEX: { 1: 55, 7: 45 }, GUA: { 7: 65, 1: 35 }, HON: { 1: 55, 7: 45 }, ESA: { 1: 55, 7: 45 }, CRC: { 1: 80, 7: 20 }, PAN: { 1: 50, 9: 30, 7: 20 }, CUB: { 1: 45, 9: 35, 3: 20 }, DOM: { 9: 50, 1: 30, 3: 20 }, PUR: { 1: 50, 9: 35, 3: 15 },
  JAM: { 3: 80, 9: 20 }, TTO: { 3: 55, 9: 45 }, BAH: { 3: 85, 9: 15 }, BAR: { 3: 85, 9: 15 }, HAI: { 3: 95, 9: 5 },
  USA: { 0: 55, 3: 14, 1: 13, 9: 9, 10: 5, 4: 4 }, CAN: { 0: 66, 10: 10, 9: 8, 3: 6, 1: 5, 2: 5 }, AUS: { 0: 78, 10: 8, 1: 6, 9: 4, 6: 4 }, NZL: { 0: 72, 6: 18, 10: 6, 9: 4 }, FIJ: { 6: 100 }, GUM: { 6: 100 }, NCL: { 0: 50, 6: 50 },
  RSA: { 0: 48, 3: 42, 9: 10 }, MAR: MAGH, ALG: MAGH, TUN: MAGH, EGY: { 2: 95, 3: 5 }, ISR: { 0: 40, 1: 32, 2: 28 },
  JPN: { 4: 82, 10: 18 }, KOR: { 10: 75, 4: 25 }, CHN: { 10: 75, 4: 25 }, TPE: { 10: 75, 4: 25 }, HKG: { 10: 75, 4: 25 }, MGL: { 10: 60, 4: 40 },
  THA: { 5: 90, 10: 10 }, VIE: { 5: 85, 10: 15 }, CAM: { 5: 100 }, INA: { 5: 75, 6: 25 }, MAS: { 5: 70, 10: 30 }, SGP: { 10: 55, 5: 45 }, PHI: { 6: 60, 5: 40 },
  KAZ: { 0: 40, 10: 35, 2: 25 }, UZB: { 2: 50, 0: 25, 10: 25 }, KGZ: { 10: 50, 2: 50 }, TJK: { 2: 70, 0: 30 }, TKM: { 2: 70, 0: 30 },
  // the pack has no clear South Asian group; the closest-looking groups stand in
  IND: { 2: 60, 7: 40 }, PAK: { 2: 75, 7: 25 }, SRI: { 7: 55, 2: 45 }, BAN: { 7: 55, 2: 45 }, NEP: { 7: 50, 10: 25, 2: 25 },
};
const BY_REGION: Record<string, W> = { EU: EU_N, AF: AFR, SA: { 1: 70, 7: 20, 9: 10 }, NA: { 0: 55, 1: 20, 3: 15, 9: 10 }, OC: { 0: 80, 6: 20 }, AS: { 10: 50, 5: 30, 4: 20 }, ME };

let groups: Record<string, Record<number, number[]>> | null = null, count = 0;
const cache = new Map<number, string>(), waiting = new Map<number, Promise<string | null>>();
function build(idx: db.FaceIdx) {
  groups = { m: {}, f: {} }; count = idx.length;
  idx.forEach(([g, e], i) => { (groups![g][e] ??= []).push(i); });
}
export async function loadFaces() {
  try { const idx = await db.getFaceIndex(); if (idx?.length) build(idx); else { groups = null; count = 0; } } catch { groups = null; count = 0; }
  set({ faces: count });
}
export const facesLoaded = () => count;

const hash = (s: string, salt = 0) => { let h = 2166136261 ^ salt; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Stable face for a player: nation decides the weighted group, the player id picks the face within it. */
export function faceIdFor(id: string, country: string, region: string | undefined, sex: 'm' | 'f', salt = 0): number {
  if (!groups) return -1;
  const g = groups[sex], w = BY_COUNTRY[country] ?? BY_REGION[region ?? ''] ?? EU_N;
  const opts = Object.entries(w).map(([e, v]) => [Number(e), v] as const).filter(([e]) => g[e]?.length);
  if (!opts.length) return -1;
  const total = opts.reduce((t, [, v]) => t + v, 0); let r = hash(id, 1 + salt) % total, e = opts[0][0];
  for (const [k, v] of opts) { if (r < v) { e = k; break; } r -= v; }
  const list = g[e]; return list[hash(id, 7 + salt) % list.length];
}
export function faceFor(p: Player | undefined, region?: string) {
  if (!p || p.real || p.user || !groups) return -1;
  return faceIdFor(p.id, p.country, region, p.tour === 'wta' ? 'f' : 'm');
}
export function faceUrl(i: number): Promise<string | null> {
  if (cache.has(i)) return Promise.resolve(cache.get(i)!);
  if (!waiting.has(i)) waiting.set(i, db.getFace(i).then(b => { if (!b) return null; const u = URL.createObjectURL(b); cache.set(i, u); return u; }).catch(() => null));
  return waiting.get(i)!;
}
export function useFaceUrl(i: number) {
  const [u, setU] = useState<string | null>(i >= 0 ? cache.get(i) ?? null : null);
  useEffect(() => { if (i < 0) { setU(null); return; } let live = true; faceUrl(i).then(x => { if (live) setU(x); }); return () => { live = false; }; }, [i]);
  return u;
}

/** Import a .tcfaces file: an 8-byte tag, a JSON header and the WebP images back to back. */
export async function importFaces(file: File, progress?: (n: number, of: number) => void): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (new TextDecoder().decode(head.slice(0, 8)) !== 'TCFACES1') return 'That file is not a Tennis Career face pack.';
  const len = new DataView(head.buffer).getUint32(8, true);
  const meta = JSON.parse(new TextDecoder().decode(await file.slice(12, 12 + len).arrayBuffer()));
  if (meta.format !== 'tennis-career-face-pack') return 'That file is not a Tennis Career face pack.';
  const faces: [string, number, number, number, number][] = meta.faces, base = 12 + len;
  await db.clearFaces(); cache.forEach(u => URL.revokeObjectURL(u)); cache.clear(); waiting.clear();
  for (let i = 0; i < faces.length; i += 400) {
    const part = faces.slice(i, i + 400), start = base + part[0][3], end = base + part[part.length - 1][3] + part[part.length - 1][4];
    const buf = await file.slice(start, end).arrayBuffer();
    await db.putFaceBatch(i, part.map(f => new Blob([buf.slice(base + f[3] - start, base + f[3] - start + f[4])], { type: 'image/webp' })));
    progress?.(Math.min(i + 400, faces.length), faces.length);
  }
  await db.putFaceIndex(faces.map(f => [f[0], f[1], f[2]]));
  await loadFaces();
  return `Loaded ${faces.length.toLocaleString('en-US')} faces. Fictional players now have faces.`;
}
export async function removeFaces() { await db.clearFaces(); cache.forEach(u => URL.revokeObjectURL(u)); cache.clear(); waiting.clear(); await loadFaces(); }

/** A face for the user's own player, as a data URL to store with the career. `n` steps through options. */
export async function userFace(country: string, region: string | undefined, sex: 'm' | 'f', n: number): Promise<string | null> {
  const i = faceIdFor(`user-${country}`, country, region, sex, n); if (i < 0) return null;
  const b = await db.getFace(i); if (!b) return null;
  return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsDataURL(b); });
}
