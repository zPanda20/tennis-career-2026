// The road to the tour for a player who starts at 16: academy years as a junior, then at 18 a four-year path
// (full-time tour, university or academy plus a part-time schedule) before turning pro for good or stopping.
import { LEVEL, lerpTable } from './balance';
import { ageOn, wkDate } from './content';
import { simulateMatch } from './match';
import { genName } from './names';
import { clamp, rngOf } from './rng';
import type { Academy, PathKind, Player, State } from './types';
import { makeAbilities, strength } from './world';

export const ACADEMY: Record<Academy, { name: string; fee: number; dev: number; text: string }> = {
  club: { name: 'Local club programme', fee: 250, dev: 1.0, text: 'Cheap and close to home. Decent coaching, few strong practice partners.' },
  national: { name: 'National federation centre', fee: 700, dev: 1.08, text: 'Structured training with the best players of your age. Free once you are in the junior top 100.' },
  elite: { name: 'Elite international academy', fee: 3200, dev: 1.16, text: 'World-class facilities and sparring every day. Expensive and far from home; half price in the junior top 60, a full scholarship in the top 20.' },
};
export const PATHS: Record<PathKind, { name: string; text: string }> = {
  pro: { name: 'Tour full time', text: 'Every week is yours to plan. Prize money, travel bills and ranking points from day one.' },
  college: { name: 'University tennis', text: 'A scholarship and a college season from January to May and in the autumn, strong coaching and a degree. Pro events only in the summer and in December. Prize money is limited to expenses.' },
  academy: { name: 'Academy + part-time tour', text: 'Extra training blocks with faster development, and up to 14 pro events a season. Academy fees to pay.' },
};
export const PART_TIME_EVENTS = 14;
export const COLLEGE_PRIZE_CAP = 10000;
export const FAMILY_SUPPORT = 1400; // a month, while a junior

export const isJuniorStage = (S: State) => S.u.stage === 'junior';
export const pathKind = (S: State) => (S.u.stage === 'path' ? S.u.path?.kind : undefined);
/** Development multiplier from the academy or the chosen path. */
export function academyMult(S: State): number {
  const u = S.u; if (!u?.jstart) return 1;
  if (u.stage === 'junior') return ACADEMY[u.academy ?? 'club'].dev;
  if (u.stage === 'path') return u.path?.kind === 'academy' ? 1.18 : u.path?.kind === 'college' ? 1.07 : 1;
  return 1;
}
/** Monthly costs and support for the junior and path years (positive = income). */
export function stageMoney(S: State): [string, number][] {
  const u = S.u, out: [string, number][] = []; if (!u.jstart) return out;
  if (u.stage === 'junior') {
    out.push(['Family support', FAMILY_SUPPORT]);
    const a = u.academy ?? 'club', jr = S.jrank?.[S.userId] ?? 9999, free = (a === 'national' && jr <= 100) || (a === 'elite' && jr <= 20);
    if (!free) out.push([`${ACADEMY[a].name} fees`, -(a === 'elite' && jr <= 60 ? ACADEMY[a].fee / 2 : ACADEMY[a].fee)]);
  } else if (u.stage === 'path' && u.path?.kind === 'academy') out.push(['Academy fees', -2500]);
  else if (u.stage === 'path' && u.path?.kind === 'college') out.push(['Scholarship (living costs)', 900]);
  return out;
}
const woy = (S: State, wk = S.wk) => wk - (S.wk - S.week);
/** College season weeks (week of the year): spring dual matches and NCAA championships, then the autumn events. */
export const collegeWeek = (w: number) => (w >= 1 && w <= 20) || (w >= 37 && w <= 45);
export function blockedWeek(S: State, wk: number): string | null {
  if (pathKind(S) === 'college' && collegeWeek(woy(S, wk))) return 'College season';
  return null;
}
export function eventsUsed(S: State) { return S.u.tourneys.filter(t => t.year === S.year && t.band !== 'J' && (t.status === 'MD' || t.status === 'Q' || t.status === 'WC' || t.status === 'LL')).length; }

// ---------- university: dual matches and the NCAA championships ----------
const SCHOOLS = ['Stanford', 'Texas', 'Ohio State', 'Virginia', 'Florida', 'TCU', 'Georgia', 'USC', 'Wake Forest', 'Kentucky', 'Michigan', 'Baylor', 'Tennessee', 'North Carolina', 'Columbia', 'Harvard', 'Oklahoma', 'Mississippi State', 'Duke', 'Arizona'];
function collegeOpp(S: State, r: ReturnType<typeof rngOf>, level: number): Player {
  const { name, country } = genName(r, S.tour, r.chance(0.55) ? 'USA' : undefined, new Set());
  const ab = makeAbilities(level, 'B', r), me = S.players[S.userId];
  return { ...me, id: `college:${name}`, name, country, user: false, real: false, ab, ceil: ab, fatigue: 15, strain: 5, sharp: 65, conf: 55, morale: 60, res: [], commit: {}, edge: 0 } as Player;
}
/** One week of the college season for the user: dual matches in spring, the NCAA singles championship in late May, individual events in the autumn. */
export function playCollegeWeek(S: State) {
  if (pathKind(S) !== 'college') return;
  const w = woy(S), me = S.players[S.userId]; if (!collegeWeek(w) || me.injuredUntil > S.wk) return;
  const u = S.u, r = rngOf(S.seed, 'college', S.wk);
  let season = u.college!.find(c => c.year === S.year); if (!season) { season = { year: S.year, w: 0, l: 0, matches: [] }; u.college!.push(season); }
  const rules = { surface: 'hard' as const, bestOf: 3 as const, tb10: false, tour: S.tour };
  const play = (lvl: number, label: string) => {
    const opp = collegeOpp(S, r, lvl), school = r.pick(SCHOOLS);
    const res = simulateMatch(me, opp, rules, `${S.seed}|college|${S.wk}|${label}`, false);
    const won = res.winner === 0; if (won) season!.w++; else season!.l++;
    season!.matches.push({ wk: S.wk, opp: opp.name, school, won, score: res.score });
    me.wkMatches = (me.wkMatches ?? 0) + 1; me.wkCredit = (me.wkCredit ?? 0) + (Math.abs(strength(opp.ab) - strength(me.ab)) < 6 ? 0.65 : 0.35); me.wkSurf = 'hard';
    me.conf = clamp(me.conf + (won ? 1.2 : -1.2), 0, 100); me.fatigue += 3;
    return won;
  };
  if (w === 20) { // NCAA singles championship: 64 players, six rounds
    const rounds = ['R64', 'R32', 'R16', 'QF', 'SF', 'F']; let reached = 'R64';
    for (let i = 0; i < rounds.length; i++) { if (!play(57 + i * 1.6 + r.normal(0, 2), `ncaa${i}`)) { reached = rounds[i]; break; } reached = i === rounds.length - 1 ? 'W' : rounds[i + 1]; }
    season.ncaa = reached;
    if (reached === 'W') { (u as any).usoWc = S.year; S.sumAcc?.newAch.push('NCAA singles champion'); S.sumAcc?.notes.push('You won the NCAA singles title. It comes with a US Open wildcard if you enter this summer.'); }
    return;
  }
  // spring: dual matches at No. 1 singles for your school, one or two a week; autumn: individual ITA events
  const n = w <= 18 ? (r.chance(0.5) ? 2 : 1) : w >= 37 ? (r.chance(0.65) ? 1 : 0) : 0;
  for (let i = 0; i < n; i++) play(r.normal(58, 4), `dual${i}`);
}

// ---------- the decision: is this player competitive? ----------
/** The coach's honest read: projected peak ranking from potential (with a read error that shrinks with coach quality). */
export function prospectRead(S: State) {
  const me = S.players[S.userId], tier = S.u.coach.tier, sd = { starter: 4, tour: 3, elite: 2.2, master: 1.5, legend: 1 }[tier] ?? 3;
  const pot = strength(me.ceil) + rngOf(S.seed, 'prospect', S.year).normal(0, sd), now = strength(me.ab);
  const toRank = (lvl: number) => { const t = LEVEL[S.tour]; for (let i = 1; i < t.length; i++) if (lvl >= t[i][1]) { const [r0, l0] = t[i - 1], [r1, l1] = t[i]; return Math.round(r0 + ((r1 - r0) * (l0 - lvl)) / (l0 - l1)); } return 1200; };
  const peak = toRank(pot), cur = S.rank[S.userId] ?? 9999, age = ageOn(me.born, wkDate(S.wk));
  const verdict = peak <= 20 ? 'A future star if the work keeps going' : peak <= 100 ? 'A realistic top-100 prospect' : peak <= 250 ? 'A tour professional, more likely on the Challenger circuit' : peak <= 500 ? 'Fringe: a hard living on the ITF circuit' : 'Unlikely to make a living on tour';
  return { peak, cur, now: Math.round(now * 10) / 10, pot: Math.round(pot * 10) / 10, verdict, age, levelTop100: lerpTable(LEVEL[S.tour], 100) };
}
