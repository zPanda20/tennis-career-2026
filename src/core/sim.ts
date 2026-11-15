// Commands (spec 18.2, 19.2). Each command is validated, runs once, and appends to the event ledger.
// Randomness derives from stable IDs, so re-running a prepared command after an interruption gives the same result.
import { BLOCKS, ECON, START_YEAR } from './balance';
import { blockWeeks } from './agent';
import { Content, absOf, iso, wkDate, weeksIn } from './content';
import { Fx, evById } from './narrative';
import { supportName } from './names';
import { clamp, rngOf } from './rng';
import { achieve, addLedger, logEv, note, playEvents, runEntries, snapshot } from './tour';
import type { BlockPlan, BlockSummary, Policies, State } from './types';
import { flushDev, weeklyUpkeep, yearEnd } from './upkeep';
import { publish } from './world';
import { weeklyNews } from './news';
import { checkGoals, ensureGoals } from './goals';

export type Command =
  | { id: string; type: 'CommitBlock'; plan: BlockPlan; pol: Policies }
  | { id: string; type: 'ResolveInjury'; rehab: 'conservative' | 'specialist' | 'early' }
  | { id: string; type: 'YearEnd'; coach: string | 'keep'; sponsors: string[]; retire: boolean }
  | { id: string; type: 'Retire' }
  | { id: string; type: 'ChangeDelegation'; pol: Policies }
  | { id: string; type: 'SetPortrait'; data: string | null }
  | { id: string; type: 'SetRival'; opp: string; yes: boolean };

const absBlock = (S: State) => (S.year - START_YEAR) * 4 + S.block;
function applyFx(S: State, fx: Fx): string[] {
  const p = S.players[S.userId], u = S.u, out: string[] = [];
  if (fx.mo) p.morale = clamp(p.morale + fx.mo, 0, 100); if (fx.fa) p.fatigue = clamp(p.fatigue + fx.fa, 0, 100); if (fx.st) p.strain = clamp(p.strain + fx.st, 0, 100);
  if (fx.co) p.conf = clamp(p.conf + fx.co, 0, 100); if (fx.sh) p.sharp = clamp(p.sharp + fx.sh, 0, 100);
  if (fx.$) addLedger(S, fx.$ > 0 ? 'Other income' : 'Personal and professional choices', fx.$);
  if (fx.tr) u.blockMods.train = (u.blockMods.train ?? 1) * fx.tr; if (fx.rc) u.blockMods.recov = (u.blockMods.recov ?? 0) + fx.rc;
  if (fx.ct) { u.rel.coach = clamp(u.rel.coach + fx.ct, 0, 100); u.coach.trust = u.rel.coach; } if (fx.fr) u.rel.friend = clamp(u.rel.friend + fx.fr, 0, 100); if (fx.ag) u.rel.agent = clamp(u.rel.agent + fx.ag, 0, 100);
  if (fx.pa && u.rel.partner !== null) u.rel.partner = clamp(u.rel.partner + fx.pa, 0, 100);
  if (fx.startPartner && u.rel.partner === null) { u.rel.partner = 60; u.rel.partnerName = supportName(rngOf(S.seed, 'partner', S.wk), p.country, rngOf(S.seed, 'partnerg', S.wk).chance(0.5)).split(' ')[0]; }
  if (fx.endPartner) { u.rel.partner = null; }
  if (fx.ab) { const [k, amt] = fx.ab, from = p.ab[k]; p.ab[k] = Math.min(Math.max(p.ceil[k], from), from + amt); if (p.ab[k] > from) u.attr.push({ wk: S.wk, year: S.year, ab: k, from, to: p.ab[k], cause: 'training', note: 'delayed effect of a choice' }); }
  return out;
}
const fxWords = (fx: Fx) => [fx.mo && (fx.mo > 0 ? 'morale up' : 'morale down'), fx.fa && (fx.fa > 0 ? 'more fatigue' : 'less fatigue'), fx.st && (fx.st > 0 ? 'more strain' : 'less strain'), fx.co && (fx.co > 0 ? 'confidence up' : 'confidence down'),
  fx.sh && (fx.sh > 0 ? 'sharper' : 'less sharp'), fx.$ && (fx.$ > 0 ? 'income' : 'a cost'), fx.tr && (fx.tr > 1 ? 'more useful training' : 'less training'), fx.rc && 'better recovery', fx.ct && (fx.ct > 0 ? 'coach trust up' : 'coach trust down'),
  fx.fr && (fx.fr > 0 ? 'friendship stronger' : 'friendship strained'), fx.pa && (fx.pa > 0 ? 'relationship stronger' : 'relationship strained'), fx.ag && (fx.ag > 0 ? 'reputation up' : 'reputation down')].filter(Boolean).join(', ');

export function advanceWeek(S: State, C: Content) {
  publish(S, true); weeklyNews(S);
  const u = S.u, r = S.rank[S.userId];
  u.rankHist.push({ wk: S.wk, rank: r, pts: S.pts[S.userId] });
  if (r <= 100) achieve(S, 'top100', 'First top-100 ranking'); if (r <= 50) achieve(S, 'top50', 'First top-50 ranking'); if (r <= 10) achieve(S, 'top10', 'First top-10 ranking');
  if (r === 1) { achieve(S, 'no1', 'World No. 1'); u.no1Weeks++; }
  runEntries(S); (globalThis as any).__tcAfterEntries?.(S); playEvents(S); checkGoals(S); weeklyUpkeep(S);
  S.wk++; S.week++;
  if (S.week >= weeksIn(S.year)) yearEnd(S, C);
}
function newSummary(S: State): BlockSummary {
  return { year: S.year, block: S.block, fromWk: S.wk, toWk: S.wk, rankFrom: S.rank[S.userId], rankTo: 0, ptsFrom: S.pts[S.userId], ptsTo: 0, tourneys: [], notes: [], dev: {}, cashFrom: S.u.cash, cashTo: 0, injuries: [], newAch: [], world: [], follow: [] };
}
function endBlock(S: State) {
  const u = S.u, sum = S.sumAcc!;
  flushDev(S);
  const nb = (sum.year - START_YEAR) * 4 + sum.block + 1;
  for (const f of u.follow.filter(f => f.dueBlock <= nb)) {
    const ev = evById(f.ev), ch = ev.choices[f.choice]; if (!ch.follow) continue;
    if (ch.follow.fx) applyFx(S, ch.follow.fx);
    sum.follow.push(ch.follow.text); const rec = u.choices.find(c => c.ev === f.ev && c.follow && !c.follow.done); if (rec?.follow) rec.follow.done = true;
    logEv(S, 'ChoiceFollowUp', { ev: f.ev });
  }
  u.follow = u.follow.filter(f => f.dueBlock > nb);
  const champs = S.world.champs.filter(c => c.wk >= sum.fromWk && (c.band === 'GS' || c.band === 'F' || c.band === 'T1000')).slice(-6);
  sum.world = champs.map(c => `${S.players[c.w]?.name ?? 'Unknown'} won ${c.name === 'Wimbledon' ? 'Wimbledon' : 'the ' + c.name}`);
  sum.toWk = S.wk; sum.rankTo = S.rank[S.userId] ?? sum.rankFrom; sum.ptsTo = S.pts[S.userId] ?? 0; sum.cashTo = u.cash;
  S.lastSummary = sum; S.sumAcc = undefined; S.plan = undefined; u.blockMods = {};
}
function runBlock(S: State, C: Content) {
  const startYear = S.sumAcc!.year, end = S.sumAcc!.block < 3 ? absOf(startYear, BLOCKS[S.sumAcc!.block + 1]) : absOf(startYear, weeksIn(startYear));
  while (S.wk < end && S.phase === 'plan') advanceWeek(S, C);
  if (S.phase === 'interrupt') return;
  publish(S);
  if (S.phase === 'plan') S.block = Math.min(3, S.sumAcc!.block + 1);
  endBlock(S);
}

export function execute(S: State, C: Content, cmd: Command): State {
  if (cmd.id === S.lastCmd) return S; // a retried command returns the committed result instead of running twice
  S.lastCmd = cmd.id; S.rev++;
  const u = S.u, p = S.players[S.userId];
  switch (cmd.type) {
    case 'ChangeDelegation': u.pol = { ...cmd.pol }; logEv(S, 'DelegationChanged', { detail: cmd.pol.detail, priority: cmd.pol.priority }); break;
    case 'SetRival': {
      if (!S.players[cmd.opp] || cmd.opp === S.userId) throw new Error('Unknown player.');
      u.rivals = u.rivals.filter(x => x !== cmd.opp); u.rivalNo = (u.rivalNo ?? []).filter(x => x !== cmd.opp);
      (cmd.yes ? u.rivals : u.rivalNo).push(cmd.opp);
      logEv(S, 'RivalSet', { opp: cmd.opp, yes: cmd.yes }); break;
    }
    case 'SetPortrait': { if (cmd.data && (cmd.data.length > 400000 || !cmd.data.startsWith('data:image/'))) throw new Error('That image could not be used.'); u.portrait = cmd.data ?? undefined; logEv(S, 'PortraitChanged'); break; }
    case 'CommitBlock': {
      if (S.phase !== 'plan') throw new Error('No block can be committed right now.');
      ensureGoals(S);
      const weeks = blockWeeks(S), valid: Record<number, string> = {};
      for (const [k, id] of Object.entries(cmd.plan.weeks)) { const ed = S.cal.find(e => e.id === id); if (ed && weeks.includes(+k) && ed.startWk === +k) valid[+k] = id; }
      const taken = new Set<number>();
      for (const k of Object.keys(valid).map(Number).sort((a, b) => a - b)) { const ed = S.cal.find(e => e.id === valid[k])!; if (taken.has(k)) { delete valid[k]; continue; } taken.add(k); if (ed.weeks === 2) taken.add(k + 1); }
      S.plan = { ...cmd.plan, weeks: valid }; u.pol = { ...cmd.pol }; S.sumAcc = newSummary(S); S.blockStartRank = { ...S.rank };
      logEv(S, 'BlockCommitted', { year: S.year, block: S.block, route: cmd.plan.route, events: Object.values(valid), priority: cmd.pol.priority, intensity: cmd.pol.intensity, focus: cmd.pol.focus });
      if (cmd.plan.lifeEv !== undefined && cmd.plan.lifeChoice !== undefined) {
        const ev = evById(cmd.plan.lifeEv), ch = ev.choices[cmd.plan.lifeChoice];
        if (ev && ch) {
          applyFx(S, ch.fx); u.evSeen[ev.id] = absBlock(S);
          u.choices.push({ id: `ch-${S.wk}`, ev: ev.id, choice: cmd.plan.lifeChoice, wk: S.wk, year: S.year, date: iso(wkDate(S.wk)), title: ev.title, label: ch.label, fx: fxWords(ch.fx) || ch.hint, personal: !!ev.personal, follow: ch.follow ? { dueBlock: absBlock(S) + ch.follow.after, text: ch.follow.text } : undefined });
          if (ch.follow) u.follow.push({ dueBlock: absBlock(S) + ch.follow.after, ev: ev.id, choice: cmd.plan.lifeChoice });
          logEv(S, 'ChoiceCommitted', { ev: ev.id, choice: cmd.plan.lifeChoice });
        }
      }
      if (u.finalSeasonWarned && S.block === 0) note(S, 'This is your final eligible season: the age ceiling closes your career when it ends.');
      runBlock(S, C); break;
    }
    case 'ResolveInjury': {
      if (S.phase !== 'interrupt' || !S.pending) throw new Error('Nothing to resolve.');
      if (S.pending.type === 'forcedRetire') { retire(S, 'health'); break; }
      const inj = u.injuries.find(i => i.id === S.pending!.injury)!;
      const cost = inj.sev === 'moderate' ? 1500 : inj.sev === 'major' ? 6000 : 15000;
      let rehab = cmd.rehab; if (rehab === 'specialist' && u.cash < cost) rehab = 'conservative';
      inj.rehab = rehab;
      if (rehab !== 'conservative') {
        const w = Math.max(1, Math.round(inj.weeks * (rehab === 'specialist' ? 0.85 : 0.7))); p.injuredUntil -= inj.weeks - w; inj.weeks = w;
        if (rehab === 'specialist') addLedger(S, 'Specialist care', -cost, inj.id); else (p as any).vuln = p.injuredUntil + 12;
      }
      logEv(S, 'RecoveryUpdated', { id: inj.id, rehab, weeks: inj.weeks });
      note(S, rehab === 'conservative' ? 'You chose conservative rehabilitation.' : rehab === 'specialist' ? 'Specialist care shortened the expected absence.' : 'You chose an earlier return. The risk of a setback is higher for the next few months.');
      S.pending = undefined; S.phase = 'plan';
      if (S.sumAcc) runBlock(S, C); break;
    }
    case 'YearEnd': {
      if (S.phase !== 'yearEnd' || !S.pending) throw new Error('No year-end review is open.');
      if (S.pending.type === 'forcedRetire') { retire(S, 'age ceiling'); break; }
      if (cmd.retire) { retire(S, 'voluntary'); break; }
      const offer = S.pending.coachOffers?.find(c => c.id === cmd.coach);
      if (offer) {
        u.coachHistory.push({ ...u.coach, left: S.year - 1, reason: 'Replaced at the year-end review' });
        addLedger(S, 'Coach transition', -offer.cost); u.coach = { ...offer, since: S.year }; u.rel.coach = 50; p.sharp = Math.max(30, p.sharp - 3);
        logEv(S, 'ContractChanged', { kind: 'coach', id: offer.id, name: offer.name });
      } else if (u.coach.until <= S.year) u.coach.until = S.year + 1;
      const slots = new Set<string>();
      for (const id of cmd.sponsors) {
        const sp = S.pending.sponsorOffers?.find(s => s.id === id); if (!sp || slots.has(sp.slot)) continue;
        slots.add(sp.slot); u.sponsors.push(sp); u.sponsorHistory.push(sp); logEv(S, 'ContractChanged', { kind: 'sponsor', id: sp.id, name: sp.name });
      }
      (u as any).appear = u.sponsors.reduce((t, s) => t + s.appearances, 0);
      S.pending = undefined; S.phase = 'plan'; snapshot(S, `season-${S.year - 1}`, true); ensureGoals(S); break;
    }
    case 'Retire': retire(S, 'voluntary'); break;
  }
  return S;
}
export function retire(S: State, reason: string) {
  const u = S.u;
  if (S.sumAcc) endBlock(S);
  flushDev(S);
  if (S.phase !== 'yearEnd' && S.week > 0) { // mid-season retirement still records the partial season
    const y = S.year, ms = u.matches.filter(m => m.year === y && m.cls !== 'wo'), ts = u.tourneys.filter(t => t.year === y && t.reached && t.reached !== 'WD');
    if (ts.length || ms.length) u.seasons.push({ year: y, n: u.seasons.length + 1, rank: S.rank[S.userId], pts: S.pts[S.userId], w: ms.filter(m => m.won).length, l: ms.filter(m => !m.won).length, titles: ts.filter(t => t.title).length, finals: ts.filter(t => t.final).length, majorsBest: '–', prize: ts.reduce((a, t) => a + t.prize, 0), injWeeks: u.injWeeksYear, dev: Math.round((u.devYear.comp + u.devYear.train) * 10) / 10, devComp: u.devYear.comp, devTrain: u.devYear.train, bestRank: S.rank[S.userId], events: ts.length, age: S.year - +S.players[S.userId].born.slice(0, 4), no1: false });
  }
  snapshot(S, 'retirement', true);
  u.coachHistory.push({ ...u.coach, left: S.year, reason: 'Career ended' });
  S.retire = { year: S.phase === 'yearEnd' ? S.year - 1 : S.year, wk: S.wk, reason, date: S.phase === 'yearEnd' ? `${S.year - 1}-12-31` : iso(wkDate(S.wk)) };
  S.active = S.active.filter(id => id !== S.userId);
  S.pending = undefined; S.phase = 'retired'; S.plan = undefined;
  logEv(S, 'CareerRetired', { reason });
}
export function initNames(S: State) {
  const r = rngOf(S.seed, 'cast'), c = S.players[S.userId].country, rel = S.u.rel as any;
  rel.friendName = supportName(r, c, r.chance(0.5)).split(' ')[0]; rel.agentName = supportName(r, r.chance(0.5) ? c : 'USA', r.chance(0.4));
}
export { ECON };
