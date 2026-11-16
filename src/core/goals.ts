// Season goals: three targets each year, sized to the player's ranking, with a small reward for each one met.
import { ROUND_KEYS } from './balance';
import { addNews } from './news';
import { clamp, rngOf } from './rng';
import { addLedger, logEv, note } from './tour';
import type { Band, Goal, State } from './types';

const TIERS = [1000, 750, 500, 400, 300, 250, 200, 150, 100, 75, 50, 30, 20, 10, 5, 3, 2, 1];
const ALL: Band[] = ['GS', 'F', 'T1000', 'T500', 'T250', 'UL', 'SL', 'EP'];
const upTo = (b: Band) => ALL.slice(0, ALL.indexOf(b) + 1);
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function rewardFor(rank: number) { return rank > 600 ? 1500 : rank > 300 ? 2500 : rank > 150 ? 4000 : rank > 60 ? 6000 : rank > 20 ? 9000 : 15000; }

const JT = [500, 300, 200, 150, 100, 75, 50, 30, 20, 10, 5, 3, 1];
/** Junior seasons: a junior ranking target, a junior title at the right level and a match-win target. */
function juniorGoals(S: State, year: number): Goal[] {
  const jr = S.jrank?.[S.userId] ?? 9999, r = rngOf(S.seed, 'jgoals', year), id = (k: string) => `g-${year}-${k}`;
  const want = Math.min(jr, 700) * r.range(0.45, 0.65), t = JT.find(x => x <= Math.max(1, want) && x < jr) ?? 1;
  const lvl = jr > 300 ? 30 : jr > 120 ? 100 : jr > 40 ? 200 : jr > 12 ? 500 : 1000;
  return [
    { id: id('jrank'), year, kind: 'jrank', target: t, label: t === 1 ? 'Become junior world No. 1' : `Reach the junior top ${t}`, reward: 750 },
    { id: id('jtitle'), year, kind: 'jtitle', target: lvl, label: lvl === 1000 ? 'Win a junior Grand Slam' : `Win a J${lvl} title or bigger`, reward: 1000 },
    { id: id('wins'), year, kind: 'wins', target: 25, label: 'Win 25 matches, junior and pro', reward: 500 },
  ];
}
export function makeGoals(S: State, year = S.year): Goal[] {
  if (S.players[S.userId]?.junior) return juniorGoals(S, year);
  const rank = S.rank[S.userId] ?? 1500, atp = S.tour === 'atp', r = rngOf(S.seed, 'goals', year), base = rewardFor(rank), out: Goal[] = [];
  const id = (k: string) => `g-${year}-${k}`, round = (n: number) => Math.round(n / 250) * 250;
  // 1. ranking: a meaningful step up, about a third better than now
  if (rank > 1) {
    const want = rank * r.range(0.62, 0.78), t = TIERS.find(x => x <= Math.max(1, want) && x < rank) ?? 1;
    out.push({ id: id('rank'), year, kind: 'rank', target: t, label: t === 1 ? 'Reach world No. 1' : `Reach the top ${t}`, reward: round(base) });
  } else out.push({ id: id('wins'), year, kind: 'wins', target: 55, label: 'Win 55 matches this season', reward: round(base) });
  // 2. a title at the right level
  const [bands, label] = rank > 500 ? [ALL, 'Win a title']
    : rank > 250 ? [upTo('SL'), atp ? 'Win a Challenger' : 'Win a W50 title or bigger']
    : rank > 100 ? [upTo('UL'), atp ? 'Win a Challenger 100 or bigger' : 'Win a WTA 125 or W100 title']
    : rank > 40 ? [upTo('T250'), 'Win a tour title']
    : rank > 10 ? [upTo('T500'), 'Win a 500-level title or bigger']
    : [upTo('T1000'), atp ? 'Win a Masters 1000 or a major' : 'Win a WTA 1000 or a major'];
  out.push({ id: id('title'), year, kind: 'title', target: 1, bands: bands as Band[], label: label as string, reward: round(base * 1.4) });
  // 3. the majors once they are within reach, otherwise a match-win target
  if (rank <= 250) {
    const [t, l] = rank > 120 ? [7, 'Reach a Grand Slam main draw'] : rank > 50 ? [6, 'Win a match at a major'] : rank > 16 ? [4, 'Reach the fourth round of a major']
      : rank > 6 ? [3, 'Reach a major quarter-final'] : rank > 2 ? [1, 'Reach a major final'] : [0, 'Win a major'];
    out.push({ id: id('major'), year, kind: 'major', target: t as number, label: l as string, reward: round(base * 1.2) });
  } else {
    const n = rank > 900 ? 15 : rank > 500 ? 20 : 28;
    out.push({ id: id('wins'), year, kind: 'wins', target: n, label: `Win ${n} matches, qualifying included`, reward: round(base * 0.8) });
  }
  for (const g of out) g.reward = Math.max(1000, g.reward);
  return out;
}

export function ensureGoals(S: State) {
  const u = S.u; if (S.phase === 'retired') return;
  u.goals ??= [];
  if (!u.goals.some(g => g.year === S.year)) u.goals.push(...makeGoals(S));
}

export function goalProgress(S: State, g: Goal): { now: number; of: number; text: string } {
  const u = S.u;
  if (g.kind === 'rank') { const from = S.wk - S.week, best = g.year === S.year ? Math.min(S.rank[S.userId] ?? 9999, ...u.rankHist.filter(h => h.wk >= from).map(h => h.rank)) : g.done !== undefined ? g.target : 9999; return { now: best <= g.target ? 1 : 0, of: 1, text: `Best this season: No. ${best}` }; }
  if (g.kind === 'jrank') { const jr = S.jrank?.[S.userId] ?? 9999; return { now: g.done !== undefined || jr <= g.target ? 1 : 0, of: 1, text: `Junior ranking now: ${jr < 9999 ? `No. ${jr}` : 'unranked'}` }; }
  if (g.kind === 'jtitle') { const n = u.tourneys.filter(t => t.year === g.year && t.title && t.band === 'J' && (t.jl ?? 0) >= g.target).length; return { now: Math.min(1, n), of: 1, text: n ? 'Done' : 'Not yet' }; }
  if (g.kind === 'title') { const n = u.tourneys.filter(t => t.year === g.year && t.title && g.bands!.includes(t.band)).length; return { now: Math.min(1, n), of: 1, text: n ? 'Done' : 'Not yet' }; }
  if (g.kind === 'wins') { const n = u.matches.filter(m => m.year === g.year && m.won && m.cls !== 'wo').length; return { now: Math.min(n, g.target), of: g.target, text: `${n} of ${g.target}` }; }
  const best = Math.min(99, ...u.tourneys.filter(t => t.year === g.year && t.band === 'GS').map(t => ROUND_KEYS.indexOf(t.reached)).filter(i => i >= 0));
  return { now: best <= g.target ? 1 : 0, of: 1, text: best < 99 ? `Best major: ${ROUND_KEYS[best] === 'W' ? 'champion' : ROUND_KEYS[best]}` : 'No major yet' };
}

/** Called every week after the matches: completes goals and pays the reward. */
export function checkGoals(S: State) {
  const u = S.u, me = S.players[S.userId];
  for (const g of u.goals ?? []) {
    if (g.year !== S.year || g.done !== undefined || g.failed) continue;
    const p = goalProgress(S, g); if (p.now < p.of) continue;
    g.done = S.wk;
    addLedger(S, 'Season goal reward', g.reward, g.id);
    me.conf = clamp(me.conf + 4, 0, 100); me.morale = clamp(me.morale + 3, 0, 100);
    note(S, `Season goal complete: ${g.label}. Reward ${money(g.reward)}, and a lift in confidence.`);
    S.sumAcc?.newAch.push(`Goal: ${g.label}`);
    addNews(S, 'you', `Season goal met: ${g.label}`, [S.userId]);
    logEv(S, 'GoalCompleted', { id: g.id, reward: g.reward });
  }
}
export function failGoals(S: State, year: number) { for (const g of S.u.goals ?? []) if (g.year === year && g.done === undefined) g.failed = true; }
