// Prodigies and top coaching: a player who breaks out young is approached by coaches far above their ranking.
// Those coaches are expensive (a reduced retainer plus a cut of prize money) and stay only while results keep moving.
import { ageOn, wkDate } from './content';
import { addNews } from './news';
import { clamp, rngOf } from './rng';
import { addLedger, logEv, note } from './tour';
import type { BlockSummary, Coach, CoachTier, State } from './types';
import { makeCoach } from './world';

export const TIER_ORDER: CoachTier[] = ['starter', 'tour', 'elite', 'master', 'legend'];
const tierIdx = (t: CoachTier) => TIER_ORDER.indexOf(t);
const PRO: [number, [number, number, number]][] = [[17, [300, 600, 900]], [18, [150, 300, 500]], [19, [100, 200, 350]], [20, [60, 120, 220]], [21, [35, 80, 150]]];
export const PRODIGY_TIER: Record<number, CoachTier> = { 1: 'elite', 2: 'master', 3: 'legend' };
export const PRODIGY_NAME: Record<number, string> = { 0: '', 1: 'Rising prospect', 2: 'Prodigy', 3: 'Generational talent' };
/** Deal terms: a reduced retainer plus a share of prize money. */
export const DEAL = { retainer: 0.6, pct: 0.12, patience: 70, leave: 20, warn: 40, expect: { elite: 0.5, master: 0.55, legend: 0.6 } as Record<string, number> };

/** How far ahead of their age the user is: 0 (not a breakout), 1 rising prospect, 2 prodigy, 3 generational. */
export function breakout(S: State): { level: number; why: string } {
  const me = S.players[S.userId], age = ageOn(me.born, wkDate(S.wk)); if (age >= 22) return { level: 0, why: '' };
  let level = 0, why = '';
  const up = (l: number, w: string) => { if (l > level) { level = l; why = w; } };
  if (me.junior) {
    const jr = S.jrank?.[me.id] ?? 9999, slams = S.u.tourneys.filter(t => t.band === 'J' && t.jl === 1000);
    if (slams.some(t => t.title)) up(3, 'a junior Grand Slam title'); if (jr <= 3) up(3, `reaching junior world No. ${jr}`);
    if (slams.some(t => t.final)) up(2, 'a junior Grand Slam final'); if (jr <= 10) up(2, `reaching the junior top 10 (No. ${jr})`);
    if (jr <= 25) up(1, `reaching the junior top 25 (No. ${jr})`);
  }
  const r = (S.pts[me.id] ?? 0) > 0 ? S.rank[me.id] : 9999, row = PRO.find(([a]) => age <= a);
  if (row) { const [, [l3, l2, l1]] = row; const w = `reaching world No. ${r} at ${age}`; if (r <= l3) up(3, w); else if (r <= l2) up(2, w); else if (r <= l1) up(1, w); }
  return { level, why };
}

/** A coach on prodigy terms: a top coach who takes a reduced retainer and a cut of the prize money, and expects results. */
export function prodigyCoach(S: State, tier: CoachTier, seedKey: string): Coach {
  const me = S.players[S.userId], r = rngOf(S.seed, 'prodigy', seedKey);
  const c = makeCoach(r, tier, me.country, S.year, me.style);
  return { ...c, cost: Math.round((c.cost * DEAL.retainer) / 10) * 10, deal: { pct: DEAL.pct, full: c.cost }, patience: DEAL.patience, until: S.year + 2, trust: c.trust + 5 };
}

/** At the end of each swing: the coach's patience moves with results; a top coach approaches a player who has just broken out. */
export function reviewCoaching(S: State, sum: BlockSummary) {
  const u = S.u, c = u.coach, me = S.players[S.userId];
  if (c.deal && c.patience !== undefined) {
    const ms = u.matches.filter(m => m.wk >= sum.fromWk && m.cls !== 'wo'), w = ms.filter(m => m.won).length, n = ms.length;
    const injured = u.injuries.some(i => i.wk >= sum.fromWk - 4 && i.weeks >= 3);
    let d = -6; // standing still is not enough: a top coach expects progress every swing
    if (n >= 3) d += (w / n - (DEAL.expect[c.tier] ?? 0.5)) * 50; else if (!injured) d -= 10;
    if ((sum.ptsFrom ?? 0) > 0 && (S.pts[me.id] ?? 0) > 0) d += clamp(Math.log(sum.rankFrom / Math.max(1, S.rank[me.id])) * 25, -12, 15);
    if (sum.jrFrom && sum.jrFrom < 9999 && (S.jrank?.[me.id] ?? 9999) < 9999) d += clamp(Math.log(sum.jrFrom / S.jrank![me.id]) * 15, -10, 12);
    d += Math.min(12, 6 * u.tourneys.filter(t => t.wk >= sum.fromWk && t.title).length);
    if (injured && d < 0) d *= 0.4; // injuries buy patience
    const before = c.patience; c.patience = Math.round(clamp(before + d, 0, 90));
    const nm = c.name.split(' (')[0];
    if (c.patience < DEAL.leave) {
      u.coachHistory.push({ ...c, left: S.year, reason: 'Walked away: results stalled' });
      const fb = makeCoach(rngOf(S.seed, 'fallback', S.wk), 'tour', me.country, S.year, me.style); fb.until = S.year + 1;
      u.coach = fb; u.rel.coach = fb.trust; u.coachLeft = S.wk;
      note(S, `${nm} has walked away: the results stopped moving and the deal no longer made sense. ${fb.name.split(' (')[0]}, a tour-level coach, takes over.`);
      addNews(S, 'you', `${nm} ends the coaching partnership with you`, [me.id]); logEv(S, 'CoachLeft', { id: c.id, patience: c.patience });
    } else if (c.patience < DEAL.warn) note(S, `${nm} is losing patience (${c.patience}/100). Another flat swing and the partnership could end.`);
    else if (c.patience - before >= 10) note(S, `${nm} is pleased with the progress. Patience ${c.patience}/100.`);
  }
  // a breakout: a coach above your current level comes calling (once for each new level)
  const b = breakout(S), tier = PRODIGY_TIER[b.level];
  if (b.level > (u.prodigyBest ?? 0)) {
    u.prodigyBest = b.level;
    addNews(S, 'you', `${PRODIGY_NAME[b.level]}: ${me.name} turns heads after ${b.why}`, [me.id]);
    if (tier && tierIdx(tier) > tierIdx(u.coach.tier)) {
      u.approach = { coach: prodigyCoach(S, tier, `ap${S.wk}`), why: b.why, level: b.level, wk: S.wk };
      note(S, `A ${tier === 'legend' ? 'legendary' : tier === 'master' ? 'world-class' : 'top'} coach has been in touch after ${b.why}. The offer is on your home screen until the next swing ends.`);
    }
  } else if (u.approach && u.approach.wk < sum.fromWk) { u.approach = undefined; } // offers lapse after one swing
}

/** Accept or decline the approach. */
export function answerApproach(S: State, accept: boolean) {
  const u = S.u, a = u.approach; if (!a) throw new Error('There is no coaching offer open.');
  u.approach = undefined;
  if (!accept) { note(S, `You turned down ${a.coach.name.split(' (')[0]}.`); logEv(S, 'ApproachDeclined', { id: a.coach.id }); return; }
  u.coachHistory.push({ ...u.coach, left: S.year, reason: 'Replaced by a higher-level coach' });
  addLedger(S, 'Coach transition', -a.coach.cost); u.coach = { ...a.coach, since: S.year }; u.rel.coach = a.coach.trust;
  S.players[S.userId].sharp = Math.max(30, S.players[S.userId].sharp - 3);
  logEv(S, 'ContractChanged', { kind: 'coach', id: a.coach.id, name: a.coach.name, prodigy: true });
}

/** Coaching matters most while a player is still growing: the gain above an average coach is amplified for under-22s. */
export function youthCoachAmp(age: number) { return age <= 19 ? 1.6 : age <= 21 ? 1.35 : age <= 22 ? 1.15 : 1; }
