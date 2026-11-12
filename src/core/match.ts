// Deterministic singles match engine (spec 9). One point model serves previews, background matches and the user's matches.
// It models serve-aware point outcomes; it does not simulate ball trajectories. Statistics come from the simulated points.
import { ANCHOR, COND, P_CLAMP, PER_POINT, RALLY, HEALTH } from './balance';
import { Rng, clamp } from './rng';
import type { MatchResult, MatchStats, Player, Surface, Tour } from './types';

export interface Side { serve: number; ret: number; rally: number; comp: number; end: number; cond: number; strain: number }
export interface Rules { surface: Surface; bestOf: 3 | 5; tb10: boolean; tour: Tour }

export function sideOf(p: Player, surface: Surface, rested = false): Side {
  const w = RALLY[surface], a = p.ab;
  let netW = w.net, fhW = w.fh, moveW = w.move;
  if (p.style === 'N' || p.style === 'A') { const sh = p.style === 'N' ? 0.05 : 0.02; netW += sh; moveW -= sh; } // style shift, sum stays one
  if (p.style === 'B') { fhW += 0.02; netW = Math.max(0, netW - 0.02); }
  const rally = a.fh * fhW + a.bh * w.bh + a.move * moveW + a.comp * w.comp + a.net * netW;
  let cond = clamp((p.fam[surface] - 50) / 50, -1, 1) * COND.fam;
  if (!rested) {
    cond -= clamp((p.fatigue - 30) / 60, 0, 1) * COND.fatigue;
    cond += clamp((p.conf - 50) / 50, -1, 1) * COND.conf;
    cond += clamp((p.sharp - 60) / 40, -1, 1) * COND.sharp;
  }
  return { serve: a.serve, ret: 0.65 * a.ret + 0.35 * a.move, rally, comp: a.comp, end: a.end, cond, strain: p.strain };
}
export interface PointModel { fs: number; p1: number; p2: number; ace: number; df: number }
export function pointModel(s: Side, r: Side, tour: Tour): PointModel {
  const A = ANCHOR[tour], dS = s.serve - r.ret, dR = s.rally - r.rally, dc = s.cond - r.cond;
  const p1 = clamp(A.p1 + PER_POINT * (0.6 * dS + 0.4 * dR) + dc, P_CLAMP[0], P_CLAMP[1]);
  const p2 = clamp(A.p2 + PER_POINT * (0.3 * dS + 0.7 * dR) + dc, P_CLAMP[0], P_CLAMP[1]);
  const fs = clamp(A.fs + 0.0012 * (s.serve - 60), 0.5, 0.72);
  const ace = clamp((tour === 'atp' ? 0.085 : 0.045) + 0.0025 * dS, 0.01, Math.min(0.3, p1 - 0.05));
  const df = clamp(0.085 - 0.0007 * (s.serve - 50) - 0.0004 * (s.comp - 50), 0.03, 0.15);
  return { fs, p1, p2, ace, df };
}
export const servePoint = (m: PointModel) => m.fs * m.p1 + (1 - m.fs) * m.p2;

// ---- analytic match probability, derived from the same point model (spec 9.2) ----
const gameP = (p: number) => { const q = 1 - p; return p ** 4 * (15 - 4 * p - (10 * p * p) / (1 - 2 * p * q)); };
function tbP(pa: number, pb: number, to: number): number {
  // probability A wins a tiebreak to `to`; A serves first, then two each. pa = A's serve-point prob, pb = B's.
  const memo = new Map<number, number>();
  const f = (a: number, b: number): number => {
    if (a >= to && a - b >= 2) return 1;
    if (b >= to && b - a >= 2) return 0;
    if (a >= to - 1 && b >= to - 1 && a === b) { // deuce-like: closed form over two points
      const w = pa * (1 - pb), l = (1 - pa) * pb; return w / (w + l);
    }
    const k = a * 64 + b; const c = memo.get(k); if (c !== undefined) return c;
    const n = a + b, aServes = n === 0 || Math.floor((n + 1) / 2) % 2 === 0;
    const p = aServes ? pa : 1 - pb;
    const v = p * f(a + 1, b) + (1 - p) * f(a, b + 1); memo.set(k, v); return v;
  };
  return f(0, 0);
}
function setP(pa: number, pb: number): number {
  const ga = gameP(pa), gb = gameP(pb), tb = tbP(pa, pb, 7);
  const memo = new Map<number, number>();
  const f = (a: number, b: number): number => {
    if (a === 6 && b === 6) return tb;
    if (a >= 6 && a - b >= 2) return 1; if (b >= 6 && b - a >= 2) return 0;
    if (a === 7) return 1; if (b === 7) return 0;
    const k = a * 16 + b; const c = memo.get(k); if (c !== undefined) return c;
    const p = (a + b) % 2 === 0 ? ga : 1 - gb;
    const v = p * f(a + 1, b) + (1 - p) * f(a, b + 1); memo.set(k, v); return v;
  };
  return f(0, 0);
}
const cache = new Map<number, number>();
export function matchProb(pa: number, pb: number, bestOf: 3 | 5): number {
  const key = Math.round(pa * 400) * 1000 + Math.round(pb * 400) + (bestOf === 5 ? 5e6 : 0);
  const c = cache.get(key); if (c !== undefined) return c;
  const s = setP(pa, pb), q = 1 - s;
  const v = bestOf === 3 ? s * s * (1 + 2 * q) : s ** 3 * (1 + 3 * q + 6 * q * q);
  if (cache.size > 200000) cache.clear();
  cache.set(key, v); return v;
}
/** Pre-match expected win probability for a. rested=true gives the development estimate (spec 6.1). */
export function expectedWin(a: Player, b: Player, rules: Rules, rested = false): number {
  const sa = sideOf(a, rules.surface, rested), sb = sideOf(b, rules.surface, rested);
  return matchProb(servePoint(pointModel(sa, sb, rules.tour)), servePoint(pointModel(sb, sa, rules.tour)), rules.bestOf);
}

const blank = (): MatchStats => ({ aces: 0, df: 0, fsIn: 0, fsTot: 0, fsWon: 0, ssWon: 0, ssTot: 0, bpWon: 0, bpTot: 0, pts: 0, retWon: 0 });

export function simulateMatch(a: Player, b: Player, rules: Rules, seed: string, detail = false): MatchResult {
  const r = new Rng(seed);
  const sides = [sideOf(a, rules.surface), sideOf(b, rules.surface)];
  // composure changes variance: each player draws a small form shift for the day
  const form = [r.normal(0, 0.014 - sides[0].comp * 0.00009), r.normal(0, 0.014 - sides[1].comp * 0.00009)];
  const pm = [pointModel(sides[0], sides[1], rules.tour), pointModel(sides[1], sides[0], rules.tour)];
  const press = (sides[0].comp - sides[1].comp) * 0.0005; // pressure response on big points
  const st: [MatchStats, MatchStats] = [blank(), blank()];
  const sets: [number, number, number?, number?][] = [];
  const setsWon = [0, 0], need = rules.bestOf === 3 ? 2 : 3;
  let server = r.chance(0.5) ? 0 : 1, total = 0;
  const turning: string[] = [];
  // rare acute incident decided up front so the same exposure is never rolled twice
  let retireAt = -1, retiredSide: 0 | 1 | undefined;
  for (const i of [0, 1] as const) if (retireAt < 0 && r.chance(HEALTH.acute * (1 + sides[i].strain / 60))) { retireAt = r.int(20, 110); retiredSide = i; }

  const point = (srv: number, big: boolean): number => {
    const m = pm[srv], adj = form[srv] - form[1 - srv] + (big ? (srv === 0 ? press : -press) : 0)
      - clamp((total - 150 - sides[srv].end) / 2500, 0, 0.03) + clamp((total - 150 - sides[1 - srv].end) / 2500, 0, 0.03);
    const s = st[srv]; total++;
    let won: boolean;
    if (r.chance(m.fs)) {
      s.fsIn++; s.fsTot++;
      if (r.chance(m.ace)) { s.aces++; won = true; }
      else won = r.chance(clamp((m.p1 + adj - m.ace) / (1 - m.ace), 0.05, 0.97));
      if (won) s.fsWon++;
    } else {
      s.fsTot++; s.ssTot++;
      if (r.chance(m.df)) { s.df++; won = false; }
      else won = r.chance(clamp((m.p2 + adj) / (1 - m.df), 0.05, 0.97));
      if (won) s.ssWon++;
    }
    if (won) st[srv].pts++; else { st[1 - srv].pts++; st[1 - srv].retWon++; }
    return won ? srv : 1 - srv;
  };
  const game = (srv: number): number => {
    let p = [0, 0];
    for (;;) {
      const rcv = 1 - srv, bp = p[rcv] >= 3 && p[rcv] > p[srv];
      if (bp) st[rcv].bpTot++;
      const w = point(srv, bp);
      if (bp && w === rcv) st[rcv].bpWon++;
      p[w]++;
      if (p[w] >= 4 && p[w] - p[1 - w] >= 2) return w;
      if (retireAt >= 0 && total >= retireAt) return -1;
    }
  };
  const tiebreak = (first: number, to: number): [number, number, number] => {
    const p = [0, 0]; let srv = first, n = 0;
    for (;;) {
      const w = point(srv, true); p[w]++; n++;
      if (p[w] >= to && p[w] - p[1 - w] >= 2) return [w, p[0], p[1]];
      if (n % 2 === 1) srv = 1 - srv;
      if (retireAt >= 0 && total >= retireAt) return [-1, p[0], p[1]];
    }
  };
  let retired = false;
  outer: while (setsWon[0] < need && setsWon[1] < need) {
    const g = [0, 0], deciding = setsWon[0] === need - 1 && setsWon[1] === need - 1;
    const setFirst = server;
    for (;;) {
      if (g[0] === 6 && g[1] === 6) {
        const [w, x, y] = tiebreak(server, deciding && rules.tb10 ? 10 : 7);
        if (w < 0) { sets.push([g[0], g[1]]); retired = true; break outer; }
        g[w]++; sets.push([g[0], g[1], x, y]); setsWon[w]++;
        server = 1 - setFirst; // player who received first in the tiebreak set serves first in the next set
        if (detail) turning.push(`Set ${sets.length} tiebreak ${Math.max(x, y)}-${Math.min(x, y)}`);
        break;
      }
      const w = game(server);
      if (w < 0) { sets.push([g[0], g[1]]); retired = true; break outer; }
      if (detail && w !== server && g[0] + g[1] >= 6 && Math.abs(g[0] - g[1]) <= 1) turning.push(`Break at ${g[0]}-${g[1]} in set ${sets.length + 1}`);
      g[w]++; server = 1 - server;
      if ((g[0] >= 6 || g[1] >= 6) && Math.abs(g[0] - g[1]) >= 2) { sets.push([g[0], g[1]]); setsWon[g[0] > g[1] ? 0 : 1]++; break; }
    }
  }
  const winner: 0 | 1 = retired ? ((1 - retiredSide!) as 0 | 1) : setsWon[0] > setsWon[1] ? 0 : 1;
  const fmt = (s: [number, number, number?, number?], w: number) => {
    const [x, y] = w === 0 ? [s[0], s[1]] : [s[1], s[0]];
    return s[2] !== undefined ? `${x}-${y}(${Math.min(s[2]!, s[3]!)})` : `${x}-${y}`;
  };
  const score = sets.map(s => fmt(s, winner)).join(' ') + (retired ? ' ret.' : '');
  const games = sets.reduce((t, s) => t + s[0] + s[1], 0), wg = sets.reduce((t, s) => t + (winner === 0 ? s[0] : s[1]), 0);
  const tbs = sets.filter(s => s[2] !== undefined).length;
  const minutes = Math.round(total * (rules.surface === 'clay' ? 0.78 : rules.surface === 'grass' ? 0.66 : 0.72));
  const load = (i: number) => clamp(total * 0.068 * (1.3 - sides[i].end / 180) * (rules.surface === 'clay' ? 1.08 : 1), 2, 34);
  // closeness: 0 one-sided … 1 sustained contest (used for competitive exposure, spec 6.1)
  const share = games ? 1 - wg / games : 0.5;
  const closeness = retired ? 0.3 : clamp((share - 0.22) / 0.26, 0, 1) * 0.75 + (sets.length > need ? 0.2 : 0) + Math.min(0.1, tbs * 0.05);
  return { winner, sets, score, stats: st, points: total, minutes, fatigue: [load(0), load(1)], cls: retired ? 'ret' : 'played', retiredSide: retired ? retiredSide : undefined, closeness: clamp(closeness, 0, 1), turning: turning.slice(-3) };
}
