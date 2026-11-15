// "Around the tour": short headlines generated from what happens in the world, so the tour feels alive between swings.
import { BAND_VAL } from './balance';
import { ageOn, wkDate } from './content';
import type { Band, Edition, News, State } from './types';

const CAP = 320;
export const theName = (n: string) => (n === 'Wimbledon' || n.startsWith('the ') ? n : `the ${n}`);
const nm = (S: State, id: string) => S.players[id]?.name ?? 'Unknown';
const isRival = (S: State, id: string) => S.u.rivals.includes(id);

export function addNews(S: State, kind: News['kind'], text: string, ids: string[], band?: Band) {
  const w = S.world; if (!w.news) w.news = [];
  w.news.push({ wk: S.wk, year: S.year, kind, text, ids, band });
  if (w.news.length > CAP) w.news.splice(0, w.news.length - CAP);
}

/** Champions of the bigger events, plus any rival's title and the user's own titles. */
export function champNews(S: State, ed: Edition, champ: string, runnerUp?: string) {
  const big = BAND_VAL[ed.band] >= 500, uid = S.userId;
  if (champ === uid) { addNews(S, 'you', `You win ${theName(ed.name)}${runnerUp ? `, beating ${nm(S, runnerUp)} in the final` : ''}`, [champ], ed.band); return; }
  if (isRival(S, champ)) { addNews(S, 'rival', `Your rival ${nm(S, champ)} wins ${theName(ed.name)}`, [champ], ed.band); return; }
  if (!big) return;
  const p = S.players[champ], first = p.titles === 1, firstMajor = ed.band === 'GS' && p.majors === 1;
  const text = firstMajor ? `${p.name} wins a first major at ${theName(ed.name)}` : first ? `${p.name} wins a first tour title at ${theName(ed.name)}`
    : ed.band === 'GS' && p.majors > 1 ? `${p.name} wins ${theName(ed.name)} for major No. ${p.majors}` : `${p.name} wins ${theName(ed.name)}`;
  addNews(S, 'champ', text, runnerUp ? [champ, runnerUp] : [champ], ed.band);
}

/** Top seeds going out early at the majors and Masters-level events. At most one per event. */
export function upsetNews(S: State, ed: Edition, loser: string, winner: string, round: string, loserRank: number, winnerRank: number) {
  if (!(ed.band === 'GS' || ed.band === 'T1000') || loserRank > 4 || ['QF', 'SF', 'F'].includes(round) || winnerRank < 40) return;
  const k = `up:${ed.id}`, m = (S.world.mile ??= {}); if ((m[k] ?? 0) >= 1) return; m[k] = (m[k] ?? 0) + 1;
  if (winner === S.userId || loser === S.userId) return;
  addNews(S, 'upset', `Upset at ${theName(ed.name)}: world No. ${winnerRank} ${nm(S, winner)} knocks out No. ${loserRank} ${nm(S, loser)}`, [winner, loser], ed.band);
}

const TIERS = [100, 50, 20, 10, 5, 1];
const tierOf = (r: number) => TIERS.find(t => r <= t) ?? 9999;

/** Weekly ranking stories: a new No. 1, rivals crossing ranking milestones, teenagers breaking into the top 100. */
export function weeklyNews(S: State) {
  const w = S.world, init = !w.mile; w.mile ??= {};
  const m = w.mile, no1 = S.order[0], date = wkDate(S.wk);
  if (no1 && w.lastNo1 && no1 !== w.lastNo1 && !init) {
    addNews(S, no1 === S.userId ? 'you' : isRival(S, no1) ? 'rival' : 'rank', no1 === S.userId ? 'You are the new world No. 1' : `${nm(S, no1)} takes over as world No. 1 from ${nm(S, w.lastNo1)}`, [no1, w.lastNo1]);
  }
  w.lastNo1 = no1;
  for (const id of S.u.rivals) {
    const r = S.rank[id]; if (!r || S.players[id]?.retired) continue;
    const t = tierOf(r), best = m[`r:${id}`] ?? 9999;
    if (t < best) { m[`r:${id}`] = t; if (!init && best !== 9999 && t !== 1) addNews(S, 'rival', `Your rival ${nm(S, id)} climbs into the top ${t}`, [id]); }
  }
  for (const id of S.order.slice(0, 100)) {
    if (m[`t:${id}`] || id === S.userId) continue;
    m[`t:${id}`] = 1; if (init) continue;
    const p = S.players[id], age = ageOn(p.born, date);
    if (age <= 19) addNews(S, 'teen', `${age}-year-old ${p.name} breaks into the top 100`, [id]);
  }
}

/** Year-end headlines, called before the calendar rolls over. */
export function yearEndNews(S: State, retired: string[]) {
  const no1 = S.order[0];
  if (no1) addNews(S, no1 === S.userId ? 'you' : 'yearEnd', no1 === S.userId ? `You finish ${S.year} as the year-end world No. 1` : `${nm(S, no1)} finishes ${S.year} as the year-end world No. 1`, [no1]);
  const big = retired.map(id => S.players[id]).filter(p => p && (p.real || p.bestRank <= 50) && (p.majors > 0 || p.bestRank <= 30)).sort((a, b) => b.majors - a.majors || a.bestRank - b.bestRank).slice(0, 3);
  for (const p of big) addNews(S, isRival(S, p.id) ? 'rival' : 'retire', `${p.name} announces retirement${p.majors ? ` with ${p.majors} major title${p.majors > 1 ? 's' : ''}` : p.titles ? ` after ${p.titles} tour title${p.titles > 1 ? 's' : ''}` : ''}`, [p.id]);
}

export const newsSince = (S: State, fromWk: number) => (S.world.news ?? []).filter(n => n.wk >= fromWk);
