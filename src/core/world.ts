// World creation: real players from the starting snapshot, generated (fictional) players for the rest of the field,
// the user's player, the ranking ledger and each season's calendar.
import { BALANCE_VERSION, BEST_N, DEV, ECON, ENGINE_VERSION, LEVEL, PEAK_W, SCHEMA_VERSION, START_COND, START_PTS, START_YEAR, STYLE_OFF, WORLD_SIZE, lerpTable } from './balance';
import { Content, RealPlayer, absOf, ageOn, fmtShort, iso, playerId, wkDate, weeksIn } from './content';
import { genName, supportName } from './names';
import { SPEED_MIX, gapAt, jpublish, juniorCalendar, makeJunior, seedJuniorPoints } from './juniors';
import { RNG_VERSION, Rng, clamp, rngOf, uuid } from './rng';
import { ABILITIES, Abil, Ability, Coach, Edition, EvTemplate, Player, ProfileKind, Setup, State, Style, Surface, Tour } from './types';

export const strength = (ab: Abil) => ABILITIES.reduce((t, k) => t + ab[k] * PEAK_W[k], 0);
export function peakIndex(p: Pick<Player, 'ab' | 'fam'>) { return strength(p.ab) + Math.min(2, ((p.fam.hard + p.fam.clay + p.fam.grass) / 300) * 2); }

export function makeAbilities(level: number, style: Style, r: Rng): Abil {
  const ab = {} as Abil;
  for (const k of ABILITIES) ab[k] = level + STYLE_OFF[style][k] + r.normal(0, 1.8);
  const shift = level - strength(ab);
  for (const k of ABILITIES) ab[k] = clamp(ab[k] + shift, 20, 99);
  return ab;
}
const CLAY = new Set('ESP ARG ITA CHI BRA POR BOL PER COL ECU URU PAR AUT ROU SRB'.split(' '));
const GRASS = new Set('GBR AUS NZL'.split(' '));
function famFor(country: string, level: number, r: Rng): Record<Surface, number> {
  const exp = clamp((level - 55) / 2.2, 0, 16);
  const base = CLAY.has(country) ? [48, 62, 36] : GRASS.has(country) ? [55, 40, 54] : [58, 45, 40];
  return { hard: clamp(base[0] + exp + r.range(-4, 4), 0, 100), clay: clamp(base[1] + exp + r.range(-4, 4), 0, 100), grass: clamp(base[2] + exp + r.range(-4, 4), 0, 100) };
}
function basePlayer(id: string, name: string, country: string, born: string, hand: 'R' | 'L', tour: Tour, real: boolean, ab: Abil, style: Style, r: Rng, year: number): Player {
  const lvl = strength(ab);
  return {
    id, name, country, born, hand, tour, real, ab, ceil: { ...ab }, lr: r.range(0.85, 1.2), curve: r.int(-1, 1), resil: r.range(0.8, 1.2), injSus: r.range(0.8, 1.25), declineAge: r.int(29, 32), style,
    fam: famFor(country, lvl, r), fatigue: r.range(8, 24), strain: r.range(4, 18), sharp: 60, conf: 50, morale: 60, injuredUntil: 0, commit: {}, consec: 0, lastWk: -9,
    res: [], debut: year, titles: 0, majors: 0, bestRank: 9999,
  };
}
function setCeil(p: Player, age: number, r: Rng, potential?: number) {
  for (const k of ABILITIES) {
    const room = potential !== undefined ? Math.max(0.5, potential - strength(p.ab) + r.normal(0, 3)) : age <= 20 ? r.range(4, 12) : age <= 22 ? r.range(2, 8) : age <= 24 ? r.range(1, 4) : r.range(0, 1.5);
    p.ceil[k] = clamp(p.ab[k] + room, p.ab[k], 99);
  }
}
const STYLES: [Style, number][] = [['B', 0.35], ['C', 0.25], ['A', 0.2], ['S', 0.17], ['N', 0.03]];
const pickStyle = (r: Rng) => r.weighted(STYLES, s => s[1])[0];

export function newcomer(S: State, r: Rng, taken: Set<string>, year: number): Player {
  const { name, country } = genName(r, S.tour, undefined, taken);
  const age = r.int(17, 20), level = r.range(43, 53);
  const born = `${year - age}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`;
  const p = basePlayer(`${S.tour}:g${S.nextPid++}`, name, country, born, r.chance(0.11) ? 'L' : 'R', S.tour, false, makeAbilities(level, pickStyle(r), r), 'B', r, year);
  p.style = pickStyle(r);
  const roll = r.next();
  const pot = roll < 0.035 ? r.range(92, 99) : roll < 0.1 ? r.range(83, 92) : roll < 0.3 ? r.range(72, 82) : r.range(56, 72);
  setCeil(p, age, r, pot); p.lr = pot > 88 ? r.range(1.15, 1.4) : pot > 80 ? r.range(1.0, 1.25) : r.range(0.8, 1.1);
  p.sharp = 55; p.fatigue = 10; p.strain = 5;
  return p;
}

export const JCOHORT = 100; // juniors per birth year, per tour
/** Builds a junior's player record at a given level (used by the junior pool and the yearly cohorts). */
export function juniorMaker(id: string, name: string, country: string, born: string, level: number, style: Style, r: Rng): Player {
  const p = basePlayer(id, name, country, born, r.chance(0.11) ? 'L' : 'R', 'atp', false, makeAbilities(level, style, r), style, r, +born.slice(0, 4) + 14);
  return p;
}

export interface DrawCfg { qSpots: number; qSize: number; wc: number; direct: number; bracket: number }
export function drawCfg(e: EvTemplate): DrawCfg {
  const d = e.draw, bracket = d > 64 ? 128 : d > 32 ? 64 : d > 8 ? 32 : 8;
  if (e.band === 'F') return { qSpots: 0, qSize: 0, wc: 0, direct: 8, bracket };
  let q: number, mult: number, wc: number;
  if (e.band === 'GS') { q = 16; mult = 8; wc = 8; }
  else if (e.band === 'EP') { q = 8; mult = 8; wc = 2; }
  else if (e.band === 'UL' || e.band === 'SL') { q = 6; mult = 4; wc = 3; }
  else { q = d >= 96 ? 12 : d >= 56 ? 7 : d >= 48 ? 6 : 4; mult = 4; wc = d >= 96 ? 5 : d >= 48 ? 4 : 3; }
  return { qSpots: q, qSize: q * mult, wc, direct: d - q - wc, bracket };
}
export function buildCalendar(c: Content, tour: Tour, year: number): Edition[] {
  const slams = c.events[tour].filter(t => t.slam).map(t => ({ slam: t.slam!, week: t.week, surface: t.surface, city: t.city, country: t.country, name: t.name }));
  return [...proCalendar(c, tour, year), ...juniorCalendar(tour, year, slams)].sort((a, b) => a.startWk - b.startWk);
}
function proCalendar(c: Content, tour: Tour, year: number): Edition[] {
  return c.events[tour].map(t => {
    const startWk = absOf(year, t.week), cfg = drawCfg(t);
    const sunday = t.slam === 'ao' || t.slam === 'rg' || t.slam === 'uso' || t.band === 'F';
    const d0 = wkDate(startWk, sunday ? -1 : 0), d1 = wkDate(startWk + t.weeks - 1, 6);
    const dates = year === START_YEAR && t.dates ? t.dates : `${fmtShort(d0)} – ${fmtShort(d1)}`;
    return { ...t, id: `${t.series}:${year}`, year, startWk, entryWk: t.band === 'GS' ? startWk - 1 : startWk, qSpots: cfg.qSpots, qSize: cfg.qSize, wc: cfg.wc, direct: cfg.direct, dates, md: [], q: [], alt: [], wcs: [], quals: [] };
  }).sort((a, b) => a.startWk - b.startWk);
}

// ---- rankings (spec 13.1): best 18 unexpired results plus Finals points ----
export function countedOf(p: Player, wk: number): number[] {
  const xs: number[] = []; let fin = 0;
  for (const rec of p.res) if (rec.exp > wk) { if (rec.cls === 'f') fin += rec.pts; else xs.push(rec.pts); }
  xs.sort((a, b) => b - a); xs.length = Math.min(xs.length, BEST_N);
  if (fin) xs.unshift(fin + 0.0001); // Finals record is an extra eligible record
  return xs;
}
export function publish(S: State, count = false) {
  const wk = S.wk, rows: { id: string; pts: number; xs: number[]; n: number }[] = [];
  S.race = {};
  for (const id of S.active) {
    const p = S.players[id];
    if (p.res.some(r => r.exp <= wk)) p.res = p.res.filter(r => r.exp > wk);
    const xs = countedOf(p, wk); let pts = 0; for (const x of xs) pts += x;
    rows.push({ id, pts: Math.round(pts), xs, n: p.res.length });
    let race = 0; for (const r of p.res) if (r.yr === S.year && r.cls !== 'bg') race += r.pts;
    if (race) S.race[id] = race;
  }
  rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    for (let i = 0; i < BEST_N; i++) { const d = (b.xs[i] ?? 0) - (a.xs[i] ?? 0); if (d) return d; }
    if (a.n !== b.n) return a.n - b.n;
    return a.id < b.id ? -1 : 1;
  });
  S.rank = {}; S.pts = {}; S.order = rows.map(r => r.id);
  rows.forEach((r, i) => { S.rank[r.id] = i + 1; S.pts[r.id] = r.pts; const p = S.players[r.id]; if (i + 1 < p.bestRank && r.pts > 0) p.bestRank = i + 1; });
  if (count) { const top = S.order[0]; S.world.no1[top] = (S.world.no1[top] ?? 0) + 1; }
  jpublish(S);
}
function seedResults(p: Player, pts: number, r: Rng, n?: number) {
  if (pts <= 0) return;
  const k = n ?? clamp(Math.round(4 + pts / 40), 4, 16);
  const weeks = r.shuffle(Array.from({ length: 49 }, (_, i) => i + 1)).slice(0, k);
  const w = weeks.map(() => 1 + 4 * r.next() ** 3), tot = w.reduce((a, b) => a + b, 0);
  let given = 0;
  weeks.forEach((wk, i) => { const x = i === k - 1 ? pts - given : Math.max(1, Math.round((pts * w[i]) / tot)); given += x; if (x > 0) p.res.push({ ed: `pre:${wk}`, pts: x, exp: wk + 1, yr: START_YEAR - 1, cls: 'bg' }); });
}

function realToPlayer(rp: RealPlayer, tour: Tour, r: Rng): Player {
  const level = lerpTable(LEVEL[tour], rp.rank) + r.normal(0, 0.6);
  const style = rp.style ?? pickStyle(r);
  const p = basePlayer(playerId(tour, rp.name), rp.name, rp.country, `${rp.year}-07-01`, rp.hand, tour, true, makeAbilities(level, style, r), style, r, START_YEAR);
  p.bornApprox = true;
  const age = START_YEAR - rp.year;
  setCeil(p, age, r);
  if (rp.rank <= 2) { p.lr = 1.25; p.resil = 1.15; p.injSus = 0.85; }
  if (age >= p.declineAge) p.declineAge = Math.max(p.declineAge, Math.min(age, 36) - 1);
  if (rp.outUntil) { p.injuredUntil = rp.outUntil; p.sharp = 35; }
  return p;
}
// Each coach has a persona with a speciality: the ability (or physical side) their sessions develop fastest.
const PERSONAS: [string, Coach['spec'] | 'stroke'][] = [['patient technician', 'stroke'], ['former tour player', 'comp'], ['fitness-minded mentor', 'physical'], ['tactical analyst', 'ret'], ['old-school disciplinarian', 'end'], ['serve specialist', 'serve'], ['net-play enthusiast', 'net'], ['movement coach', 'move']];
const LEGEND_PERSONAS = ['former world No. 2', 'former major champion', 'former world No. 4', 'renowned academy founder', 'former Davis Cup captain'];
export const COACH_TIER_NAME: Record<Coach['tier'], string> = { starter: 'Starter', tour: 'Tour', elite: 'Elite', master: 'World-class', legend: 'Legendary' };
export function makeCoach(r: Rng, tier: Coach['tier'], country: string, year: number, style: Style): Coach {
  const dev = { starter: [0.86, 0.92], tour: [0.95, 1.01], elite: [1.04, 1.1], master: [1.12, 1.18], legend: [1.2, 1.26] }[tier];
  const cost = { starter: [200, 450], tour: [600, 1200], elite: [1400, 2200], master: [2800, 4500], legend: [6000, 9500] }[tier];
  const st = r.chance(tier === 'legend' ? 0.35 : 0.5) ? style : pickStyle(r);
  const [persona0, sp] = r.pick(PERSONAS), spec = sp === 'stroke' ? (r.chance(0.5) ? 'fh' : 'bh') : sp;
  const persona = tier === 'legend' ? r.pick(LEGEND_PERSONAS) : persona0;
  const recovery = sp === 'physical' ? r.range(0.75, 1) : persona0 === 'old-school disciplinarian' ? r.range(0.2, 0.45) : r.range(0.3, 1);
  return { id: `c${Math.floor(r.next() * 1e9)}`, name: `${supportName(r, r.chance(0.6) ? country : 'USA', r.chance(0.25))} (${persona})`, tier, dev: Math.round(r.range(dev[0], dev[1]) * 1000) / 1000, recovery: Math.round(recovery * 100) / 100, style: st, fit: st === style ? 0.05 : r.range(-0.05, 0.03), cost: r.int(cost[0], cost[1]), since: year, until: year, trust: tier === 'legend' ? 45 : 55, spec: spec as Coach['spec'], persona };
}

export function createCareer(setup: Setup, c: Content, nowUtc: string): State {
  const seed = setup.seed, tour = setup.tour, r = rngOf(seed, 'world');
  const S: State = {
    v: { schema: SCHEMA_VERSION, engine: ENGINE_VERSION, balance: BALANCE_VERSION, content: c.version, rng: RNG_VERSION },
    careerId: uuid(rngOf(seed, 'career', nowUtc)), seed, tour, userId: '', createdUtc: nowUtc, rev: 0, seq: 0,
    wk: 0, year: START_YEAR, week: 0, block: 0, phase: 'plan', players: {}, active: [], rank: {}, pts: {}, race: {}, order: [],
    cal: buildCalendar(c, tour, START_YEAR), memo: {}, bandMemo: {}, u: null as any,
    world: { champs: [], yearEnd: {}, no1: {}, retired: [], rookies: {} }, ledger: [], nextPid: 1,
  };
  const taken = new Set<string>(c.players[tour].map(p => p.name));
  const byRank = new Map<number, Player>(); const ptsOf = new Map<string, number>();
  for (const rp of c.players[tour]) { const p = realToPlayer(rp, tour, rngOf(seed, 'real', rp.name)); byRank.set(rp.rank, p); ptsOf.set(p.id, rp.pts ?? Math.round(lerpTable(START_PTS[tour], rp.rank))); }
  for (let rank = 1; rank <= WORLD_SIZE; rank++) {
    if (byRank.has(rank)) continue;
    const { name, country } = genName(r, tour, undefined, taken);
    const ageRoll = r.next(), age = ageRoll < 0.25 ? r.int(18, 21) : ageRoll < 0.65 ? r.int(22, 26) : ageRoll < 0.92 ? r.int(27, 31) : r.int(32, 35);
    const level = lerpTable(LEVEL[tour], rank) + r.normal(0, 1.2), style = pickStyle(r);
    const born = `${START_YEAR - age}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`;
    const p = basePlayer(`${tour}:g${S.nextPid++}`, name, country, born, r.chance(0.11) ? 'L' : 'R', tour, false, makeAbilities(level, style, r), style, r, START_YEAR - Math.max(1, age - 18));
    const pot = age < 27 ? Math.max(level + 1, r.normal(level + (27 - age) * 1.5, 5)) : level + r.range(0, 2);
    setCeil(p, age, r, Math.min(96, pot));
    byRank.set(rank, p); ptsOf.set(p.id, Math.round(lerpTable(START_PTS[tour], rank)));
  }
  // monotonic starting points
  let prev = Infinity;
  for (let rank = 1; rank <= WORLD_SIZE; rank++) { const p = byRank.get(rank)!; const x = Math.min(prev, ptsOf.get(p.id)!); prev = x; S.players[p.id] = p; S.active.push(p.id); seedResults(p, x, rngOf(seed, 'pre', p.id)); }

  // ---- the junior world: five birth years of juniors, aged 14 to 18 in the first season ----
  const jr = rngOf(seed, 'juniors');
  for (let by = START_YEAR - 18; by <= START_YEAR - 14; by++) for (let i = 0; i < JCOHORT; i++) { const p = makeJunior(S, jr, taken, by, juniorMaker); S.players[p.id] = p; S.active.push(p.id); }

  // ---- the user's player (spec 3) ----
  const ur = rngOf(seed, 'user');
  const selected = setup.profile !== 'unknown';
  const roll = ur.next();
  const kind: ProfileKind = selected ? (setup.profile as ProfileKind) : roll < DEV.mix.goat ? 'goat' : roll < DEV.mix.goat + DEV.mix.contender ? 'contender' : 'grinder';
  const ab = {} as Abil; const tech: Ability[] = ['serve', 'ret', 'fh', 'bh', 'net', 'comp'];
  for (const k of ABILITIES) ab[k] = k === 'move' || k === 'end' ? ur.range(46, 60) : ur.range(39, 54);
  ab[setup.skills[0]] += 4; ab[setup.skills[1]] += 2;
  const others = tech.filter(k => k !== setup.skills[0] && k !== setup.skills[1]);
  for (let i = 0; i < 6; i++) ab[others[i % others.length]] -= 1;
  for (const k of ABILITIES) ab[k] = k === 'move' || k === 'end' ? clamp(ab[k], 42, 64) : clamp(ab[k], 35, 58);
  const budget = 8 * 50.5, sum = ABILITIES.reduce((t, k) => t + ab[k], 0); // same starting budget for every profile
  for (const k of ABILITIES) ab[k] = k === 'move' || k === 'end' ? clamp(ab[k] + (budget - sum) / 8, 42, 64) : clamp(ab[k] + (budget - sum) / 8, 35, 58);
  const style: Style = setup.skills[0] === 'serve' ? (setup.skills[1] === 'net' ? 'N' : 'S') : setup.skills[0] === 'net' ? 'A' : setup.skills[0] === 'ret' || setup.skills[0] === 'move' || setup.skills[0] === 'end' ? 'C' : setup.skills[0] === 'comp' ? 'A' : 'B';
  const junior = setup.start === 'junior', startAge = junior ? 16 : 19, md = `${String(setup.birthMonth).padStart(2, '0')}-${String(setup.birthDay).padStart(2, '0')}`;
  const born = `${START_YEAR - startAge}-${md}`;
  const bornFixed = ageOn(born, new Date(Date.UTC(START_YEAR, 0, 1))) === startAge ? born : `${START_YEAR - startAge - 1}-${md}`;
  const up = basePlayer(`user:${S.careerId}`, setup.name, setup.country, bornFixed, setup.hand, tour, false, ab, style, ur, START_YEAR);
  up.user = true;
  const [c0, c1] = DEV.ceil[kind], idx = ur.range(c0, c1);
  const speed = !junior ? undefined : setup.speed && setup.speed !== 'unknown' ? setup.speed : ur.weighted(SPEED_MIX, s => s[1])[0];
  if (junior) { // a 16-year-old: further from the ceiling, by how fast this player develops
    const target = clamp(idx - gapAt(speed!, 16.5, idx) + ur.normal(0, 1.5), 39, 50), shift = target - strength(ab);
    for (const k of ABILITIES) ab[k] = clamp(ab[k] + shift, 25, 70);
    up.ab = { ...ab }; up.junior = true; up.jres = []; up.jtitles = 0; up.speed = speed; up.pot = idx; up.debut = START_YEAR + 2;
  }
  for (const k of ABILITIES) up.ceil[k] = clamp(idx + (k === setup.skills[0] ? 3 : k === setup.skills[1] ? 1.5 : 0) + ur.normal(0, 3) - (k === 'net' ? 5 : 0), Math.max(ab[k] + 8, idx - 10), 99);
  up.lr = ur.range(DEV.lr[kind][0], DEV.lr[kind][1]); up.curve = ur.int(-3, 3); up.resil = ur.range(0.85, 1.2); up.injSus = ur.range(0.8, 1.2); up.declineAge = ur.int(29, 32);
  up.fam = setup.focusSurface === 'all' ? { hard: 50, clay: 50, grass: 50 } : { hard: 35, clay: 35, grass: 35, [setup.focusSurface]: 65 } as any;
  Object.assign(up, START_COND);
  if (!junior) seedResults(up, ur.int(8, 18), ur, ur.int(4, 8));
  S.players[up.id] = up; S.active.push(up.id); S.userId = up.id;

  // exceptional contemporaries for a GOAT-contention career (spec 3.4)
  if (kind === 'goat') {
    const n = ur.int(2, 3), pool = S.active.map(id => S.players[id]).filter(p => !p.real && !p.user), uy = +up.born.slice(0, 4);
    for (let i = 0; i < n; i++) {
      const cand = ur.pick(pool.filter(p => { const a = START_YEAR - +p.born.slice(0, 4); return junior ? !!p.junior && Math.abs(+p.born.slice(0, 4) - uy) <= 1 && (p.pot ?? 0) < 90 : a >= 18 && a <= 21 && strength(p.ab) < 66 && strength(p.ceil) < 90; }));
      if (!cand) break;
      const target = ur.range(92, 98);
      for (const k of ABILITIES) cand.ceil[k] = clamp(target + ur.normal(0, 3) - (k === 'net' ? 5 : 0), cand.ab[k] + 6, 99);
      cand.lr = ur.range(1.15, 1.4); cand.curve = ur.int(-2, 2); if (cand.junior) cand.pot = target;
    }
  }
  const coach = makeCoach(rngOf(seed, 'coach0'), 'starter', setup.country, START_YEAR, style);
  S.u = {
    profile: kind, profileSelected: selected, focusSurface: setup.focusSurface, skills: setup.skills, pronouns: setup.pronouns, avatar: setup.avatar,
    cash: ECON.startCash, ledger: [], coach, coachHistory: [], sponsors: [], sponsorHistory: [], injuries: [], choices: [], tourneys: [], matches: [], attr: [], snaps: [], seasons: [], ach: [],
    rankHist: [], pol: { detail: setup.detail, intensity: 'normal', focus: 'balanced', priority: 'prep', fallback: 'nearest', adult: setup.adult },
    rel: { coach: 55, agent: 50, friend: 55, partner: null }, startAb: { ...ab }, startRank: 0, portrait: setup.portrait, evSeen: {}, follow: [], blockMods: {}, devYear: { comp: 0, train: 0 }, injWeeksYear: 0, no1Weeks: 0, hardship: 0, lastOfferYear: START_YEAR, rivals: [],
  };
  if (junior) Object.assign(S.u, { stage: 'junior', academy: setup.academy ?? 'club', jstart: true, college: [] });
  seedJuniorPoints(S, rngOf(seed, 'jseed'));
  const cr = rngOf(seed, 'cast'); (S.u.rel as any).friendName = supportName(cr, setup.country, cr.chance(0.5)).split(' ')[0]; (S.u.rel as any).agentName = supportName(cr, cr.chance(0.5) ? setup.country : 'USA', cr.chance(0.4));
  publish(S);
  S.u.startRank = S.rank[up.id];
  S.ledger.push({ seq: S.seq++, wk: 0, date: iso(new Date(Date.UTC(START_YEAR, 0, 1))), type: 'CareerCreated', cmd: 'create', data: { profile: selected ? kind : 'unknown', startRank: S.u.startRank } });
  return S;
}
export const userOf = (S: State) => S.players[S.userId];
export const ageOf = (S: State, p: Player) => ageOn(p.born, wkDate(S.wk));
export const curDate = (S: State) => iso(wkDate(S.wk));
export { weeksIn };
