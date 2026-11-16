// Junior tennis: the ITF junior calendar, the junior ranking, the junior player pool and its graduation into the pro world.
// Calibration source: an update of Reid et al. (2007) covering the 504 boys who finished a year in the ITF junior top 50
// between 2004 and 2016, matched to their ATP careers (Sackmann, tennis_atp). See TUNING.md for the targets.
import { BAND_VAL } from './balance';
import { absOf, ageOn, fmtShort, travelClass, wkDate } from './content';
import { genName } from './names';
import { clamp, Rng, rngOf } from './rng';
import { ABILITIES, Edition, Player, State, Style, Surface, Tour } from './types';

export const JUNIOR_MAX_AGE = 18; // juniors may play through the calendar year they turn 18
export const JBEST_N = 6;
/** Junior ranking points by round reached (W, F, SF, QF, R16, R32, R64), by event level. 1000 = junior Grand Slam, 750 = Junior Finals. */
export const JPOINTS: Record<number, number[]> = {
  30: [30, 18, 12, 6, 3, 1, 0], 60: [60, 36, 24, 12, 6, 3, 0], 100: [100, 60, 40, 20, 10, 5, 0], 200: [200, 120, 80, 40, 20, 10, 0],
  300: [300, 180, 120, 60, 30, 15, 0], 500: [500, 300, 200, 100, 50, 25, 10], 1000: [1000, 600, 370, 200, 100, 50, 25], 750: [750, 450, 300, 150, 0, 0, 0],
};
/** Rough value of a junior event for planning and AI choices, on the same scale as pro event values. */
export const JVAL: Record<number, number> = { 30: 4, 60: 6, 100: 9, 200: 14, 300: 20, 500: 30, 1000: 45, 750: 40 };
/** Planning value of any event (pro band value, or the junior equivalent). */
export const edVal = (ed: Pick<Edition, 'band' | 'jl'>) => (ed.band === 'J' ? JVAL[ed.jl ?? 30] : BAND_VAL[ed.band]);
export const jLabel = (jl: number) => (jl === 1000 ? 'Junior Grand Slam' : jl === 750 ? 'ITF Junior Finals' : `ITF J${jl}`);

// ---------------- calendar ----------------
type Major = [number, string, string, string, number, Surface];
/** The bigger junior events, at approximately their usual weeks (week index from the start of the year). */
const MAJORS: Major[] = [
  [1, 'Traralgon International', 'Traralgon', 'AUS', 300, 'hard'], [8, 'Asunción Bowl', 'Asunción', 'PAR', 300, 'clay'], [9, 'Banana Bowl', 'São Paulo', 'BRA', 300, 'clay'],
  [14, 'Astrid Bowl', 'Charleroi', 'BEL', 300, 'clay'], [18, 'Trofeo Città di Santa Croce', 'Santa Croce', 'ITA', 300, 'clay'], [19, 'Trofeo Bonfiglio', 'Milan', 'ITA', 500, 'clay'],
  [25, 'Roehampton Junior Championships', 'London', 'GBR', 300, 'grass'], [30, 'Canadian Open Junior Championships', 'Repentigny', 'CAN', 500, 'hard'],
  [32, 'College Park International', 'College Park', 'USA', 500, 'hard'], [40, "Osaka Mayor's Cup", 'Osaka', 'JPN', 500, 'hard'],
  [42, 'ITF Junior Finals', 'Chengdu', 'CHN', 750, 'hard'], [45, 'Yucatán Cup', 'Mérida', 'MEX', 300, 'hard'],
  [47, 'Eddie Herr International', 'Bradenton', 'USA', 500, 'hard'], [49, 'Orange Bowl', 'Plantation', 'USA', 500, 'clay'],
];
const VENUES: [string, string, Surface, number][] = [ // country, city, surface, weight
  ['ESP', 'Valencia', 'clay', 3], ['ESP', 'Madrid', 'clay', 2], ['ITA', 'Rome', 'clay', 2], ['ITA', 'Florence', 'clay', 2], ['FRA', 'Lyon', 'hard', 2], ['GER', 'Berlin', 'clay', 2],
  ['NED', 'Amstelveen', 'clay', 1], ['BEL', 'Brussels', 'clay', 1], ['CZE', 'Prague', 'clay', 2], ['POL', 'Warsaw', 'clay', 1], ['HUN', 'Budapest', 'clay', 1], ['CRO', 'Umag', 'clay', 1],
  ['SRB', 'Belgrade', 'clay', 1], ['GRE', 'Heraklion', 'hard', 2], ['TUR', 'Antalya', 'hard', 3], ['POR', 'Lisbon', 'clay', 1], ['GBR', 'Nottingham', 'hard', 1], ['SWE', 'Båstad', 'clay', 1],
  ['AUT', 'Vienna', 'clay', 1], ['ROU', 'Bucharest', 'clay', 1], ['SUI', 'Lausanne', 'clay', 1], ['CYP', 'Larnaca', 'hard', 1], ['BUL', 'Sofia', 'clay', 1],
  ['USA', 'Tucson', 'hard', 2], ['USA', 'Boca Raton', 'clay', 1], ['USA', 'San Diego', 'hard', 1], ['USA', 'Atlanta', 'hard', 1], ['CAN', 'Montreal', 'hard', 1], ['MEX', 'Monterrey', 'hard', 1],
  ['ARG', 'Buenos Aires', 'clay', 2], ['BRA', 'Porto Alegre', 'clay', 1], ['CHI', 'Santiago', 'clay', 1], ['COL', 'Cali', 'clay', 1], ['PER', 'Lima', 'clay', 1], ['ECU', 'Guayaquil', 'clay', 1],
  ['DOM', 'Santo Domingo', 'hard', 1], ['URU', 'Montevideo', 'clay', 1], ['JPN', 'Nagoya', 'hard', 1], ['KOR', 'Seoul', 'hard', 1], ['CHN', 'Shenzhen', 'hard', 1], ['IND', 'New Delhi', 'hard', 2],
  ['THA', 'Nonthaburi', 'hard', 1], ['INA', 'Jakarta', 'hard', 1], ['TPE', 'Taipei', 'hard', 1], ['KAZ', 'Shymkent', 'clay', 1], ['UZB', 'Tashkent', 'hard', 1], ['PHI', 'Manila', 'hard', 1],
  ['AUS', 'Canberra', 'hard', 1], ['NZL', 'Auckland', 'hard', 1], ['RSA', 'Pretoria', 'hard', 1], ['EGY', 'Sharm El Sheikh', 'hard', 2], ['TUN', 'Monastir', 'hard', 2], ['MAR', 'Casablanca', 'clay', 1],
  ['UAE', 'Dubai', 'hard', 1], ['KEN', 'Nairobi', 'clay', 1],
];
const LEVELS: [number, number][] = [[30, 30], [60, 25], [100, 22], [200, 14], [300, 9]];

export function jDraw(jl: number) {
  if (jl === 750) return { draw: 8, qSpots: 0, qSize: 0, wc: 0, direct: 8 };
  if (jl === 1000) return { draw: 64, qSpots: 12, qSize: 48, wc: 6, direct: 46 };
  if (jl === 500) return { draw: 64, qSpots: 8, qSize: 32, wc: 6, direct: 50 };
  return { draw: 32, qSpots: 6, qSize: 24, wc: 4, direct: 22 };
}
/** Junior events for one season: the majors above, the four junior Grand Slams (second week of each Slam) and regional events every week. */
export function juniorCalendar(tour: Tour, year: number, slams: { slam: string; week: number; surface: Surface; city: string; country: string; name: string }[]): Edition[] {
  const T = tour === 'atp' ? 'Boys' : 'Girls', out: Edition[] = [], r = rngOf('juniors', tour, year);
  const mk = (week: number, name: string, city: string, country: string, jl: number, surface: Surface, series: string, slam?: 'ao' | 'rg' | 'wim' | 'uso'): Edition => {
    const d = jDraw(jl), startWk = absOf(year, week);
    return { series: `${tour}:j:${series}`, name, city, country, tour, band: 'J', jl, cat: jLabel(jl), surface, indoor: false, draw: d.draw, weeks: 1, week, slam, id: `${tour}:j:${series}:${year}`, year, startWk, entryWk: startWk,
      qSpots: d.qSpots, qSize: d.qSize, wc: d.wc, direct: d.direct, dates: `${fmtShort(wkDate(startWk))} – ${fmtShort(wkDate(startWk, 6))}`, md: [], q: [], alt: [], wcs: [], quals: [] } as Edition;
  };
  for (const s of slams) out.push(mk(s.week + 1, `${s.name} ${T}' Singles`, s.city, s.country, 1000, s.surface, `slam-${s.slam}`, s.slam as any));
  for (const [w, n, c, k, jl, sf] of MAJORS) out.push(mk(w, n, c, k, jl, sf, n.toLowerCase().replace(/[^a-z]+/g, '-')));
  for (let w = 0; w < 50; w++) {
    const n = w === 0 || w === 50 ? 2 : r.int(4, 6), used = new Set<string>();
    for (let i = 0; i < n; i++) {
      const v = r.weighted(VENUES, x => x[3]); if (used.has(v[1])) continue; used.add(v[1]);
      const jl = r.weighted(LEVELS, x => x[1])[0], surface: Surface = v[0] === 'GBR' && w >= 23 && w <= 26 ? 'grass' : v[2];
      out.push(mk(w, `J${jl} ${v[1]}`, v[1], v[0], jl, surface, `j${jl}-${v[1].toLowerCase().replace(/[^a-z]+/g, '-')}-w${w}`));
    }
  }
  return out;
}

// ---------------- the junior player pool ----------------
export type Speed = 'early' | 'steady' | 'late';
/** Mix of development speeds. Early developers dominate junior rankings; late developers arrive at 20–23. */
export const SPEED_MIX: [Speed, number][] = [['early', 0.3], ['steady', 0.45], ['late', 0.25]];
/** How far below their eventual peak a player is, by age and speed, for a player whose peak is 90 (a future top-10 player).
 *  The gap scales with potential above 35, so modest prospects are closer to their (lower) peak. Authored from the dataset:
 *  future top-10 players were ranked ~190 before 19, ~25 before 22 and ~9 before 24; top-50 juniors overall ~745 before 19. */
export const GAP: Record<Speed, [number, number][]> = {
  early: [[14, 40], [15, 32], [16, 25], [17, 19], [18, 14], [19, 10], [20, 7], [21, 5], [22, 3.5], [24, 1.5], [26, 0]],
  steady: [[14, 60], [15, 53], [16, 46], [17, 39], [18, 31], [19, 23], [20, 17], [21, 12], [22, 8], [23, 5.5], [24, 3.5], [26, 0]],
  late: [[14, 66], [15, 60], [16, 54], [17, 47], [18, 39], [19, 30], [20, 21], [21, 14], [22, 9], [24, 4], [26, 0]],
};
/** Growth multipliers by age and speed, applied on top of the normal age factor in weekly development. */
export const SPEED_AGE: Record<Speed, [number, number][]> = {
  early: [[17, 1.2], [19, 0.95], [21, 0.8], [24, 0.75], [99, 0.85]],
  steady: [[17, 1.0], [19, 0.95], [21, 1.05], [24, 1.1], [99, 1.0]],
  late: [[17, 0.75], [19, 0.9], [21, 1.25], [24, 1.3], [99, 1.05]],
};
export function speedFactor(speed: Speed | undefined, age: number) { if (!speed) return 1; for (const [a, f] of SPEED_AGE[speed]) if (age <= a) return f; return 1; }
export function gapAt(speed: Speed, age: number, pot = 90) {
  const t = GAP[speed], k = clamp((pot - 35) / 55, 0.3, 1.15); if (age <= t[0][0]) return t[0][1] * k;
  for (let i = 1; i < t.length; i++) if (age <= t[i][0]) { const [a0, g0] = t[i - 1], [a1, g1] = t[i]; return (g0 + ((g1 - g0) * (age - a0)) / (a1 - a0)) * k; }
  return t[t.length - 1][1] * k;
}
/** Potential (career peak strength) for a junior cohort: a long tail, like real junior fields. */
export function juniorPotential(r: Rng) {
  const x = r.next();
  return x < 0.01 ? r.range(91, 98) : x < 0.035 ? r.range(85, 91) : x < 0.09 ? r.range(78, 85) : x < 0.2 ? r.range(72, 78) : x < 0.45 ? r.range(64, 72) : r.range(50, 64);
}
const STYLES: [Style, number][] = [['B', 0.35], ['C', 0.25], ['A', 0.2], ['S', 0.17], ['N', 0.03]];

export function makeJunior(S: State, r: Rng, taken: Set<string>, birthYear: number, mk: (id: string, name: string, country: string, born: string, level: number, style: Style, r: Rng) => Player): Player {
  const { name, country } = genName(r, S.tour, undefined, taken); taken.add(name);
  const born = `${birthYear}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`;
  const speed = r.weighted(SPEED_MIX, s => s[1])[0], pot = juniorPotential(r);
  const age = ageOn(born, wkDate(S.wk)) + 0.5, level = clamp(pot - gapAt(speed, age, pot) * r.range(0.75, 1.3) + r.normal(0, 3.5), 24, pot - 0.5);
  const style = r.weighted(STYLES, s => s[1])[0];
  const p = mk(`${S.tour}:j${S.nextPid++}`, name, country, born, level, style, r);
  p.tour = S.tour; p.junior = true; p.jres = []; p.speed = speed; p.pot = pot; p.jtitles = 0;
  for (const k of ABILITIES) p.ceil[k] = clamp(p.ab[k] + (pot - level) + r.normal(0, 3), p.ab[k] + 0.5, 99);
  p.lr = clamp(1 + (pot - 70) / 80 + r.normal(0, 0.15), 0.7, 1.45);
  p.declineAge = r.int(29, 32); p.sharp = 55; p.fatigue = 10; p.strain = 4;
  return p;
}
export const isJuniorAge = (born: string, year: number) => year - +born.slice(0, 4) <= JUNIOR_MAX_AGE;

/** Starting junior points for the first season, from each junior's current level (older and stronger juniors rank higher). */
export function seedJuniorPoints(S: State, r: Rng) {
  const js = S.active.map(id => S.players[id]).filter(p => p.junior).map(p => ({ p, k: strength8(p) + r.normal(0, 2.5) })).sort((a, b) => b.k - a.k);
  js.forEach(({ p }, i) => {
    if (i >= 520) return; const total = 3000 * (i + 1) ** -0.62, n = i < 60 ? 6 : i < 200 ? 5 : 4, w = [0.3, 0.22, 0.17, 0.13, 0.1, 0.08].slice(0, n), sw = w.reduce((a, b) => a + b, 0);
    p.jres = w.map((x, j) => ({ ed: `seed:${p.id}:${j}`, pts: Math.max(1, Math.round((total * x) / sw)), exp: S.wk + 4 + Math.round((48 * (j + 0.5)) / n) + r.int(-2, 2), yr: S.year - 1 }));
  });
}
/** How much of a junior's schedule goes to pro events: strong and older juniors move across to ITF and Challenger events. */
export function proShare(p: Player, wk: number) {
  const lvl = strength8(p), age = ageOn(p.born, wkDate(wk));
  return clamp((lvl - 48) / 16, 0, 0.85) * (age >= 17.5 ? 1.25 : age >= 16.5 ? 1 : 0.6);
}
const strength8 = (p: Player) => ABILITIES.reduce((t, k) => t + p.ab[k], 0) / 8;

// ---------------- junior ranking ----------------
export function jCounted(p: Player, wk: number) { const xs = (p.jres ?? []).filter(r => r.exp > wk).map(r => r.pts).sort((a, b) => b - a); xs.length = Math.min(xs.length, JBEST_N); return xs; }
export function jpublish(S: State) {
  const wk = S.wk, rows: { id: string; pts: number }[] = [];
  for (const id of S.active) {
    const p = S.players[id]; if (!p.junior) continue;
    if (p.jres?.some(r => r.exp <= wk)) p.jres = p.jres.filter(r => r.exp > wk);
    rows.push({ id, pts: jCounted(p, wk).reduce((t, x) => t + x, 0) });
  }
  rows.sort((a, b) => b.pts - a.pts || S.players[b.id].pot! - S.players[a.id].pot! || (a.id < b.id ? -1 : 1));
  S.jrank = {}; S.jpts = {}; S.jorder = rows.map(r => r.id);
  rows.forEach((r, i) => { S.jrank![r.id] = r.pts > 0 ? i + 1 : 9999; S.jpts![r.id] = r.pts; const p = S.players[r.id]; if (r.pts > 0 && i + 1 < (p.jbest ?? 9999)) p.jbest = i + 1; });
}
/** Junior cut-offs before an event has been held: by level. */
export const JCUTS: Record<number, [number, number]> = { 30: [600, 1200], 60: [400, 900], 100: [260, 600], 200: [170, 420], 300: [110, 280], 500: [60, 170], 1000: [45, 120], 750: [8, 8] };
export const minJ = (jrank: number) => (jrank <= 15 ? 300 : jrank <= 50 ? 100 : jrank <= 150 ? 60 : 30);

/** AI juniors and the user enter junior events. Runs before the pro entries, so juniors committed here are not free for pro events. */
export function runJuniorEntries(S: State, hooks: { avail: (p: Player, w: number) => boolean; free: (p: Player, w: number) => boolean; open: (ed: Edition, status: 'MD' | 'Q' | 'WC' | 'ALT' | 'REJ' | 'WD', via?: string) => void; note: (t: string) => void; home: string }) {
  const wk = S.wk, P = S.players, uid = S.userId, eds = S.cal.filter(e => e.band === 'J' && e.entryWk === wk && !e.cancelled);
  if (!eds.length) return;
  const jr = (id: string) => S.jrank?.[id] ?? 9999, lock = (ed: Edition, id: string) => { (ed as any).lock ??= {}; (ed as any).lock[id] = jr(id); };
  const apps = new Map<string, string[]>(eds.map(e => [e.id, []]));
  const userEd = S.plan?.weeks[wk] ? eds.find(e => e.id === S.plan!.weeks[wk]) : undefined;
  if (userEd && P[uid].junior && hooks.avail(P[uid], wk) && hooks.free(P[uid], wk)) apps.get(userEd.id)!.push(uid);
  else if (userEd && !P[uid].junior) hooks.note(`${userEd.name}: only juniors can enter.`);
  for (const ed of eds.filter(e => e.jl === 750)) { // Junior Finals: the top eight juniors
    ed.md = (S.jorder ?? []).filter(id => P[id].junior && hooks.avail(P[id], wk) && hooks.free(P[id], wk) && (id !== uid || userEd === ed)).slice(0, 8);
    for (const id of ed.md) { P[id].commit[wk] = ed.id; lock(ed, id); }
    if (ed.md.includes(uid)) hooks.open(ed, 'MD', 'top eight in the junior ranking'); else if (userEd === ed) { hooks.open(ed, 'REJ'); hooks.note(`${ed.name}: only the top eight juniors are invited.`); }
    if (ed.md.length < 8) ed.cancelled = true;
    apps.delete(ed.id);
  }
  const open = eds.filter(e => e.jl !== 750);
  for (const id of S.jorder ?? []) {
    if (id === uid) continue;
    const p = P[id]; if (!p.junior || !hooks.avail(p, wk) || !hooks.free(p, wk)) continue;
    const r = rngOf(S.seed, 'jentry', id, wk), rank = jr(id), mv = minJ(rank);
    if (p.fatigue > 55 || p.consec >= 3 || !r.chance(rank <= 100 ? 0.62 : 0.5)) continue;
    const pro = r.chance(proShare(p, wk) * 0.75);
    let best: Edition | null = null, bv = 0;
    for (const ed of open) {
      if (pro && ed.jl !== 1000) continue; // a pro week instead, unless it is a junior Grand Slam
      if ((ed.jl ?? 30) < mv && ed.jl !== 1000) continue;
      if (ed.jl === 1000 && rank > JCUTS[1000][1] * 1.2) continue;
      const tc = travelClass(p.country, ed.country), v = JVAL[ed.jl ?? 30] * (tc === 0 ? 1 : tc === 1 ? 0.75 : 0.45) * r.range(0.8, 1.2) * (ed.jl === 1000 ? 2 : 1);
      if (v > bv) { bv = v; best = ed; }
    }
    if (best) apps.get(best.id)!.push(id);
  }
  for (const ed of open) {
    const list = apps.get(ed.id)!.sort((a, b) => jr(a) - jr(b) || P[b].pot! - P[a].pot!);
    const direct = list.slice(0, ed.direct), rest = list.slice(ed.direct);
    const home = rest.filter(id => P[id].country === ed.country && id !== uid).slice(0, ed.wc), wcs = [...home, ...rest.filter(id => !home.includes(id) && id !== uid).slice(0, ed.wc - home.length)];
    const q = rest.filter(id => !wcs.includes(id)).slice(0, ed.qSize);
    ed.md = [...direct, ...wcs]; ed.wcs = wcs; ed.q = q; ed.alt = rest.filter(id => !wcs.includes(id) && !q.includes(id));
    ed.cut = direct.length >= ed.direct ? jr(direct[direct.length - 1]) : 9999; ed.qcut = q.length >= ed.qSize ? jr(q[q.length - 1]) : 9999;
    if (q.length <= ed.qSpots) { ed.quals = q; ed.md.push(...q); ed.q = []; }
    for (const id of [...ed.md, ...ed.q]) { P[id].commit[wk] = ed.id; lock(ed, id); }
    S.memo[ed.series] = { cut: ed.cut, qcut: ed.qcut };
    if (ed.md.length + ed.q.length < 8) ed.cancelled = true;
    if (userEd === ed) {
      if (ed.cancelled) { hooks.open(ed, 'REJ'); hooks.note(`${ed.name}: not held, the field could not be filled.`); }
      else if (direct.includes(uid)) hooks.open(ed, 'MD'); else if (ed.md.includes(uid) || ed.q.includes(uid)) hooks.open(ed, ed.q.includes(uid) ? 'Q' : 'MD');
      else { hooks.open(ed, 'ALT'); hooks.note(`${ed.name}: your junior ranking left you as an alternate.`); }
    }
  }
}
