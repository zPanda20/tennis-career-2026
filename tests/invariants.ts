// Sporting and data invariants (spec 21.2). Run with: npm test
import { loadContent } from './load';
import { autoCareer, autoStep, baseSetup } from './auto';
import { validateContent } from '../src/core/content';
import { BEST_N, ECON } from '../src/core/balance';
import { simulateMatch, expectedWin } from '../src/core/match';
import { execute } from '../src/core/sim';
import { buildArchive, buildBackup, h2h, peakSnap, totals, validateBackup } from '../src/core/selectors';
import { createCareer, peakIndex } from '../src/core/world';
import type { State } from '../src/core/types';

const C = loadContent(); let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) fails++; };

ok('content validates', validateContent(C).length === 0, validateContent(C).join('; '));

// overlapping commitments: checked every simulated week, for every player
let overlaps = 0, weeksChecked = 0;
(globalThis as any).__tcAfterEntries = (S: State) => {
  weeksChecked++; const seen = new Map<string, string>();
  for (const ed of S.cal) { if (ed.cancelled || ed.done) continue; const live = ed.startWk === S.wk || (ed.weeks === 2 && ed.startWk + 1 === S.wk) || (ed.band === 'GS' && ed.entryWk === S.wk);
    if (!live) continue; const ids = ed.band === 'GS' && ed.entryWk === S.wk ? ed.q : [...ed.md, ...ed.q];
    for (const id of ids) { if (seen.has(id) && seen.get(id) !== ed.id) overlaps++; seen.set(id, ed.id); } }
};

for (const tour of ['atp', 'wta'] as const) {
  const mk = () => createCareer(baseSetup(tour, 'contender', 'inv-' + tour), C, '2026-01-01T00:00:00Z');
  const run = (S: State, steps: number, from = 0) => { for (let n = from; n < from + steps && S.phase !== 'retired'; n++) autoStep(S, C, n); return S; };
  const a = run(mk(), 14), b = run(mk(), 14);
  ok(`${tour}: same seed and commands give identical state`, JSON.stringify(a) === JSON.stringify(b));
  const before = JSON.stringify(a); execute(a, C, { id: a.lastCmd!, type: 'Retire' });
  ok(`${tour}: a repeated command id does not run twice`, JSON.stringify(a) === before);
  // backup round trip, then both copies continue identically
  const restored = validateBackup(JSON.parse(JSON.stringify(buildBackup(a, '2030-01-01T00:00:00Z'))));
  run(a, 6, 14); run(restored, 6, 14);
  ok(`${tour}: restored backup continues to the same future`, JSON.stringify(a) === JSON.stringify(restored));
  let bad = false; try { const x = JSON.parse(JSON.stringify(buildBackup(a, 'x'))); x.state.u.cash += 1; validateBackup(x); } catch { bad = true; }
  ok(`${tour}: corrupted backup is rejected`, bad);
  // ranking totals reconcile with eligible records
  let rankBad = 0;
  for (const id of a.active) { const p = a.players[id]; const live = p.res.filter(r => r.exp > a.wk); const fin = live.filter(r => r.cls === 'f').reduce((t, r) => t + r.pts, 0); const best = live.filter(r => r.cls !== 'f').map(r => r.pts).sort((x, y) => y - x).slice(0, BEST_N).reduce((t, x) => t + x, 0); if (Math.abs(fin + best - a.pts[id]) > 1) rankBad++; }
  ok(`${tour}: ranking points equal best-${BEST_N} eligible records`, rankBad === 0, `${rankBad} mismatches`);
  const sorted = a.order.every((id, i) => i === 0 || a.pts[a.order[i - 1]] >= a.pts[id]); ok(`${tour}: ranking order is by points`, sorted);
  ok(`${tour}: every completed event has exactly one champion`, a.world.champs.every(c => !!c.w) && new Set(a.world.champs.map(c => c.ed)).size === a.world.champs.length);
}

// full career to retirement
const S = autoCareer(C, baseSetup('atp', 'goat', 'inv-full'));
const u = S.u, t = totals(S), me = S.players[S.userId];
ok('career ends retired at the age ceiling', S.phase === 'retired' && S.retire!.reason === 'age ceiling', JSON.stringify(S.retire));
ok('no overlapping commitments for any player in any week', overlaps === 0, `${overlaps} overlaps in ${weeksChecked} weeks`);
ok('each match is recorded once', new Set(u.matches.map(m => m.id)).size === u.matches.length);
const played = u.matches.filter(m => m.cls !== 'wo');
ok('walkovers are excluded from played totals', t.w + t.l === played.length && t.woW + t.woL === u.matches.length - played.length);
ok('season totals reconcile with match records', u.seasons.reduce((x, s) => x + s.w + s.l, 0) === played.length, `${u.seasons.reduce((x, s) => x + s.w + s.l, 0)} vs ${played.length}`);
ok('head-to-head excludes walkovers', h2h(S).reduce((x, r) => x + r.w + r.l, 0) === played.length);
ok('titles reconcile with tournament records', t.titles === u.tourneys.filter(x => x.title).length && u.seasons.reduce((x, s) => x + s.titles, 0) === t.titles);
ok('cash equals starting cash plus the ledger', Math.abs(ECON.startCash + u.ledger.reduce((x, l) => x + l.amt, 0) - u.cash) < u.ledger.length, `${Math.round(u.cash)}`);
const pk = peakSnap(S); ok('peak is one snapshot from one date', !!pk && Math.abs(pk.index - peakIndex(pk as any)) < 0.01 && u.snaps.filter(s => s.src !== 'retirement' && !s.src.startsWith('season')).length === 1);
ok('no match played after the age ceiling', u.matches.every(m => m.year - +me.born.slice(0, 4) <= 40));
const userWeeks = new Map<number, string>(); let uOver = 0;
for (const x of u.tourneys) if (x.reached && x.reached !== 'WD' && !x.reached.startsWith('Q')) { if (userWeeks.has(x.wk)) uOver++; userWeeks.set(x.wk, x.ed); }
ok('user never plays two main draws in one week', uOver === 0);
const arc: any = buildArchive(S, { redact: true, nowUtc: '2047-01-01T00:00:00Z' });
const req = ['format', 'schemaVersion', 'archiveId', 'careerId', 'createdAtUtc', 'engineVersion', 'balanceVersion', 'contentVersion', 'player', 'startingContext', 'careerProfile', 'peakSnapshot', 'retirementSnapshot', 'seasons', 'tournaments', 'matches', 'headToHead', 'rankings', 'honours', 'choices', 'healthHistory', 'coachingHistory', 'sponsorshipHistory', 'financialSummary', 'eventLedger', 'integrity'];
ok('archive has every required collection', req.every(k => arc[k] !== undefined), req.filter(k => arc[k] === undefined).join(','));
ok('redacted archive omits personal choices', arc.choices.every((c: any) => !c.personal) && arc.personalNarrativeRedacted === true);
let rej = false; try { validateBackup(arc); } catch { rej = true; } ok('an archive cannot be imported as an active career', rej);
ok('ledger sequence is monotonic', S.ledger.every((e, i) => i === 0 || e.seq > S.ledger[i - 1].seq));

// tennis scoring and probability sanity over many seeded matches
const pool = S.order.map(id => S.players[id]); let badScore = 0, upsets = 0, n = 0, calib = 0;
for (let i = 0; i < 3000; i++) {
  const a = pool[(i * 7) % 300], b = pool[(i * 13 + 5) % 300]; if (a === b) continue;
  for (const bestOf of [3, 5] as const) {
    const rules = { surface: (['hard', 'clay', 'grass'] as const)[i % 3], bestOf, tb10: i % 2 === 0, tour: 'atp' as const };
    const r = simulateMatch(a, b, rules, `t${i}-${bestOf}`); if (r.cls === 'ret') continue;
    const need = bestOf === 3 ? 2 : 3; let wa = 0, wb = 0;
    r.sets.forEach(s => { const [x, y] = s; const hi = Math.max(x, y), lo = Math.min(x, y); const valid = (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6)); if (!valid || (hi === 7 && lo === 6 && s[2] === undefined)) badScore++; x > y ? wa++ : wb++; });
    if (Math.max(wa, wb) !== need || (r.winner === 0) !== (wa > wb)) badScore++;
    const p = expectedWin(a, b, rules); n++; calib += (r.winner === 0 ? 1 : 0) - p; if ((p > 0.5) !== (r.winner === 0)) upsets++;
  }
}
ok('all simulated set and match scores are valid tennis scores', badScore === 0, `${badScore} invalid`);
ok('previews are calibrated against simulated results', Math.abs(calib / n) < 0.03, `mean error ${(calib / n).toFixed(4)}, upset rate ${(upsets / n).toFixed(2)}`);
console.log(fails ? `\n${fails} FAILED` : '\nAll invariants hold.'); process.exit(fails ? 1 : 0);
