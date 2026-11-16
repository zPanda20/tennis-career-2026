// Weekly development, loads, recovery, health and money, plus the year-end turnover (spec 5–7, 10, 11, 14.4, 15).
import { yearEndNews } from './news';
import { isJuniorAge, makeJunior, speedFactor } from './juniors';
import { JCOHORT, juniorMaker } from './world';
import { WORLD_SIZE } from './balance';
import { academyMult, prospectRead, stageMoney } from './path';
import { PRODIGY_TIER, TIER_ORDER, breakout, prodigyCoach, youthCoachAmp } from './prodigy';
import type { PathDecision } from './types';
import { homeOf, injuryMult, lifestyleMonthly, lifestyleWeek, livingMonthly, trainMult } from './lifestyle';
import { ensureGoals, failGoals } from './goals';
import { DEV, ECON, HEALTH, RECOVERY, RETIRE_AGE, TRAIN } from './balance';
import { Content, ageOn, iso, travelClass, wkDate } from './content';
import { BRANDS } from './names';
import { clamp, rngOf } from './rng';
import { achieve, addLedger, logEv, note } from './tour';
import { ABILITIES, Ability, Coach, Injury, Player, Season, Sponsor, State } from './types';
import { ABILITY_NAMES } from './types';
import { ageOf, buildCalendar, makeCoach, newcomer, publish, strength, weeksIn } from './world';

function ageFactor(age: number, curve: number) { const a = age - curve; for (const [lim, f] of DEV.age) if (a <= lim) return f; return 0.1; }
const LOCS: [string, Ability[], number][] = [['shoulder', ['serve'], 1.2], ['elbow', ['serve', 'fh'], 0.8], ['wrist', ['fh', 'bh'], 1], ['back', ['serve', 'move'], 1.1], ['hip', ['move'], 0.8], ['knee', ['move', 'end'], 1.2], ['ankle', ['move'], 1.2]];
const SEV = ['minor', 'moderate', 'major', 'severe'] as const;

export function injure(S: State, p: Player, kind: Injury['kind'], fromMatch = false) {
  const wk = S.wk, r = rngOf(S.seed, 'inj', p.id, wk, fromMatch ? 1 : 0);
  const dist = fromMatch ? [0.55, 0.35, 0.085, 0.015] : HEALTH.sev; let x = r.next(), si = 0;
  while (si < 3 && x > dist[si]) { x -= dist[si]; si++; }
  if (kind === 'illness' && si > 1) kind = 'overuse';
  const sev = SEV[si];
  const weeks = si === 0 ? (r.chance(0.7) ? 1 : 2) : si === 1 ? r.int(2, 6) : si === 2 ? r.int(9, 26) : r.int(26, 52);
  const loc = kind === 'illness' ? null : r.weighted(LOCS, l => l[2] * (p.style === 'S' && l[0] === 'shoulder' ? 1.5 : 1) * (p.style === 'C' && (l[0] === 'knee' || l[0] === 'ankle') ? 1.4 : 1));
  let perm: { ab: Ability; loss: number }[] | undefined;
  if (loc && ((si === 2 && r.chance(HEALTH.permMajor)) || (si === 3 && r.chance(HEALTH.permSevere)))) {
    const total = r.int(1, 4); perm = [];
    const abs = loc[1]; let left = total;
    for (let i = 0; i < abs.length && left > 0; i++) { const loss = i === abs.length - 1 ? left : Math.max(1, Math.round(left / 2)); perm.push({ ab: abs[i], loss }); left -= loss; }
    for (const { ab, loss } of perm) { p.ab[ab] = Math.max(20, p.ab[ab] - loss); p.ceil[ab] = Math.max(p.ab[ab], p.ceil[ab] - loss); }
  }
  p.injuredUntil = wk + 1 + weeks; p.strain *= 0.6; p.sharp = Math.max(25, p.sharp - 6);
  for (const k of Object.keys(p.commit)) if (+k > wk && +k < p.injuredUntil) delete p.commit[+k];
  if (!p.user) return;
  const u = S.u, name = loc ? loc[0] : 'general illness';
  const inj: Injury = {
    id: `inj-${wk}-${u.injuries.length}`, wk, year: S.year, date: iso(wkDate(wk)), loc: name, kind, sev, estMin: Math.max(1, Math.round(weeks * 0.7)), estMax: Math.round(weeks * 1.4) + 1, weeks, rehab: 'conservative', perm,
    desc: kind === 'illness' ? 'An illness that needs rest before a return to full training.' : `${fromMatch ? 'An acute' : kind === 'overuse' ? 'An overuse' : 'An acute'} ${name} injury${fromMatch ? ' sustained during a match' : kind === 'overuse' ? ' that built up under sustained load' : ' picked up in training'}.`,
  };
  u.injuries.push(inj); S.sumAcc?.injuries.push(inj.id);
  logEv(S, 'InjuryOccurred', { id: inj.id, sev, loc: name, weeks });
  note(S, `${sev[0].toUpperCase() + sev.slice(1)} ${name === 'general illness' ? 'illness' : name + ' injury'}: expected absence ${inj.estMin} to ${inj.estMax} weeks.${perm ? ' The assessment found lasting damage.' : ''}`);
  if (perm) for (const { ab, loss } of perm) u.attr.push({ wk, year: S.year, ab, from: p.ab[ab] + loss, to: p.ab[ab], cause: 'injury', note: `${name} injury` });
  if (S.plan) for (const k of Object.keys(S.plan.weeks)) if (+k > wk && +k < p.injuredUntil) { delete S.plan.weeks[+k]; }
  const serious = u.injuries.filter(i => i.sev === 'major' || i.sev === 'severe').length, lost = u.injuries.reduce((t, i) => t + (i.perm?.reduce((a, b) => a + b.loss, 0) ?? 0), 0);
  if (sev === 'severe' && serious >= 3 && lost >= 8 && ageOf(S, p) >= 30) {
    S.pending = { type: 'forcedRetire', injury: inj.id, text: `This is your ${serious === 3 ? 'third' : 'latest'} serious injury, and the medical assessment is clear: the accumulated damage (${lost} points of lasting ability loss) means a return to professional competition is not advised. Your career ends here on health grounds.` };
    S.phase = 'interrupt';
  } else if (si >= 2 || (u.pol.detail === 'detailed' && si >= 1)) { S.pending = { type: 'injury', injury: inj.id }; S.phase = 'interrupt'; }
}

function develop(S: State, p: Player, played: boolean) {
  const isU = !!p.user, u = S.u, age = ageOf(S, p), af = ageFactor(age, p.curve) * speedFactor(p.speed, age) * (isU ? academyMult(S) : 1);
  const health = (p.fatigue > 75 ? 0.6 : 1) * (p.strain > 70 ? 0.7 : 1);
  const nr = S.rank[p.id] ?? 999;
  let coach = nr <= 60 ? 1.15 : nr <= 250 ? 1.08 : 1, inten = 1, prio = 1; // background players have coaching in line with their level
  if (isU) {
    coach = u.coach.dev + u.coach.fit + (u.rel.coach - 50) / 1000; if (coach > 1) coach = 1 + (coach - 1) * youthCoachAmp(age); inten = TRAIN[u.pol.intensity].opp;
    prio = (u.pol.priority === 'prep' ? 1.1 : u.pol.priority === 'recovery' ? 0.8 : u.pol.priority === 'professional' ? 0.9 : 1) * (p.morale < 35 ? 0.9 : 1) * (u.blockMods.train ?? 1) * (1 - 0.008 * ((u as any).appear ?? 0));
  }
  const base = af * p.lr * coach * health;
  const ce = Math.min(1, (p.wkCredit ?? 0) / 1.3);
  const comp = DEV.baseComp * ce * base, train = DEV.trainPool * inten * (played ? DEV.matchWeekTrain : 1) * prio * base;
  const focus = isU ? u.pol.focus : 'balanced';
  for (const k of ABILITIES) {
    const h = clamp((p.ceil[k] - p.ab[k]) / DEV.headroomDiv, 0, 1); if (h <= 0) continue;
    let wc = DEV.use[k];
    if (p.wkSurf === 'clay' && k === 'move') wc += 0.03; if (p.wkSurf === 'grass' && (k === 'serve' || k === 'net')) wc += 0.025;
    let wt = DEV.use[k] * (isU ? trainMult(S, k) : 1);
    if (focus !== 'balanced' && focus !== 'surface') wt = focus === 'physical' ? (k === 'move' || k === 'end' ? 0.35 : 0.05) : k === focus ? 0.55 + 0.45 * DEV.use[k] : 0.45 * DEV.use[k];
    if (focus === 'surface') wt *= 0.6;
    const g1 = comp * wc * h * 8 / 8, g2 = train * wt * h, g = Math.min(g1 + g2, p.ceil[k] - p.ab[k]);
    if (g <= 0) continue;
    p.ab[k] += g;
    if (isU) { const acc = ((u as any).devAcc ??= {}); acc[`${k}:competition`] = (acc[`${k}:competition`] ?? 0) + g * (g1 / (g1 + g2)); acc[`${k}:training`] = (acc[`${k}:training`] ?? 0) + g * (g2 / (g1 + g2)); u.devYear.comp += g * (g1 / (g1 + g2)); u.devYear.train += g * (g2 / (g1 + g2)); }
  }
  if (isU && focus === 'surface' && u.pol.surfacePrep) p.fam[u.pol.surfacePrep] = Math.min(100, p.fam[u.pol.surfacePrep] + (played ? 0.4 : 1.2));
}

export function weeklyUpkeep(S: State) {
  const wk = S.wk, u = S.u;
  for (const id of S.active) {
    const p = S.players[id], isU = !!p.user, played = (p.wkMatches ?? 0) > 0, injured = p.injuredUntil > wk;
    if (injured) { p.fatigue = Math.max(0, p.fatigue - 12); p.strain = Math.max(0, p.strain - 3); p.sharp = Math.max(25, p.sharp - 5); p.consec = 0; if (isU) u.injWeeksYear++; }
    else {
      develop(S, p, played);
      const it = isU ? TRAIN[u.pol.intensity] : p.fatigue > 45 ? TRAIN.relaxed : TRAIN.normal, share = played ? 0.35 : 1;
      p.fatigue += it.fat * share; p.strain += it.strain * share + (played ? 1.5 + (p.consec >= 2 ? 1.5 : 0) : 0);
      const extra = RECOVERY.extra * (p.ab.end / 100) * (isU ? 0.7 + 0.3 * u.coach.recovery : 0.85), pr = isU ? u.pol.priority : 'prep';
      if (played) { p.fatigue -= RECOVERY.matchWeekFat + extra * 0.5; p.strain -= 1; }
      else {
        p.fatigue -= RECOVERY.fat + extra + (pr === 'recovery' ? 8 : 0) + (isU ? (u.blockMods.recov ?? 0) : 0); p.strain -= RECOVERY.strain + (pr === 'recovery' ? 1 : 0);
        p.sharp = Math.max(35, p.sharp - (pr === 'prep' && isU ? 1.5 : 3)); p.conf += p.conf > 50 ? -0.5 : p.conf < 50 ? 0.5 : 0;
      }
      if (isU) {
        if (played) { const ed = S.cal.find(e => e.id === p.commit[wk]), tc = ed ? travelClass(homeOf(S), ed.country) : 0; if (tc === 2) { p.fatigue += 3; p.strain += 1; } else if (tc === 1) p.fatigue += 1; }
        lifestyleWeek(S, played);
        if (pr === 'social') { p.morale += 0.6; p.sharp -= 0.4; } else if (pr === 'relationship') { p.morale += 0.4; u.rel.friend = Math.min(100, u.rel.friend + 0.5); if (u.rel.partner !== null) u.rel.partner = Math.min(100, u.rel.partner + 0.7); }
        else if (pr === 'professional') { p.fatigue += 1; u.rel.agent = Math.min(100, u.rel.agent + 0.4); } else if (pr === 'prep') { p.morale -= p.morale > 45 ? 0.35 : 0; }
        p.morale += p.morale < 55 ? 0.3 : 0;
      }
      p.consec = played ? p.consec + 1 : 0;
      p.fatigue = clamp(p.fatigue, 0, 100); p.strain = clamp(p.strain, 0, 100); p.sharp = clamp(p.sharp, 0, 100); p.morale = clamp(p.morale, 0, 100);
      // weekly health roll (one roll per player per week; match incidents are rolled separately in the engine)
      let pr2 = HEALTH.base + HEALTH.perFat * Math.max(0, p.fatigue - 40) + HEALTH.perStrain * Math.max(0, p.strain - 30);
      pr2 *= p.injSus / Math.sqrt(p.resil);
      const age = ageOf(S, p); if (age > 31) pr2 *= 1 + (age - 31) * 0.06;
      if (isU) pr2 *= (played ? 1 : it.risk) * (1 - 0.15 * u.coach.recovery) * injuryMult(S);
      if ((p as any).vuln > wk) pr2 *= 1.6;
      const r = rngOf(S.seed, 'health', id, wk);
      if (r.chance(Math.min(HEALTH.cap, pr2))) injure(S, p, p.strain > 45 ? 'overuse' : r.chance(0.3) ? 'illness' : 'acute');
    }
    for (const k of Object.keys(p.commit)) if (+k < wk) delete p.commit[+k];
    p.wkCredit = 0; p.wkMatches = 0;
  }
  // the user's weekly money (spec 11.3/11.4): one ledger for both play settings
  const m = 12 / 52;
  if (S.year === 2026) addLedger(S, 'Starter support', ECON.support * m);
  for (const [lab, amt] of stageMoney(S)) addLedger(S, lab, amt * m);
  addLedger(S, 'Living costs', -livingMonthly(S) * m); addLedger(S, 'Coaching', -u.coach.cost * m);
  const hm = lifestyleMonthly(S); if (hm) addLedger(S, 'Home and staff', -hm * m);
  const sp = u.sponsors.reduce((t, s) => t + s.monthly, 0); if (sp) addLedger(S, 'Sponsorship', sp * m);
  if (u.cash < 0) { addLedger(S, 'Basic support scheme', -u.cash); u.hardship++; }
}

function seasonSummary(S: State): Season {
  const u = S.u, y = S.year, ms = u.matches.filter(m => m.year === y && m.cls !== 'wo'), ts = u.tourneys.filter(t => t.year === y && t.reached && t.reached !== 'WD');
  const order = ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'];
  const majors = ts.filter(t => t.band === 'GS' && !t.reached.startsWith('Q')).map(t => t.reached).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const hist = u.rankHist.filter(h => h.wk >= S.wk - 53);
  const p = S.players[S.userId];
  return {
    year: y, n: u.seasons.length + 1, rank: S.rank[S.userId], pts: S.pts[S.userId], w: ms.filter(m => m.won).length, l: ms.filter(m => !m.won).length, titles: ts.filter(t => t.title).length, finals: ts.filter(t => t.final).length,
    majorsBest: majors[0] ?? (ts.some(t => t.band === 'GS') ? 'Qualifying' : '–'), prize: ts.reduce((a, t) => a + t.prize, 0), injWeeks: u.injWeeksYear, dev: Math.round((u.devYear.comp + u.devYear.train) * 10) / 10,
    devComp: Math.round(u.devYear.comp * 10) / 10, devTrain: Math.round(u.devYear.train * 10) / 10, bestRank: hist.reduce((b, h) => Math.min(b, h.rank), S.rank[S.userId]), events: ts.length, age: ageOf(S, p), no1: S.order[0] === S.userId,
    ...(p.junior ? { jrank: S.jrank?.[S.userId] ?? 9999 } : {}), stage: u.stage,
  };
}
export function flushDev(S: State) {
  const u = S.u, acc = (u as any).devAcc as Record<string, number> | undefined, p = S.players[S.userId]; if (!acc) return;
  for (const k of ABILITIES) {
    const c = acc[`${k}:competition`] ?? 0, t = acc[`${k}:training`] ?? 0; if (c + t < 0.005) continue;
    const to = p.ab[k], mid = to - t, from = mid - c;
    if (c > 0.005) u.attr.push({ wk: S.wk, year: S.year, ab: k, from: Math.round(from * 1000) / 1000, to: Math.round(mid * 1000) / 1000, cause: 'competition' });
    if (t > 0.005) u.attr.push({ wk: S.wk, year: S.year, ab: k, from: Math.round(mid * 1000) / 1000, to: Math.round(to * 1000) / 1000, cause: 'training' });
    if (S.sumAcc) S.sumAcc.dev[k] = (S.sumAcc.dev[k] ?? 0) + c + t;
  }
  (u as any).devAcc = {};
}
/** Sponsor offers come in three shapes, so the choice is a real trade-off:
 *  retainer: big monthly money, small bonuses, many appearance days (less training);
 *  performance: little monthly money, large bonuses for titles at both main-tour and lower-tour level;
 *  loyalty: a signing payment and a long contract at a steady rate. */
export function sponsorOffers(S: State): Sponsor[] {
  const u = S.u, rank = S.rank[S.userId], r = rngOf(S.seed, 'sponsor', S.year), out: Sponsor[] = [];
  const base = rank <= 5 ? r.range(60000, 110000) : rank <= 10 ? r.range(35000, 70000) : rank <= 30 ? r.range(12000, 30000) : rank <= 100 ? r.range(3000, 9000) : rank <= 250 ? r.range(600, 2000) : rank <= 500 ? r.range(150, 500) : rank <= 800 ? r.range(60, 160) : 0;
  if (!base) return out;
  const rep = 1 + (u.rel.agent - 50) / 250, r10 = (n: number) => Math.round(n / 10) * 10;
  for (const slot of ['apparel', 'racket', 'partner'] as const) {
    if (u.sponsors.some(s => s.slot === slot && s.until > S.year)) continue;
    if (slot === 'partner' && rank > 150) continue;
    const share = slot === 'apparel' ? 0.45 : slot === 'racket' ? 0.2 : 0.35, kinds = r.shuffle(['retainer', 'performance', 'loyalty'] as const).slice(0, slot === 'partner' ? 2 : 3), used = new Set<number>();
    for (const kind of kinds) {
      let brand = r.int(0, BRANDS[slot].length - 1); for (let k = 0; used.has(brand) && k < 6; k++) brand = r.int(0, BRANDS[slot].length - 1); if (used.has(brand)) continue; used.add(brand);
      const m0 = base * share * rep * r.range(0.85, 1.15);
      const monthly = r10(kind === 'retainer' ? m0 * 1.4 : kind === 'performance' ? m0 * 0.4 : m0 * 0.95);
      const tourBonus = r10(Math.max(kind === 'performance' ? 400 : 100, kind === 'retainer' ? m0 * 0.5 : kind === 'performance' ? m0 * 4.5 : m0 * 1.3));
      const lowerBonus = r10(Math.max(kind === 'performance' ? 150 : 40, kind === 'retainer' ? m0 * 0.12 : kind === 'performance' ? m0 * 1.6 : m0 * 0.35));
      const years = kind === 'loyalty' ? r.int(3, 4) : kind === 'retainer' ? 2 : r.int(1, 2);
      const appearances = kind === 'retainer' ? r.int(4, 7) : kind === 'performance' ? r.int(0, 1) : r.int(2, 3);
      out.push({ id: `sp-${S.year}-${slot}-${kind}`, kind, slot, brand, name: BRANDS[slot][brand], monthly: Math.max(10, monthly), titleBonus: tourBonus, lowerBonus, signing: kind === 'loyalty' ? r10(m0 * 5) : undefined, appearances, since: S.year + 1, until: S.year + 1 + years });
    }
  }
  return out;
}
export function coachOffers(S: State): Coach[] {
  const u = S.u, rank = S.rank[S.userId], r = rngOf(S.seed, 'coach', S.year), p = S.players[S.userId];
  const tiers: Coach['tier'][] = rank <= 10 ? ['legend', 'master', 'elite'] : rank <= 60 ? ['master', 'elite', 'tour'] : rank <= 150 ? ['elite', 'tour', 'tour'] : rank <= 350 ? ['tour', 'tour', 'starter'] : ['starter', 'tour', 'starter'];
  const out = tiers.map(t => { const c = makeCoach(r, t, p.country, S.year + 1, p.style); c.until = S.year + 1 + r.int(1, 2); return c; }).filter(c => c.tier !== u.coach.tier || c.dev > u.coach.dev - 0.03);
  // a young player ahead of their age also hears from coaches far above their ranking, on prodigy terms
  const b = breakout(S), pt = PRODIGY_TIER[b.level];
  if (pt && TIER_ORDER.indexOf(pt) > TIER_ORDER.indexOf(out[0]?.tier ?? 'starter') && TIER_ORDER.indexOf(pt) >= TIER_ORDER.indexOf(u.coach.tier) && !(u.coach.deal && u.coach.tier === pt)) {
    const c = prodigyCoach(S, pt, `ye${S.year}`); c.since = S.year + 1; c.until = S.year + 2; out.unshift(c);
  }
  return out;
}

/** The user's road from the juniors: the choice at 18, a yearly check-in on the path, and the final call when it ends. */
function pathDecision(S: State, y: number): PathDecision | undefined {
  const u = S.u, me = S.players[S.userId]; if (!u.jstart || u.stage === 'pro') return;
  const rd = prospectRead(S), read = { ...rd, jbest: me.jbest ?? 9999 }, ss = u.seasons.slice(-2);
  const record = ss.map(s => `${s.year}: ${s.w}–${s.l} in matches${s.rank < 9999 && S.pts[S.userId] > 0 ? `, ranked ${s.rank}` : ''}`);
  if (me.jbest) record.unshift(`Best junior ranking: No. ${me.jbest}${me.jtitles ? `, ${me.jtitles} junior title${me.jtitles > 1 ? 's' : ''}` : ''}`);
  for (const c of (u.college ?? []).filter(c => c.year === y)) record.push(`College ${c.year}: ${c.w}–${c.l}${c.ncaa ? `, NCAA singles ${c.ncaa === 'W' ? 'champion' : c.ncaa}` : ''}`);
  if (u.stage === 'junior') return me.junior ? undefined : { kind: 'choose', read, record };
  const left = (u.path?.until ?? y) - y;
  return { kind: left <= 0 ? 'final' : 'review', current: u.path?.kind, yearsLeft: left, read, record };
}

/** Season rollover: summary, world turnover, aging, offers and next year's calendar. */
export function yearEnd(S: State, C: Content) {
  const u = S.u, y = S.year, me = S.players[S.userId];
  publish(S); // final published ranking of the season
  const season = seasonSummary(S); u.seasons.push(season);
  S.world.yearEnd[y] = S.order.slice(0, 100).map(id => ({ id, pts: S.pts[id] }));
  if (season.no1) { achieve(S, `yeNo1`, 'Year-end No. 1'); if (new Set(u.tourneys.filter(t => t.title && t.band === 'GS').map(t => t.series)).size === 4) achieve(S, 'pentagon', 'The Pentagon'); }
  logEv(S, 'SeasonCompleted', { year: y, rank: season.rank, pts: season.pts });
  const endDate = new Date(Date.UTC(y, 11, 31));
  const taken = new Set(Object.values(S.players).map(p => p.name));
  const keep: string[] = [], rookies: string[] = [];
  for (const id of S.active) {
    const p = S.players[id], age = ageOn(p.born, endDate), r = rngOf(S.seed, 'age', id, y), rank = S.rank[id];
    if (age >= p.declineAge) { // spec 15.1: modest annual physical losses, technical later, composure can still improve
      const phys = (r.range(1, 3) * (1 + Math.max(0, age - p.declineAge - 1) * 0.3)) / p.resil, sh = r.range(0.3, 0.7);
      const ch: [Ability, number][] = [['move', -phys * sh], ['end', -phys * (1 - sh)]];
      if (age >= p.declineAge + 3) { const t = r.range(0.6, 2.2) * (1 + Math.max(0, age - p.declineAge - 4) * 0.3); for (const k of ['serve', 'fh', 'bh', 'ret', 'net'] as Ability[]) ch.push([k, -t / 5 * r.range(0.5, 1.5)]); }
      ch.push(['comp', age <= 33 ? r.range(0, 0.5) : -0.2]);
      for (const [k, d] of ch) {
        const from = p.ab[k]; p.ab[k] = clamp(from + d, 20, 99); if (d < 0) p.ceil[k] = Math.min(p.ceil[k], p.ab[k] + 0.5);
        if (p.user && Math.abs(d) > 0.01) u.attr.push({ wk: S.wk, year: y, ab: k, from: Math.round(from * 100) / 100, to: Math.round(p.ab[k] * 100) / 100, cause: 'aging' });
      }
    }
    if (p.user) { keep.push(id); continue; }
    let pr = 0;
    if (age >= RETIRE_AGE) pr = 1; else {
      if (age >= 33) pr += 0.07 * (age - 32); if (rank > 250 && age >= 30) pr += 0.2; if (rank > 600 && age >= 26) pr += 0.22; if (rank > 800 && age >= 23) pr += 0.15;
      if (p.injuredUntil > S.wk + 20 && age >= 32) pr += 0.2;
    }
    if (r.chance(pr)) { p.retired = y; S.world.retired.push({ id, year: y }); } else keep.push(id);
  }
  // juniors who age out graduate into the pro world; the weakest stop playing (quit) instead
  const gr = rngOf(S.seed, 'graduate', y);
  for (const id of keep.slice()) {
    const p = S.players[id]; if (!p.junior || isJuniorAge(p.born, y + 1)) continue;
    p.junior = false; if (p.user) continue;
    const lvl = strength(p.ab), quitP = clamp((58 - lvl) / 20 + ((p.jbest ?? 9999) > 300 ? 0.15 : 0), 0, 0.75);
    if (gr.chance(quitP)) { p.retired = y; p.quit = y; keep.splice(keep.indexOf(id), 1); }
    else rookies.push(id);
  }
  const pros = keep.filter(id => !S.players[id].junior).length, need = Math.max(0, WORLD_SIZE - pros), nr = rngOf(S.seed, 'rookies', y);
  for (let i = 0; i < need; i++) { const p = newcomer(S, nr, taken, y + 1); S.players[p.id] = p; keep.push(p.id); rookies.push(p.id); }
  // a new cohort of 14-year-olds joins the junior circuit
  const cr = rngOf(S.seed, 'cohort', y);
  for (let i = 0; i < JCOHORT; i++) { const p = makeJunior(S, cr, taken, y + 1 - 14, juniorMaker); S.players[p.id] = p; keep.push(p.id); }
  S.active = keep; S.world.rookies[y + 1] = rookies;
  yearEndNews(S, S.world.retired.filter(x => x.year === y).map(x => x.id)); failGoals(S, y);
  // drop retired background players that never met the user to keep saves small
  const met = new Set(u.matches.map(m => m.opp)); const notable = new Set<string>(S.world.champs.flatMap(c => [c.w, c.f ?? '']));
  for (const y2 of Object.values(S.world.yearEnd)) for (const e of y2) notable.add(e.id);
  for (const id of Object.keys(S.players)) { const p = S.players[id]; if (p.retired && !met.has(id) && !notable.has(id) && !p.real) delete S.players[id]; else if (p.retired) { p.res = []; p.commit = {}; } }
  // contracts and offers (batched at the year-end review, spec 17.3)
  u.sponsors = u.sponsors.filter(s => s.until > y + 1);
  S.pending = { type: 'yearEnd', coachOffers: coachOffers(S), sponsorOffers: sponsorOffers(S), path: pathDecision(S, y) };
  flushDev(S);
  u.devYear = { comp: 0, train: 0 }; u.injWeeksYear = 0;
  S.year = y + 1; S.week = 0; S.block = 0;
  S.cal = buildCalendar(C, S.tour, S.year);
  const lastAge = ageOn(me.born, new Date(Date.UTC(y, 11, 31)));
  if (lastAge >= RETIRE_AGE) S.pending = { type: 'forcedRetire', text: `You turned ${RETIRE_AGE} during the ${y} season. The game's age ceiling means no new events are scheduled beyond it, so your career closes with this season.` };
  else if (ageOn(me.born, new Date(Date.UTC(S.year, 11, 31))) >= RETIRE_AGE) u.finalSeasonWarned = true;
  S.phase = 'yearEnd';
  publish(S); if (S.pending.type !== 'forcedRetire') ensureGoals(S);
}
export { strength, weeksIn, ABILITY_NAMES };
