// Tournament entry, draws and round-by-round play for every event of the selected tour (spec 8, 9, 13).
import { BAND_VAL, DEV, ECON, FINALS_POINTS, POINTS, PRIZE, PRIZE_MULT, QUAL_POINTS, ROUND_KEYS } from './balance';
import { fmtDate, iso, travelClass, wkDate } from './content';
import { expectedWin, simulateMatch, Rules } from './match';
import { clamp, rngOf } from './rng';
import type { Band, Edition, MatchLite, MatchResult, Player, State, UMatch, UTourney } from './types';
import { injure } from './upkeep';
import { ageOf, peakIndex, strength } from './world';

const free = (p: Player, wk: number) => !p.commit[wk];
const lastName = (n: string) => n.split(' ').slice(1).join(' ') || n;
export const note = (S: State, t: string) => { S.sumAcc?.notes.push(t); };
export function addLedger(S: State, cat: string, amt: number, ref?: string) { if (!amt) return; S.u.cash += amt; S.u.ledger.push({ wk: S.wk, year: S.year, cat, amt: Math.round(amt), ref }); }
export function logEv(S: State, type: string, data?: any) { S.ledger.push({ seq: S.seq++, wk: S.wk, date: iso(wkDate(S.wk)), type, cmd: S.lastCmd ?? '', data }); }
export function achieve(S: State, id: string, name: string, ref?: string) {
  if (S.u.ach.some(a => a.id === id)) return;
  S.u.ach.push({ id, name, wk: S.wk, year: S.year, date: iso(wkDate(S.wk)), ref }); S.sumAcc?.newAch.push(name); logEv(S, 'Achievement', { id, name });
}
export function eventCost(S: State, ed: Edition): number {
  const cls = travelClass(S.players[S.userId].country, ed.country), [lo, hi] = cls === 0 ? ECON.local : cls === 1 ? ECON.regional : ECON.inter;
  return Math.round((lo + (hi - lo) * rngOf(S.seed, 'cost', ed.id).next()) * (ed.weeks === 2 ? 1.4 : 1));
}
export const weeklyGuaranteed = (S: State) => ((S.year === 2026 ? ECON.support : 0) + S.u.sponsors.reduce((t, s) => t + s.monthly, 0) - ECON.essentials - S.u.coach.cost) * 12 / 52;
/** Local and regional trips are always possible (the basic support scheme covers a shortfall); long-haul trips need real money (spec 11.4). */
export function canAfford(S: State, cost: number, ed?: Edition) { return (ed !== undefined && travelClass(S.players[S.userId].country, ed.country) <= 1) || S.u.cash + Math.max(0, weeklyGuaranteed(S)) * 4 - cost >= 0; }

function minVal(rank: number) { return rank <= 20 ? 250 : rank <= 70 ? 100 : rank <= 180 ? 50 : 15; }
function playProb(p: Player, rank: number, band: Band, q: boolean, wk: number): number {
  let b = band === 'T1000' ? 0.96 : band === 'T500' ? (rank <= 10 ? 0.45 : rank <= 50 ? 0.62 : 0.7) : band === 'T250' ? (rank <= 10 ? 0.12 : rank <= 30 ? 0.38 : rank <= 60 ? 0.55 : 0.68) : band === 'UL' ? (rank <= 60 ? 0.12 : 0.62) : 0.56;
  if (q) b *= 0.9;
  if (p.consec >= 3) b *= 0.35; else if (p.consec === 2) b *= 0.8;
  if (p.fatigue > 55) b *= 0.5;
  if (p.commit[wk + 1] && band !== 'T1000') b *= 0.7;
  return b;
}
function openTourney(S: State, ed: Edition, status: UTourney['status'], via?: string): UTourney {
  const t: UTourney = { ed: ed.id, series: ed.series, name: ed.name, cat: ed.cat, band: ed.band, surface: ed.surface, city: ed.city, country: ed.country, year: ed.year, wk: ed.startWk, dates: ed.dates!, status, via, reached: '', pts: 0, prize: 0, cost: 0, title: false, final: false, matches: [], prov: ed.prov };
  S.u.tourneys.push(t); S.sumAcc?.tourneys.push(ed.id);
  logEv(S, status === 'ALT' || status === 'REJ' || status === 'WD' ? 'EntryRejected' : 'EntryAccepted', { ed: ed.id, status, rank: S.rank[S.userId] });
  if (status === 'MD' || status === 'Q' || status === 'WC') {
    t.cost = eventCost(S, ed); addLedger(S, 'Travel and entry', -t.cost, ed.id);
    if (status === 'Q') achieve(S, 'firstQ', 'First qualifying acceptance', ed.id);
    if (ed.band === 'GS' && status !== 'Q') achieve(S, 'firstMajorMD', 'First major main draw', ed.id);
  }
  return t;
}
const uT = (S: State, edId: string) => S.u.tourneys.find(t => t.ed === edId);

export function runEntries(S: State) {
  const wk = S.wk, P = S.players, uid = S.userId, user = P[uid];
  const eds = S.cal.filter(e => e.entryWk === wk && !e.cancelled);
  if (!eds.length) return;
  const avail = (p: Player, w: number) => p.injuredUntil <= w && !p.retired;
  const planned = (ed: Edition) => S.plan?.weeks[ed.startWk] === ed.id;
  const lock = (ed: Edition, id: string) => { (ed as any).lock ??= {}; (ed as any).lock[id] = S.rank[id]; };

  for (const ed of eds.filter(e => e.band === 'F')) {
    const raceOrder = Object.keys(S.race).sort((a, b) => S.race[b] - S.race[a] || (a < b ? -1 : 1));
    ed.md = raceOrder.filter(id => avail(P[id], wk) && free(P[id], wk)).slice(0, 8);
    if (ed.md.length < 8) { ed.cancelled = true; continue; }
    for (const id of ed.md) { P[id].commit[wk] = ed.id; lock(ed, id); }
    if (ed.md.includes(uid)) { openTourney(S, ed, 'MD', 'season race'); achieve(S, 'finalsQ', 'Qualified for the Tour Finals', ed.id); }
  }
  for (const ed of eds.filter(e => e.band === 'GS')) {
    const w1 = ed.startWk, w2 = ed.startWk + 1;
    const apps = S.order.filter(id => { const p = P[id]; return id === uid ? planned(ed) && avail(p, w1) : avail(p, w1) && free(p, w1) && free(p, w2); });
    const direct = apps.slice(0, ed.direct), rest = apps.slice(ed.direct);
    const home = rest.filter(id => P[id].country === ed.country).slice(0, ed.wc), wcs = [...home, ...rest.filter(id => !home.includes(id)).slice(0, ed.wc - home.length)];
    const q = rest.filter(id => !wcs.includes(id) && avail(P[id], wk) && free(P[id], wk)).slice(0, ed.qSize);
    ed.md = [...direct, ...wcs]; ed.wcs = wcs; ed.q = q; ed.alt = rest.filter(id => !wcs.includes(id) && !q.includes(id)).slice(0, 8);
    ed.cut = direct.length >= ed.direct ? S.rank[direct[direct.length - 1]] : 9999; ed.qcut = q.length >= ed.qSize ? S.rank[q[q.length - 1]] : 9999;
    for (const id of ed.md) { P[id].commit[w1] = ed.id; P[id].commit[w2] = ed.id; lock(ed, id); }
    for (const id of q) { P[id].commit[wk] = ed.id; lock(ed, id); }
    S.memo[ed.series] = { cut: ed.cut, qcut: ed.qcut };
    if (planned(ed)) {
      if (direct.includes(uid)) openTourney(S, ed, 'MD'); else if (wcs.includes(uid)) openTourney(S, ed, 'WC', 'wildcard');
      else if (q.includes(uid)) openTourney(S, ed, 'Q'); else { openTourney(S, ed, 'ALT'); note(S, `${ed.name}: your ranking of ${S.rank[uid]} was outside the qualifying cut-off. You were not entered.`); }
    }
  }
  const regs = eds.filter(e => e.band !== 'GS' && e.band !== 'F');
  if (!regs.length) return;
  const slots = new Map<string, { d: number; w: number; q: number }>();
  for (const ed of regs) slots.set(ed.id, { d: ed.direct, w: ed.wc, q: ed.qSpots ? ed.qSize : 0 });
  const take = (ed: Edition, p: Player): 'MD' | 'WC' | 'Q' | null => {
    const s = slots.get(ed.id)!;
    if (s.d > 0) return 'MD'; if (s.w > 0 && p.country === ed.country) return 'WC'; if (s.q > 0) return 'Q'; return null;
  };
  const assign = (ed: Edition, p: Player, kind: 'MD' | 'WC' | 'Q') => {
    const s = slots.get(ed.id)!;
    if (kind === 'MD') { s.d--; ed.md.push(p.id); if (s.d === 0) ed.cut = S.rank[p.id]; }
    else if (kind === 'WC') { s.w--; ed.md.push(p.id); ed.wcs.push(p.id); }
    else { s.q--; ed.q.push(p.id); if (s.q === 0) ed.qcut = S.rank[p.id]; }
    p.commit[wk] = ed.id; if (ed.weeks === 2) p.commit[wk + 1] = ed.id; lock(ed, p.id);
  };
  for (const id of S.order) {
    const p = P[id], rank = S.rank[id];
    if (!avail(p, wk) || !free(p, wk)) {
      if (id === uid && S.plan?.weeks[wk]) { const ed = regs.find(e => e.id === S.plan!.weeks[wk]); if (ed) { openTourney(S, ed, 'WD'); note(S, `${ed.name}: entry withdrawn (${p.injuredUntil > wk ? 'injury' : 'schedule conflict'}).`); } }
      continue;
    }
    if (id === uid) {
      const want = regs.find(e => e.id === S.plan?.weeks[wk]);
      if (!want) continue;
      let ed: Edition | undefined = want, kind = take(want, p);
      if (kind && !canAfford(S, eventCost(S, want), want)) { kind = null; openTourney(S, want, 'WD'); note(S, `${want.name}: the trip was not affordable, so the entry was withdrawn.`); }
      else if (!kind) { openTourney(S, want, 'ALT'); note(S, `${want.name}: your ranking of ${rank} left you as an alternate.`); }
      if (!kind && S.u.pol.fallback === 'nearest') {
        const wi = BAND_VAL[want.band];
        const opts = regs.filter(e => e !== want && take(e, p) && (ed!.weeks === 1 || free(p, wk + 1)) && e.weeks === 1 && BAND_VAL[e.band] <= wi && canAfford(S, eventCost(S, e), e))
          .map(e => ({ e, s: -Math.abs(Math.log(BAND_VAL[e.band] / wi)) * 2 - travelClass(p.country, e.country) - (take(e, p) === 'Q' ? 0.5 : 0) })).sort((a, b) => b.s - a.s);
        if (opts.length) { ed = opts[0].e; kind = take(ed, p); note(S, `Your agent entered you in ${ed.name} instead.`); }
      }
      if (kind && ed) { assign(ed, p, kind); openTourney(S, ed, kind, kind === 'WC' ? 'wildcard' : undefined); }
      else if (!kind) note(S, 'No suitable replacement event was available; the week became a training week.');
      continue;
    }
    const mv = minVal(rank);
    let best: Edition | null = null, bestV = 0, bestK: 'MD' | 'WC' | 'Q' | null = null;
    const r = rngOf(S.seed, 'entry', id, wk);
    for (const ed of regs) {
      if (BAND_VAL[ed.band] < mv || (ed.weeks === 2 && !free(p, wk + 1))) continue;
      const k = take(ed, p); if (!k) continue;
      const tc = travelClass(p.country, ed.country);
      const v = BAND_VAL[ed.band] * (k === 'Q' ? 0.4 : 1) * (tc === 0 ? 1 : tc === 1 ? 0.85 : 0.6) * clamp(p.fam[ed.surface] / 50, 0.8, 1.2) * r.range(0.85, 1.15);
      if (v > bestV) { best = ed; bestV = v; bestK = k; }
    }
    if (best && bestK && r.chance(playProb(p, rank, best.band, bestK === 'Q', wk))) assign(best, p, bestK);
  }
  for (const ed of regs) {
    const s = slots.get(ed.id)!;
    while (s.w > 0 && ed.q.length) { ed.md.push(ed.q.shift()!); s.w--; } // unused wildcards go to the best-ranked qualifying entrants
    if (ed.q.length <= ed.qSpots) { ed.quals = ed.q; ed.md.push(...ed.q); ed.q = []; }
    ed.cut ??= 9999; ed.qcut ??= 9999;
    S.memo[ed.series] = { cut: ed.cut, qcut: ed.qcut };
    const bm = (S.bandMemo[ed.band] ??= { cut: 0, qcut: 0, n: 0 });
    if (ed.cut < 9999) { bm.cut = (bm.cut * bm.n + ed.cut) / (bm.n + 1); bm.qcut = (bm.qcut * bm.n + Math.min(ed.qcut, ed.cut * 1.8)) / (bm.n + 1); bm.n = Math.min(bm.n + 1, 40); }
    if (ed.md.length + Math.min(ed.q.length, ed.qSpots) < 6) { // failed field validation: event not held (spec 8.3)
      ed.cancelled = true;
      for (const id of [...ed.md, ...ed.q]) { delete P[id].commit[wk]; delete P[id].commit[wk + 1]; }
      const t = uT(S, ed.id); if (t) { t.status = 'WD'; t.note = 'Event not held: the field could not be filled.'; addLedger(S, 'Travel refund', t.cost, ed.id); t.cost = 0; note(S, `${ed.name} was not held because the field could not be filled. Your costs were refunded.`); }
    }
    const t = uT(S, ed.id);
    if (t && t.status === 'Q' && ed.md.includes(uid)) { t.status = 'MD'; t.via = 'promoted from the qualifying list'; }
  }
}

const seedOrder = (n: number) => { let a = [1]; while (a.length < n) { const m = a.length * 2 + 1; a = a.flatMap(x => [x, m - x]); } return a; };
const roundLabel = (size: number) => (size >= 16 ? `R${size}` : size === 8 ? 'QF' : size === 4 ? 'SF' : 'F');
const rulesOf = (S: State, ed: Edition, qual: boolean): Rules => ({ surface: ed.surface, bestOf: ed.band === 'GS' && S.tour === 'atp' && !qual ? 5 : 3, tb10: ed.band === 'GS', tour: S.tour });
const lockRank = (S: State, ed: Edition, id: string) => (ed as any).lock?.[id] ?? S.rank[id];

function reasons(S: State, res: MatchResult, i: 0 | 1, won: boolean, me: Player, opp: Player, myRank: number, oppRank: number): string[] {
  const a = res.stats[i], b = res.stats[1 - i], out: [number, string][] = [], ln = lastName(opp.name);
  const fs = a.fsIn ? a.fsWon / a.fsIn : 0, rt = b.fsTot ? a.retWon / b.fsTot : 0, ofs = b.fsIn ? b.fsWon / b.fsIn : 0;
  if (won) {
    if (fs >= 0.74) out.push([fs, `Your first serve held firm: ${Math.round(fs * 100)}% of points won behind it.`]);
    if (rt >= 0.4) out.push([rt + 0.3, `Your return kept ${ln} under pressure, creating ${a.bpTot} break points.`]);
    if (a.bpTot && a.bpWon / a.bpTot >= 0.5 && a.bpWon >= 3) out.push([0.6, `You converted ${a.bpWon} of ${a.bpTot} break points.`]);
    if (oppRank < myRank * 0.6) out.push([0.9, `A win over an opponent ranked ${myRank - oppRank} places higher.`]);
    if (res.sets.length > 2 && res.cls === 'played') out.push([0.5, 'You stayed steadier in the deciding stages.']);
    if (res.cls === 'ret') out.push([1, `${ln} retired during the match.`]);
  } else {
    if (ofs >= 0.76) out.push([ofs, `Your return struggled against ${ln}'s serve (${Math.round(ofs * 100)}% of first-serve points lost).`]);
    if (fs <= 0.64) out.push([1 - fs, `Your first serve was attacked: only ${Math.round(fs * 100)}% of points won behind it.`]);
    if (a.bpTot >= 4 && a.bpWon / a.bpTot <= 0.25) out.push([0.7, `Chances went begging: ${a.bpWon} of ${a.bpTot} break points converted.`]);
    if (me.fatigue > 55) out.push([0.75, 'You carried a heavy recent workload into the match.']);
    if (me.sharp < 45) out.push([0.65, 'You were short of match sharpness after time away.']);
    if (oppRank < myRank * 0.5) out.push([0.6, `${ln} was ranked ${myRank - oppRank} places higher.`]);
    if (res.cls === 'ret') out.push([1, 'You had to retire during the match.']);
  }
  out.sort((x, y) => y[0] - x[0]);
  const r = out.slice(0, 2).map(x => x[1]);
  if (r.length < 2) r.push(won ? 'The match turned on a handful of points that went your way.' : 'The match was decided by a handful of points.');
  return r;
}

function post(S: State, p: Player, won: boolean, res: MatchResult | null, i: number, pAct: number, pRest: number, ed: Edition) {
  if (!res) return;
  p.fatigue = clamp(p.fatigue + res.fatigue[i], 0, 100); p.sharp = Math.min(100, p.sharp + 5); p.fam[ed.surface] = Math.min(100, p.fam[ed.surface] + 0.5);
  const C = 0.1 + 0.9 * Math.exp(-(((pRest - 0.5) / DEV.cWidth) ** 2));
  const c = res.closeness, e = DEV.exposure;
  let expo = c < 0.25 ? e.oneSided : c < 0.55 ? e.straight : c < 0.8 ? e.close : e.epic;
  if (won && expo < e.straight) expo = e.straight;
  const credit = C * expo; p.wkCredit = (p.wkCredit ?? 0) + credit; p.wkMatches = (p.wkMatches ?? 0) + 1; p.wkSurf = ed.surface;
  const r = rngOf(S.seed, 'conf', p.id, S.wk, p.wkMatches);
  let d: number;
  if (won) d = pAct >= 0.65 ? r.range(1, 2) : pAct >= 0.35 ? r.range(2, 4) : r.range(4, 7);
  else d = pAct < 0.35 ? (c > 0.5 ? 0 : -1) : pAct < 0.65 ? r.range(-2, -1) : r.range(-7, -4);
  p.conf = clamp(p.conf + d, 0, 100);
  if (p.user) { (S.u as any).lastCredit = credit; }
}

/** Plays one match and returns the winner id. Handles byes and walkovers (not counted as played matches). */
function playMatch(S: State, ed: Edition, aId: string | null, bId: string | null, round: string, qual: boolean, lose: (id: string, r: string) => void): string | null {
  if (!aId || !bId) return aId ?? bId;
  const wk = S.wk, a = S.players[aId], b = S.players[bId], uid = S.userId, isU = aId === uid || bId === uid;
  const aOut = a.injuredUntil > wk, bOut = b.injuredUntil > wk;
  if (aOut || bOut) {
    const w = aOut ? bId : aId, l = aOut ? aId : bId; lose(l, round);
    if ((ed as any).hasUser) ed.log!.push({ r: round, a: aId, b: bId, w, s: 'w/o', cls: 'wo' });
    if (isU) recordUser(S, ed, round, qual, w === uid, null, 0, uid === aId ? b : a, 0.5);
    return w;
  }
  const rules = rulesOf(S, ed, qual);
  const pA = expectedWin(a, b, rules), pR = expectedWin(a, b, rules, true);
  const res = simulateMatch(a, b, rules, `${S.seed}|m|${ed.id}|${round}|${aId}|${bId}`, isU);
  const w = res.winner === 0 ? aId : bId, l = res.winner === 0 ? bId : aId;
  if (isU) recordUser(S, ed, round, qual, w === uid, res, aId === uid ? 0 : 1, uid === aId ? b : a, aId === uid ? pA : 1 - pA);
  post(S, a, res.winner === 0, res, 0, pA, pR, ed); post(S, b, res.winner === 1, res, 1, 1 - pA, 1 - pR, ed);
  if (res.cls === 'ret') injure(S, S.players[l], 'acute', true);
  lose(l, round);
  if ((ed as any).hasUser) ed.log!.push({ r: round, a: aId, b: bId, w, s: res.score, cls: res.cls });
  return w;
}
function recordUser(S: State, ed: Edition, round: string, qual: boolean, won: boolean, res: MatchResult | null, i: 0 | 1, opp: Player, p: number) {
  const u = S.u, me = S.players[S.userId], myRank = lockRank(S, ed, me.id), oppRank = lockRank(S, ed, opp.id);
  const m: UMatch = {
    id: `${ed.id}|${round}${round === "RR" ? "|" + opp.id : ""}`, ed: ed.id, year: ed.year, wk: S.wk, round, qual, opp: opp.id, oppName: opp.name, oppRank, oppReal: opp.real, oppCountry: opp.country, myRank, won,
    score: res ? res.score : 'w/o', cls: res ? res.cls : 'wo', p, stats: res ? (i === 0 ? res.stats : [res.stats[1], res.stats[0]]) : undefined, minutes: res?.minutes ?? 0,
    reasons: res ? reasons(S, res, i, won, me, opp, myRank, oppRank) : [won ? `${lastName(opp.name)} withdrew before the match. A walkover is not a played match.` : 'You could not take the court.'], turning: res?.turning ?? [], surface: ed.surface, dev: 0, fat: res ? res.fatigue[i] : 0,
    flow: res ? res.flow.map(g => (g === i ? '1' : '0')).join('') : undefined, sets: res ? res.sets.map(s => (i === 0 ? [s[0], s[1], s[2] !== undefined ? Math.min(s[2], s[3]!) : undefined] : [s[1], s[0], s[2] !== undefined ? Math.min(s[2], s[3]!) : undefined]) as [number, number, number?]) : undefined,
  };
  u.matches.push(m); uT(S, ed.id)?.matches.push(m.id);
  logEv(S, 'MatchCompleted', { id: m.id, won, score: m.score, opp: opp.id });
  if (res && won) {
    achieve(S, 'firstWin', 'First professional win', m.id);
    if (!qual && ['T250', 'T500', 'T1000', 'GS', 'F'].includes(ed.band)) achieve(S, 'firstTourWin', 'First main-tour win', m.id);
    if (!qual && ed.band === 'GS') achieve(S, 'firstMajorWin', 'First major match win', m.id);
  }
}

function qualify(S: State, ed: Edition) {
  if (!ed.q.length) return;
  const spots = ed.qSpots, P = S.players, q = ed.q.filter(id => P[id].injuredUntil <= S.wk).sort((a, b) => lockRank(S, ed, a) - lockRank(S, ed, b));
  let size = 1; while (spots * size < q.length) size *= 2;
  const secs: string[][] = Array.from({ length: spots }, () => []);
  q.forEach((id, i) => { const row = Math.floor(i / spots), col = i % spots; secs[row % 2 === 0 ? col : spots - 1 - col].push(id); });
  const order = seedOrder(size), winners: string[] = [], uid = S.userId;
  (ed as any).lostQ = {};
  for (const sec of secs) {
    let slots: (string | null)[] = order.map(k => sec[k - 1] ?? null), rd = 1;
    while (slots.length > 1) {
      const nx: (string | null)[] = [];
      for (let i = 0; i < slots.length; i += 2) nx.push(playMatch(S, ed, slots[i], slots[i + 1], `Q${rd}`, true, (id, r) => { (ed as any).lostQ[id] = r; }));
      for (const id of nx) if (id) S.players[id].fatigue = Math.max(0, S.players[id].fatigue - 2);
      slots = nx; rd++;
    }
    if (slots[0]) winners.push(slots[0]);
  }
  ed.quals = winners; ed.md.push(...winners); ed.q = [];
  for (const id of winners) if (ed.band === 'GS') { P[id].commit[ed.startWk] = ed.id; P[id].commit[ed.startWk + 1] = ed.id; }
  const t = uT(S, ed.id);
  if (t && t.status === 'Q') {
    t.qualified = winners.includes(uid);
    if (!t.qualified) closeUser(S, ed, t, (ed as any).lostQ[uid] ?? 'Q1', true);
  }
}
function startBracket(S: State, ed: Edition) {
  const P = S.players, players = ed.md.filter(id => P[id].injuredUntil <= S.wk).sort((a, b) => lockRank(S, ed, a) - lockRank(S, ed, b));
  const bracket = ed.draw > 64 ? 128 : ed.draw > 32 ? 64 : 32, nSeeds = bracket / 4, r = rngOf(S.seed, 'draw', ed.id);
  const seeds = players.slice(0, nSeeds), rest = r.shuffle(players.slice(nSeeds));
  for (const [lo, hi] of [[2, 4], [4, 8], [8, 16], [16, 32]]) if (seeds.length >= hi) { const part = r.shuffle(seeds.slice(lo, hi)); seeds.splice(lo, hi - lo, ...part); }
  const list = [...seeds, ...rest];
  ed.slots = seedOrder(bracket).map(k => list[k - 1] ?? null); ed.round = 0; ed.lost = {};
  (ed as any).hasUser = ed.md.includes(S.userId); if ((ed as any).hasUser) ed.log = [];
  for (const id of ed.md) if (P[id].injuredUntil > S.wk) ed.lost[id] = 'WD';
}
function playRounds(S: State, ed: Edition, n: number) {
  for (let k = 0; k < n && ed.slots!.length > 1; k++) {
    const slots = ed.slots!, label = roundLabel(slots.length), nx: (string | null)[] = [];
    for (let i = 0; i < slots.length; i += 2) nx.push(playMatch(S, ed, slots[i], slots[i + 1], label, false, (id, r) => { ed.lost![id] = r; }));
    for (const id of nx) if (id) S.players[id].fatigue = Math.max(0, S.players[id].fatigue - 3);
    ed.slots = nx; ed.round = (ed.round ?? 0) + 1;
  }
  if (ed.slots!.length === 1) finish(S, ed);
}
function prizeFor(band: Band, reached: string, qual: boolean, qWins = 0): number {
  const P = PRIZE[band];
  if (qual) return Math.round(P.floor * 0.15 * (qWins + 1));
  return Math.round(Math.max(P.floor, P.champ * (PRIZE_MULT[reached] ?? 0)));
}
function closeUser(S: State, ed: Edition, t: UTourney, reached: string, inQual: boolean) {
  const u = S.u, uid = S.userId;
  t.reached = reached; t.title = reached === 'W'; t.final = reached === 'W' || reached === 'F';
  const qWins = u.matches.filter(m => m.ed === ed.id && m.qual && m.won && m.cls !== 'wo').length;
  t.prize = ed.band === 'F' ? t.prize : prizeFor(ed.band, reached, inQual, qWins);
  if (ed.band !== 'F') { addLedger(S, 'Prize money', t.prize, ed.id); const rec = S.players[uid].res.find(r => r.ed === ed.id); t.pts = rec?.pts ?? 0; }
  t.champion = ed.champion ? S.players[ed.champion]?.name : undefined; t.log = ed.log;
  logEv(S, 'PointsAwarded', { ed: ed.id, pts: t.pts, prize: t.prize, reached });
  if (t.title) {
    achieve(S, 'firstTitle', 'First title', ed.id);
    const bonus = u.sponsors.reduce((s, sp) => s + sp.titleBonus, 0) * (BAND_VAL[ed.band] >= 250 ? 1 : 0.2);
    if (bonus) addLedger(S, 'Sponsor title bonus', bonus, ed.id);
    if (ed.band === 'GS') {
      achieve(S, 'firstMajor', 'First major title', ed.id);
      const majors = u.tourneys.filter(x => x.title && x.band === 'GS');
      const kinds = new Set(majors.map(x => x.series)); if (kinds.size === 4) achieve(S, 'careerSlam', 'Career Grand Slam', ed.id);
      if (majors.filter(x => x.year === ed.year).length === 4) achieve(S, 'calendarSlam', 'All four majors in one season', ed.id);
      if (kinds.size === 4 && u.seasons.some(s => s.no1)) achieve(S, 'pentagon', 'The Pentagon', ed.id);
    }
  }
  if (!inQual) snapshot(S, ed.id);
}
export function snapshot(S: State, src: string, force = false) {
  const p = S.players[S.userId], idx = peakIndex(p), u = S.u, best = u.snaps.filter(s => s.src !== 'retirement' && !s.src.startsWith('season')).reduce((m, s) => Math.max(m, s.index), 0);
  if (!force && idx <= best + 0.01) return;
  const snap = { id: `snap-${S.wk}-${u.snaps.length}`, wk: S.wk, year: S.year, date: iso(wkDate(S.wk)), age: ageOf(S, p), ab: { ...p.ab }, fam: { ...p.fam }, style: p.style, perm: u.injuries.flatMap(i => i.perm ?? []), index: Math.round(idx * 1000) / 1000, src, rank: S.rank[p.id] };
  if (!force) u.snaps = u.snaps.filter(s => s.src === 'retirement' || s.src.startsWith('season'));
  u.snaps.push(snap);
}
function finish(S: State, ed: Edition) {
  const P = S.players, champ = ed.slots![0]!, uid = S.userId;
  ed.done = true; ed.champion = champ; ed.lost![champ] = 'W';
  const endWk = ed.startWk + ed.weeks, table = POINTS[ed.band];
  for (const id of ed.md) {
    const lab = ed.lost![id]; if (!lab || lab === 'WD') continue;
    let pts = table[ROUND_KEYS.indexOf(lab)] ?? 0;
    const isQ = ed.quals.includes(id);
    if (isQ) pts = Math.max(pts, QUAL_POINTS[ed.band]);
    if (lab === 'F') ed.runnerUp = id;
    if (pts > 0) P[id].res.push({ ed: ed.id, pts, exp: endWk + 52, yr: ed.year, cls: 't', q: isQ ? 1 : undefined });
  }
  P[champ].titles++; if (ed.band === 'GS') P[champ].majors++;
  if (BAND_VAL[ed.band] >= 250 || (ed as any).hasUser) S.world.champs.push({ ed: ed.id, name: ed.name, year: ed.year, band: ed.band, cat: ed.cat, w: champ, f: ed.runnerUp, wk: S.wk });
  const t = uT(S, ed.id);
  if (t && ed.lost![uid] && ed.lost![uid] !== 'WD') closeUser(S, ed, t, ed.lost![uid], false);
  else if (t && !t.reached && (t.status === 'MD' || t.status === 'Q' || t.status === 'WC')) { t.status = 'WD'; t.reached = 'WD'; }
  ed.md = []; ed.slots = undefined; ed.lost = undefined; ed.log = undefined; delete (ed as any).lock; delete (ed as any).lostQ;
}
function playFinals(S: State, ed: Edition) {
  const P = S.players, r = rngOf(S.seed, 'draw', ed.id), ids = ed.md.slice().sort((a, b) => lockRank(S, ed, a) - lockRank(S, ed, b)), uid = S.userId;
  (ed as any).hasUser = ids.includes(uid); ed.log = []; ed.lost = {};
  const rest = r.shuffle(ids.slice(2)), groups = [[ids[0], rest[0], rest[2], rest[4]], [ids[1], rest[1], rest[3], rest[5]]];
  const pts: Record<string, number> = {}, prize: Record<string, number> = {};
  const add = (id: string, p: number, $: number) => { pts[id] = (pts[id] ?? 0) + p; prize[id] = (prize[id] ?? 0) + $; };
  const qual: string[][] = [];
  for (const g of groups) {
    const wins: Record<string, number> = {}; for (const id of g) wins[id] = 0;
    for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]) {
      const w = playMatch(S, ed, g[i], g[j], 'RR', false, () => { }); if (w) { wins[w]++; add(w, FINALS_POINTS.rr, PRIZE.F.floor); }
      for (const id of [g[i], g[j]]) P[id].fatigue = Math.max(0, P[id].fatigue - 3);
    }
    qual.push(g.slice().sort((a, b) => wins[b] - wins[a] || lockRank(S, ed, a) - lockRank(S, ed, b)).slice(0, 2)); // group ties: wins, then locked ranking
  }
  const f1 = playMatch(S, ed, qual[0][0], qual[1][1], 'SF', false, (id, rr) => { ed.lost![id] = rr; })!, f2 = playMatch(S, ed, qual[1][0], qual[0][1], 'SF', false, (id, rr) => { ed.lost![id] = rr; })!;
  add(f1, FINALS_POINTS.sf, 150000); add(f2, FINALS_POINTS.sf, 150000);
  const champ = playMatch(S, ed, f1, f2, 'F', false, (id, rr) => { ed.lost![id] = rr; })!; add(champ, FINALS_POINTS.f, PRIZE.F.champ);
  ed.done = true; ed.champion = champ; ed.runnerUp = champ === f1 ? f2 : f1; P[champ].titles++;
  for (const id of ids) if (pts[id]) P[id].res.push({ ed: ed.id, pts: pts[id], exp: ed.startWk + 53, yr: ed.year, cls: 'f' });
  S.world.champs.push({ ed: ed.id, name: ed.name, year: ed.year, band: 'F', cat: ed.cat, w: champ, f: ed.runnerUp, wk: S.wk });
  const t = uT(S, ed.id);
  if (t) { t.prize = prize[uid] ?? 0; t.pts = pts[uid] ?? 0; addLedger(S, 'Prize money', t.prize, ed.id); closeUser(S, ed, t, champ === uid ? 'W' : ed.lost![uid] ?? 'RR', false); }
  ed.md = []; ed.lost = undefined; ed.log = undefined; delete (ed as any).lock;
}

export function playEvents(S: State) {
  const wk = S.wk;
  for (const ed of S.cal) {
    if (ed.cancelled || ed.done) continue;
    if (ed.band === 'F') { if (ed.startWk === wk) playFinals(S, ed); continue; }
    if (ed.band === 'GS' && ed.entryWk === wk) { qualify(S, ed); continue; }
    if (ed.startWk === wk) {
      if (ed.band !== 'GS') qualify(S, ed);
      startBracket(S, ed);
      const total = Math.log2(ed.slots!.length);
      playRounds(S, ed, ed.weeks === 2 ? Math.floor(total / 2) : total);
    } else if (ed.weeks === 2 && ed.startWk + 1 === wk && ed.slots) playRounds(S, ed, 99);
  }
}
export { strength, fmtDate };
