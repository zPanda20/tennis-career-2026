// Rivals: anyone met three times gets a card. The card weighs how good a rivalry it could be; the player confirms or declines.
import { BAND_VAL } from './balance';
import { cutsFor } from './agent';
import { ageOn, wkDate } from './content';
import { regionOf } from './content';
import { rngOf } from './rng';
import type { Edition, State, Surface, UMatch } from './types';
import { strength } from './world';

export const RIVAL_MEETINGS = 3;
export const playedVs = (S: State, id: string): UMatch[] => S.u.matches.filter(m => m.opp === id && m.cls !== 'wo');

export function rivalCandidates(S: State): string[] {
  const seen = new Map<string, number>();
  for (const m of S.u.matches) if (m.cls !== 'wo') seen.set(m.opp, (seen.get(m.opp) ?? 0) + 1);
  const no = new Set(S.u.rivalNo ?? []), yes = new Set(S.u.rivals);
  return [...seen].filter(([id, n]) => n >= RIVAL_MEETINGS && !no.has(id) && !yes.has(id) && S.players[id] && !S.players[id].retired).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
const favSurface = (f: Record<Surface, number>): Surface => (Object.entries(f) as [Surface, number][]).sort((a, b) => b[1] - a[1])[0][0];

export interface RivalFit { score: number; verdict: string; potential: string; age: string; rank: string; record: string; future: string; facts: { k: string; v: string; good: boolean }[]; w: number; l: number }
export function rivalFit(S: State, id: string): RivalFit {
  const me = S.players[S.userId], p = S.players[id], d = wkDate(S.wk), ms = playedVs(S, id);
  const w = ms.filter(m => m.won).length, l = ms.length - w;
  // potential is a scouting view, so it carries a little deterministic uncertainty like the coach's own report
  const fuzz = rngOf(S.seed, 'rivalview', id, S.year).normal(0, 1.2);
  const dp = strength(p.ceil) - strength(me.ceil) + fuzz;
  const ageMe = ageOn(me.born, d), ageP = ageOn(p.born, d), dAge = ageP - ageMe;
  const rMe = S.rank[S.userId] ?? 1500, rP = S.rank[id] ?? 1500, ratio = Math.max(rMe, rP) / Math.max(1, Math.min(rMe, rP));
  const sPot = 35 * Math.exp(-((dp / 6) ** 2));
  const sAge = Math.abs(dAge) <= 2 ? 20 : Math.abs(dAge) <= 4 ? 13 : Math.abs(dAge) <= 7 ? 5 : 0;
  const sRank = ratio <= 1.5 ? 15 : ratio <= 3 ? 9 : ratio <= 6 ? 4 : 0;
  const sRec = (Math.abs(w - l) <= 1 ? 13 : Math.abs(w - l) <= 2 ? 7 : 0) + (ms.length >= 6 ? 7 : ms.length >= 4 ? 4 : 0);
  const sameSurf = favSurface(p.fam) === favSurface(me.fam), sameReg = regionOf(p.country) === regionOf(me.country);
  const score = Math.round(Math.min(100, sPot + sAge + sRank + sRec + (sameSurf ? 5 : 0) + (sameReg ? 5 : 0) - (ageP >= 32 ? 15 : ageP >= 30 ? 6 : 0)));
  const potential = Math.abs(dp) <= 2.5 ? 'Similar potential to yours' : dp > 6 ? 'Much higher ceiling than yours' : dp > 0 ? 'A somewhat higher ceiling' : dp < -6 ? 'A much lower ceiling than yours' : 'A somewhat lower ceiling';
  const age = dAge === 0 ? 'Same age as you' : `${Math.abs(dAge)} year${Math.abs(dAge) === 1 ? '' : 's'} ${dAge > 0 ? 'older' : 'younger'} (${ageP})`;
  const rank = `No. ${rP} vs your No. ${rMe}`;
  const yearsLeft = Math.min(p.declineAge + 3 - ageP, 33 - ageMe), close = ratio <= 3 && Math.abs(dp) <= 5;
  const future = yearsLeft >= 6 && close ? 'Many chances to meet in the coming years' : yearsLeft >= 3 && (close || ratio <= 5) ? 'Some chances to meet again' : 'Few chances to meet again';
  const verdict = score >= 70 ? 'A natural rival' : score >= 50 ? 'A strong rivalry candidate' : score >= 32 ? 'An occasional foe' : 'More a familiar face than a rival';
  const record = `${w}–${l} in ${ms.length} meetings`;
  const facts = [
    { k: 'Potential', v: potential, good: Math.abs(dp) <= 4 },
    { k: 'Age', v: age, good: Math.abs(dAge) <= 4 && ageP < 30 },
    { k: 'Ranking', v: rank, good: ratio <= 3 },
    { k: 'Head to head', v: record, good: Math.abs(w - l) <= 2 },
    { k: 'Best surface', v: sameSurf ? `Both strongest on ${favSurface(me.fam)}` : `Theirs is ${favSurface(p.fam)}`, good: sameSurf },
    { k: 'Region', v: sameReg ? 'You play the same regional events' : 'Different home region', good: sameReg },
    { k: 'Future meetings', v: future, good: future.startsWith('Many') },
  ];
  return { score, verdict, potential, age, rank, record, future, facts, w, l };
}

/** Is this rival likely to be in this event? Uses their commitments when known, otherwise their ranking and usual level of event. */
export function rivalIn(S: State, ed: Edition, id: string): 'entered' | 'likely' | 'possible' | null {
  const p = S.players[id]; if (!p || p.retired || p.injuredUntil > ed.startWk) return null;
  if (p.commit[ed.startWk]) return p.commit[ed.startWk] === ed.id ? 'entered' : null;
  const r = S.rank[id] ?? 1500, [cut, qcut] = cutsFor(S, ed);
  if (r > Math.max(cut * 1.05, ed.band === 'GS' ? qcut : 0)) return null;
  if (ed.band === 'GS' || ed.band === 'T1000') return 'likely';
  const min = r <= 20 ? 250 : r <= 70 ? 100 : r <= 180 ? 50 : 15;
  return BAND_VAL[ed.band] >= min ? 'possible' : null;
}
export function rivalsIn(S: State, ed: Edition) { return S.u.rivals.map(id => ({ id, how: rivalIn(S, ed, id) })).filter(x => x.how) as { id: string; how: 'entered' | 'likely' | 'possible' }[]; }
