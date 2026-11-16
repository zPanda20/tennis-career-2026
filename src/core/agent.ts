// Recommendations: entry estimates, the route cards for each block, the coach's words and the featured life event.
// Nothing here consumes simulation randomness that changes outcomes; everything derives from committed state.
import { BAND_VAL, BLOCKS, CUTS, DEV, ECON, PRIZE, PRIZE_MULT } from './balance';
import { absOf, travelClass, weeksIn } from './content';
import { homeOf } from './lifestyle';
import { expectedWin } from './match';
import { EVENTS, LifeEv } from './narrative';
import { rngOf } from './rng';
import { CH_WC_PER_SEASON, chRule, chWcUsed, eventCost, weeklyGuaranteed } from './tour';
import { ABILITIES, Edition, State } from './types';
import { strength } from './world';

export type EntryStatus = 'accepted' | 'likely qualifying' | 'alternate' | 'unlikely' | 'wildcard' | 'not eligible';
export function cutsFor(S: State, ed: Edition): [number, number] {
  const m = S.memo[ed.series]; if (m && m.cut < 9999) return [m.cut, Math.min(m.qcut, m.cut * 2.2)];
  const b = S.bandMemo[ed.band]; if (b && b.n >= 3) return [b.cut, b.qcut];
  return CUTS[ed.band === 'T1000' && ed.draw < 96 ? 'T1000s' : ed.band];
}
export function estimate(S: State, ed: Edition): EntryStatus {
  const r = S.rank[S.userId], [cut, qcut] = cutsFor(S, ed), me = S.players[S.userId], rule = chRule(S, ed, r);
  if (rule === 'no' || (rule === 'wc' && chWcUsed(S) >= CH_WC_PER_SEASON)) return 'not eligible';
  if (rule === 'wc') return 'wildcard';
  if (r <= cut * 0.95) return 'accepted';
  if (ed.wc && me.country === ed.country && r <= cut * 1.1) return 'likely qualifying';
  if (r <= qcut * 0.92) return 'likely qualifying';
  if (r <= qcut * 1.15) return 'alternate';
  return 'unlikely';
}
export function blockWeeks(S: State, block = S.block): number[] {
  const a = absOf(S.year, BLOCKS[block]), b = block < 3 ? absOf(S.year, BLOCKS[block + 1]) : absOf(S.year, weeksIn(S.year));
  const out: number[] = []; for (let w = Math.max(a, S.wk); w < b; w++) out.push(w); return out;
}
export interface Option { ed: Edition; status: EntryStatus; p: number; C: number; cost: number; tc: number; oppRank: number; ePrize: number }
export function optionFor(S: State, ed: Edition): Option {
  const me = S.players[S.userId], status = estimate(S, ed), [cut] = cutsFor(S, ed);
  const oppRank = Math.max(1, Math.min(S.order.length, Math.round(status === 'accepted' ? Math.min(cut, 9998) * 0.55 : Math.min(cut, 900) * 1.15)));
  const opp = S.players[S.order[oppRank - 1]] ?? me;
  const p = opp === me ? 0.5 : expectedWin(me, opp, { surface: ed.surface, bestOf: 3, tb10: false, tour: S.tour }, true);
  const C = 0.1 + 0.9 * Math.exp(-(((p - 0.5) / DEV.cWidth) ** 2));
  const P = PRIZE[ed.band]; let ePrize = P.floor, reach = 1;
  for (const k of ['R32', 'R16', 'QF', 'SF', 'F', 'W']) { reach *= p; ePrize += reach * Math.max(0, P.champ * (PRIZE_MULT[k] ?? 0) - (k === 'R32' ? P.floor : P.champ * (PRIZE_MULT[{ R16: 'R32', QF: 'R16', SF: 'QF', F: 'SF', W: 'F' }[k] as string] ?? 0))); }
  return { ed, status, p, C, cost: eventCost(S, ed), tc: travelClass(homeOf(S), ed.country), oppRank, ePrize: Math.round(ePrize * (status === 'accepted' ? 1 : 0.45)) };
}
export const eventsInWeek = (S: State, wk: number) => S.cal.filter(e => e.startWk === wk && e.band !== 'F' && !e.cancelled && !e.done && e.entryWk >= S.wk);

export interface Route { key: 'development' | 'breakthrough' | 'recovery' | 'earnings'; label: string; intent: string; weeks: Record<number, string>; picks: Option[]; why: string[]; cost: number; trainWeeks: number; recommended?: boolean }
const ACC: Record<EntryStatus, number> = { accepted: 1, 'likely qualifying': 0.75, alternate: 0.3, unlikely: 0, wildcard: 0, 'not eligible': 0 };
export function routes(S: State): Route[] {
  const weeks = blockWeeks(S), me = S.players[S.userId], u = S.u;
  const opts: Option[] = weeks.flatMap(w => eventsInWeek(S, w).map(e => optionFor(S, e))).filter(o => o.status !== 'not eligible' && o.status !== 'wildcard'); // Challenger wildcards are spent only by choice
  const budget = u.cash + Math.max(0, weeklyGuaranteed(S)) * weeks.length;
  const build = (key: Route['key'], label: string, intent: string, n: number, score: (o: Option) => number, reserve: number): Route => {
    const sorted = opts.map(o => ({ o, s: score(o) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    const busy = new Set<number>(), picks: Option[] = []; let cost = 0;
    const runLen = (w: number) => { let k = 1; for (let i = w - 1; busy.has(i); i--) k++; for (let i = w + 1; busy.has(i); i++) k++; return k; };
    for (const { o } of sorted) {
      if (picks.length >= n) break;
      const w = o.ed.startWk, need = [w]; if (o.ed.weeks === 2) need.push(w + 1); if (o.ed.band === 'GS' && o.status !== 'accepted') need.push(w - 1);
      if (need.some(x => busy.has(x) || (x !== w - 1 && !weeks.includes(x) && x < weeks[0]))) continue;
      if (o.ed.band !== 'GS' && runLen(w) > (key === 'recovery' ? 1 : 2)) continue;
      if (budget - cost - o.cost < reserve && (o.tc === 2 || (o.tc === 1 && picks.length >= 3))) continue; // short trips stay possible through basic support
      need.forEach(x => busy.add(x)); picks.push(o); cost += o.cost;
    }
    picks.sort((a, b) => a.ed.startWk - b.ed.startWk);
    const why: string[] = [], avgP = picks.reduce((t, o) => t + o.p, 0) / (picks.length || 1), unsure = picks.find(o => o.status === 'alternate' || o.status === 'unlikely'), longTrips = picks.filter(o => o.tc === 2).length;
    const trainWeeks = weeks.filter(w => !busy.has(w)).length;
    if (!picks.length) why.push('No suitable events found for this intent');
    else if (avgP >= 0.35 && avgP <= 0.65) why.push('Likely to get competitive matches'); else if (avgP < 0.35) why.push('Stronger fields than your current level'); else why.push('You would be among the favourites');
    if (unsure) why.push(`Entry uncertain at ${unsure.ed.name}`); else if (picks.some(o => o.status === 'likely qualifying')) why.push('Some entries through qualifying');
    if (longTrips) why.push(`${longTrips} long ${longTrips === 1 ? 'trip' : 'trips'}`); else if (picks.length) why.push('Little travel');
    why.push(`Leaves ${trainWeeks} training ${trainWeeks === 1 ? 'week' : 'weeks'}`);
    const map: Record<number, string> = {}; for (const o of picks) map[o.ed.startWk] = o.ed.id;
    return { key, label, intent, weeks: map, picks, why, cost, trainWeeks };
  };
  const tcf = (o: Option) => (o.tc === 0 ? 1 : o.tc === 1 ? 0.9 : 0.7), n = weeks.length >= 16 ? 6 : weeks.length >= 10 ? 5 : weeks.length >= 7 ? 4 : Math.max(1, Math.round(weeks.length / 2));
  const out = [
    build('development', 'Development', 'Matches you can learn from, close to your level', n, o => o.C * ACC[o.status] * tcf(o) * (1 + Math.log10(BAND_VAL[o.ed.band]) * 0.04), ECON.reserve),
    build('breakthrough', 'Breakthrough', 'Stronger fields and bigger points, with less certain entry', n, o => Math.sqrt(BAND_VAL[o.ed.band]) * (o.status === 'accepted' ? 1 : o.status === 'likely qualifying' ? 0.8 : o.status === 'alternate' ? 0.45 : 0) * (0.25 + o.p) * (0.8 + 0.2 * tcf(o)), 0),
    build('recovery', 'Recovery', 'Fewer events, less travel, more time to rebuild', Math.max(1, Math.ceil(n / 2)), o => (o.tc <= 1 ? 1 : 0) * (0.4 + o.C) * ACC[o.status] * (o.tc === 0 ? 1 : 0.8) * (o.ed.weeks === 2 ? 0.5 : 1), ECON.reserve),
  ];
  if (u.cash < 6000 || S.rank[S.userId] > 150) out.push(build('earnings', 'Earnings', 'Events most likely to pay for themselves', n + 1, o => Math.max(0, o.ePrize - o.cost * 0.8 + 200) * ACC[o.status] * (o.status === 'alternate' ? 0 : 1), ECON.reserve));
  const dv = out[0], dvP = dv.picks.reduce((t, o) => t + o.p, 0) / (dv.picks.length || 1);
  const rec = me.fatigue > 55 || me.strain > 50 || (me.injuredUntil > 0 && me.injuredUntil > S.wk - 3) ? 'recovery' : u.cash < 1500 && out.length > 3 ? 'earnings' : dvP > 0.6 && out[1].picks.length >= 3 ? 'breakthrough' : 'development';
  (out.find(r => r.key === rec && r.picks.length) ?? out[0]).recommended = true;
  return out;
}
export function coachReport(S: State): { potential: string; room: string; strengths: string; advice: string } {
  const me = S.players[S.userId], u = S.u, seasons = u.seasons.length;
  const sd = (u.coach.tier === 'starter' ? 7 : u.coach.tier === 'tour' ? 5 : 3.5) * Math.max(0.4, 1 - 0.12 * seasons);
  const est = strength(me.ceil) + rngOf(S.seed, 'coachview', u.coach.id, S.year).normal(0, 1) * sd, room = strength(me.ceil) - strength(me.ab);
  const early = seasons < 2 ? ', but it is too early to be certain' : '';
  const potential = u.profileSelected ? { goat: 'You chose GOAT Contention: the opportunity to challenge the greatest is there. Nothing about it is guaranteed.', contender: 'You chose Contender: a major challenger\'s tools, with real weaknesses to manage.', grinder: 'You chose Grinder: a fight toward the top 25, with rare trophy chances to seize.' }[u.profile]
    : est >= 92 ? `Exceptional upside${early}.` : est >= 85 ? `Likely to become a strong tour player, possibly more${early}.` : est >= 78 ? `Can build a solid tour career${early}.` : `Reaching the tour's upper levels will be a fight${early}.`;
  const best = [...ABILITIES].sort((a, b) => me.ab[b] - me.ab[a]);
  const names: Record<string, string> = { serve: 'serve', ret: 'return', fh: 'forehand', bh: 'backhand', net: 'net play', move: 'movement', end: 'endurance', comp: 'composure' };
  return {
    potential, room: room > 20 ? 'Still has substantial room to grow.' : room > 8 ? 'Has room left to improve.' : room > 3 ? 'Close to a finished player; gains will be small.' : 'Playing at the top of their ability now.',
    strengths: `Current strengths: ${names[best[0]]} and ${names[best[1]]}. Work to do on ${names[best[7]]}.`,
    advice: me.injuredUntil > S.wk ? 'Rehabilitation comes first. Do not rush the return.' : me.fatigue > 55 ? 'You look tired. A lighter stretch would help more than another event.' : me.strain > 50 ? 'The load has been building for weeks. Protect the body before it protests.' : me.sharp < 45 ? 'You need matches. Rhythm will come back with competition.' : me.conf < 38 ? 'Confidence is low. Look for matches you can win.' : 'You are in good shape. Choose matches that stretch you.',
  };
}
/** At most one featured dilemma per block (spec 4.2). Deterministic for a given career, year and block. */
export function featuredEvent(S: State): LifeEv | null {
  const r = rngOf(S.seed, 'life', S.year, S.block), u = S.u, nowBlock = (S.year - 2026) * 4 + S.block;
  if (!r.chance(0.85)) return null;
  const pool = EVENTS.filter(e => (!e.adult || u.pol.adult) && (!e.when || e.when(S)) && (u.evSeen[e.id] === undefined || (e.repeat !== undefined && nowBlock - u.evSeen[e.id] >= e.repeat)));
  return pool.length ? r.pick(pool) : null;
}
export function fillText(S: State, t: string): string {
  const u = S.u, rel = u.rel as any;
  return t.replace(/\{coach\}/g, u.coach.name.split(' (')[0]).replace(/\{friend\}/g, rel.friendName ?? 'a close friend').replace(/\{partner\}/g, u.rel.partnerName ?? 'your partner').replace(/\{agent\}/g, rel.agentName ?? 'your agent');
}

/** Home wildcards: now and then an event near your base, a level above where you would get in, offers you a main-draw wildcard.
 *  It happens in weeks when a bigger event elsewhere pulls the stronger players away, and the draw gives you a top seed in round one. */
export interface WcOffer { ed: Edition; bigger: Edition; status: EntryStatus }
export function wildcardOffers(S: State): WcOffer[] {
  const me = S.players[S.userId], home = homeOf(S), rank = S.rank[S.userId] ?? 1500, out: WcOffer[] = [];
  for (const w of blockWeeks(S)) {
    const evs = eventsInWeek(S, w);
    for (const ed of evs) {
      if (ed.band === 'GS' || ed.band === 'F' || BAND_VAL[ed.band] < 50 || ed.weeks === 2) continue;
      if (travelClass(home, ed.country) !== 0 && ed.country !== me.country) continue;
      const status = estimate(S, ed); if (status === 'accepted' || status === 'not eligible' || status === 'wildcard') continue;
      const [cut] = cutsFor(S, ed); if (rank > Math.max(cut, 60) * 4) continue; // not wildly out of reach
      const bigger = S.cal.filter(e => e.startWk === w || (e.weeks === 2 && e.startWk === w - 1)).filter(e => !e.cancelled && BAND_VAL[e.band] > BAND_VAL[ed.band]).sort((a, b) => BAND_VAL[b.band] - BAND_VAL[a.band])[0];
      if (!bigger) continue;
      if (!rngOf(S.seed, 'wcoffer', ed.id).chance(0.16)) continue;
      out.push({ ed, bigger, status });
    }
  }
  return out.sort((a, b) => BAND_VAL[b.ed.band] - BAND_VAL[a.ed.band]).slice(0, 1);
}
