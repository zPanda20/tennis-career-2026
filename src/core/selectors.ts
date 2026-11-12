// Shared selectors over canonical records (spec 18.1): every screen and export derives totals from here,
// so no two views can count the same outcome differently.
import { ENGINE_VERSION, BALANCE_VERSION, RULES_SUMMARY } from './balance';
import { SNAPSHOT_NOTE, countryName, fmtDate } from './content';
import { ABILITIES, STYLE_NAMES, State, Surface, UMatch } from './types';

export interface Totals {
  w: number; l: number; woW: number; woL: number; retW: number; retL: number; qualW: number; qualL: number; mdW: number; mdL: number; bySurface: Record<Surface, { w: number; l: number }>;
  titles: number; majors: number; tourTitles: number; lowerTitles: number; finalsTitles: number; runnerUps: number; majorFinals: number; prize: number; events: number; bestRank: number; bestRankDate: string; weeksNo1: number; yeNo1: number;
}
const MAIN = new Set(['T250', 'T500', 'T1000', 'GS', 'F']);
export function totals(S: State): Totals {
  const u = S.u, t: Totals = { w: 0, l: 0, woW: 0, woL: 0, retW: 0, retL: 0, qualW: 0, qualL: 0, mdW: 0, mdL: 0, bySurface: { hard: { w: 0, l: 0 }, clay: { w: 0, l: 0 }, grass: { w: 0, l: 0 } }, titles: 0, majors: 0, tourTitles: 0, lowerTitles: 0, finalsTitles: 0, runnerUps: 0, majorFinals: 0, prize: 0, events: 0, bestRank: 9999, bestRankDate: '', weeksNo1: u.no1Weeks, yeNo1: u.seasons.filter(s => s.no1).length };
  for (const m of u.matches) {
    if (m.cls === 'wo') { m.won ? t.woW++ : t.woL++; continue; } // walkovers are never played matches
    m.won ? t.w++ : t.l++; if (m.cls === 'ret') m.won ? t.retW++ : t.retL++;
    if (m.qual) m.won ? t.qualW++ : t.qualL++; else m.won ? t.mdW++ : t.mdL++;
    m.won ? t.bySurface[m.surface].w++ : t.bySurface[m.surface].l++;
  }
  for (const x of u.tourneys) {
    if (!x.reached || x.reached === 'WD') continue;
    t.events++; t.prize += x.prize;
    if (x.title) { t.titles++; if (x.band === 'GS') t.majors++; else if (x.band === 'F') t.finalsTitles++; if (MAIN.has(x.band)) t.tourTitles++; else t.lowerTitles++; }
    else if (x.reached === 'F') { t.runnerUps++; }
    if (x.band === 'GS' && x.final) t.majorFinals++;
  }
  for (const h of u.rankHist) if (h.rank < t.bestRank) { t.bestRank = h.rank; t.bestRankDate = fmtDate(new Date(Date.UTC(2026, 0, 5) + h.wk * 6048e5)); }
  return t;
}
export interface H2H { opp: string; name: string; real: boolean; country: string; w: number; l: number; last: number; bestRank: number }
export function h2h(S: State): H2H[] {
  const map = new Map<string, H2H>();
  for (const m of S.u.matches) {
    if (m.cls === 'wo') continue;
    const r = map.get(m.opp) ?? { opp: m.opp, name: m.oppName, real: m.oppReal, country: m.oppCountry, w: 0, l: 0, last: 0, bestRank: 9999 };
    m.won ? r.w++ : r.l++; r.last = m.year; r.bestRank = Math.min(r.bestRank, m.oppRank); map.set(m.opp, r);
  }
  return [...map.values()].sort((a, b) => b.w + b.l - (a.w + a.l) || a.bestRank - b.bestRank);
}
export const notableWins = (S: State, n = 10): UMatch[] => S.u.matches.filter(m => m.won && m.cls !== 'wo' && !m.qual).sort((a, b) => a.oppRank - b.oppRank || a.wk - b.wk).slice(0, n);
export const peakSnap = (S: State) => S.u.snaps.filter(s => s.src !== 'retirement' && !s.src.startsWith('season')).sort((a, b) => b.index - a.index || a.wk - b.wk)[0] ?? S.u.snaps[0];
export const retireSnap = (S: State) => S.u.snaps.find(s => s.src === 'retirement');

export function legacy(S: State): { label: string; reasons: string[] } {
  const t = totals(S), u = S.u, ye100 = u.seasons.filter(s => s.rank <= 100).length, ye10 = u.seasons.filter(s => s.rank <= 10).length, reasons: string[] = [];
  let label: string;
  if (t.majors >= 8 || u.ach.some(a => a.id === 'pentagon')) label = 'One of the greats of the era';
  else if (t.majors >= 2) label = 'Multiple major champion';
  else if (t.majors === 1) label = 'Major champion';
  else if (t.bestRank === 1) label = 'World No. 1';
  else if (ye10 >= 3) label = 'Top-10 mainstay';
  else if (t.bestRank <= 10) label = 'Top-10 player';
  else if (t.tourTitles >= 1) label = 'Tour title winner';
  else if (ye100 >= 3) label = 'Established tour professional';
  else if (t.bestRank <= 100) label = 'Top-100 breakthrough';
  else if (t.lowerTitles >= 3) label = 'Lower-tour champion';
  else if (u.seasons.length <= 3 && S.retire?.reason === 'health') label = 'A career cut short';
  else label = 'Touring professional';
  if (t.majors) reasons.push(`${t.majors} major ${t.majors === 1 ? 'title' : 'titles'}`);
  if (t.weeksNo1) reasons.push(`${t.weeksNo1} ${t.weeksNo1 === 1 ? 'week' : 'weeks'} at No. 1`);
  reasons.push(`Career-high ranking of ${t.bestRank}`);
  if (t.titles) reasons.push(`${t.titles} ${t.titles === 1 ? 'title' : 'titles'} (${t.tourTitles} main tour, ${t.lowerTitles} lower tour)`);
  if (ye100) reasons.push(`${ye100} year-end top-100 ${ye100 === 1 ? 'finish' : 'finishes'}`);
  reasons.push(`${t.w} wins from ${t.w + t.l} played matches`);
  return { label, reasons };
}
/** Retrospective assembled from recorded facts only (spec 16.5). Clauses without evidence are omitted. */
export function retrospective(S: State, redact = false): string[] {
  const u = S.u, t = totals(S), p = S.players[S.userId], out: string[] = [], first = u.seasons[0], last = u.seasons[u.seasons.length - 1];
  if (!first) return ['The career ended before a full season was completed.'];
  out.push(`${p.name} began on the lower tour in ${first.year}, ranked ${u.startRank}, and reached a career-high ranking of ${t.bestRank}${t.bestRankDate ? ` in ${t.bestRankDate.split(' ').slice(1).join(' ')}` : ''}.`);
  const ft = u.tourneys.find(x => x.title), t100 = u.ach.find(a => a.id === 'top100');
  if (ft || t100) out.push(`${ft ? `The first title came at ${ft.name} in ${ft.year}` : ''}${ft && t100 ? ', and the' : t100 ? 'The' : ''}${t100 ? ` top 100 was reached in ${t100.year}` : ''}.`);
  const best = [...u.seasons].sort((a, b) => b.titles - a.titles || a.rank - b.rank)[0];
  if (best && (best.titles || best.rank <= 100)) out.push(`The strongest season was ${best.year}: a ${best.w}-${best.l} record${best.titles ? `, ${best.titles} ${best.titles === 1 ? 'title' : 'titles'}` : ''} and a year-end ranking of ${best.rank}.`);
  const majors = u.tourneys.filter(x => x.title && x.band === 'GS');
  if (majors.length) out.push(`Major titles: ${majors.map(m => `${m.name} ${m.year}`).join(', ')}.`);
  else { const bm = u.tourneys.filter(x => x.band === 'GS' && x.reached && !x.reached.startsWith('Q') && x.reached !== 'WD').sort((a, b) => ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'].indexOf(a.reached) - ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'].indexOf(b.reached))[0]; if (bm) out.push(`The best major result was ${roundName(bm.reached).toLowerCase()} at ${bm.name} in ${bm.year}.`); }
  const riv = h2h(S)[0];
  if (riv && riv.w + riv.l >= 4) out.push(`The most frequent opponent was ${riv.name}: ${riv.w} wins from ${riv.w + riv.l} meetings.`);
  const inj = [...u.injuries].sort((a, b) => b.weeks - a.weeks)[0];
  if (inj && inj.weeks >= 8) {
    out.push(`A ${inj.sev} ${inj.loc} problem in ${inj.year} meant ${inj.weeks} weeks away${inj.perm ? ' and left lasting effects' : ''}.`);
    const after = u.tourneys.find(x => x.title && x.wk > inj.wk + inj.weeks); if (after) out.push(`The comeback brought another title at ${after.name} in ${after.year}.`);
  }
  if (!redact) { const ch = u.choices.find(c => c.follow?.done); if (ch) out.push(`One decision that echoed later: "${ch.title}" (${ch.year}), when the choice was to ${ch.label.charAt(0).toLowerCase() + ch.label.slice(1)}.`); }
  const why = S.retire?.reason === 'health' ? 'on medical advice' : S.retire?.reason === 'age ceiling' ? `at the age ceiling of the game, after turning 40` : 'by choice';
  if (S.retire) out.push(`${p.name} retired ${why} after the ${S.retire.year} season, ranked ${last.rank}, with ${t.w} wins from ${t.w + t.l} played matches and ${t.titles} ${t.titles === 1 ? 'title' : 'titles'}.`);
  return out;
}
export const roundName = (r: string) => ({ W: 'Champion', F: 'Final', SF: 'Semifinal', QF: 'Quarterfinal', RR: 'Group stage', WD: 'Withdrew', '': '–' } as Record<string, string>)[r] ?? (r.startsWith('Q') ? `Qualifying round ${r.slice(1)}` : r.startsWith('R') ? `Round of ${r.slice(1)}` : r);

function checksum(s: string): string { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'); }
export { checksum };

/** Versioned retired-career archive (spec 20.3). Every required collection exists even when empty. */
export function buildArchive(S: State, opts: { redact: boolean; nowUtc: string }) {
  const u = S.u, p = S.players[S.userId], t = totals(S), peak = peakSnap(S), ret = retireSnap(S);
  const payload = {
    player: { playerId: p.id, name: p.name, nationality: p.country, nationalityName: countryName(p.country), born: p.born, hand: p.hand, pronouns: u.pronouns, tour: S.tour, style: STYLE_NAMES[p.style], fictional: true },
    startingContext: { startDate: '2026-01-01', startRank: u.startRank, startAbilities: u.startAb, focusSurface: u.focusSurface, skillInterests: u.skills, snapshot: SNAPSHOT_NOTE[S.tour], rules: RULES_SUMMARY },
    careerProfile: { profile: u.profile, provenance: u.profileSelected ? 'selected' : 'randomly generated', status: S.phase === 'retired' ? 'retired' : 'active', retirement: S.retire ?? null },
    peakSnapshot: peak ?? null, retirementSnapshot: ret ?? null,
    seasons: u.seasons, tournaments: u.tourneys.map(({ log, ...x }) => x), matches: u.matches,
    headToHead: h2h(S), rankings: { best: t.bestRank, bestDate: t.bestRankDate, weeksAtNo1: t.weeksNo1, yearEnd: u.seasons.map(s => ({ year: s.year, rank: s.rank, pts: s.pts })), weekly: u.rankHist },
    honours: { titles: t.titles, majorTitles: t.majors, mainTourTitles: t.tourTitles, lowerTourTitles: t.lowerTitles, tourFinalsTitles: t.finalsTitles, runnerUps: t.runnerUps, awards: { yearEndNo1: t.yeNo1 }, achievements: u.ach, totals: t },
    choices: opts.redact ? u.choices.filter(c => !c.personal) : u.choices, personalNarrativeRedacted: opts.redact,
    healthHistory: u.injuries, coachingHistory: u.coachHistory, sponsorshipHistory: u.sponsorHistory, attributeHistory: u.attr,
    financialSummary: { finalCash: Math.round(u.cash), prizeMoney: t.prize, byCategory: u.ledger.reduce((m, l) => { m[l.cat] = Math.round((m[l.cat] ?? 0) + l.amt); return m; }, {} as Record<string, number>), currency: 'career dollars (fictional economy)' },
    eventLedger: S.ledger, retrospective: retrospective(S, opts.redact), legacy: legacy(S),
  };
  const body = JSON.stringify(payload);
  return { format: 'tennis-career-archive', schemaVersion: 1, archiveId: `arc-${S.careerId}-${checksum(body).slice(0, 8)}`, careerId: S.careerId, createdAtUtc: opts.nowUtc, engineVersion: ENGINE_VERSION, balanceVersion: BALANCE_VERSION, contentVersion: S.v.content, ...payload, integrity: { algorithm: 'cyrb53-hex', checksum: checksum(body), note: 'Detects accidental corruption only. It does not prove legitimate progression.' } };
}
export function buildBackup(S: State, nowUtc: string) { const body = JSON.stringify(S); return { format: 'tennis-career-backup', schemaVersion: S.v.schema, savedAtUtc: nowUtc, checksum: checksum(body), state: S }; }
export function validateBackup(x: any): State {
  if (!x || x.format !== 'tennis-career-backup') throw new Error(x?.format === 'tennis-career-archive' ? 'This is a retired-career archive. Archives are read-only and cannot be resumed as an active career.' : 'This file is not a Tennis Career backup.');
  if (x.schemaVersion !== 1) throw new Error(`Unsupported backup version ${x.schemaVersion}.`);
  const S = x.state as State;
  if (!S || typeof S.careerId !== 'string' || !S.players || !S.u || !S.players[S.userId]) throw new Error('The backup is missing required career data.');
  if (checksum(JSON.stringify(S)) !== x.checksum) throw new Error('The backup failed its integrity check and may be corrupted.');
  for (const id of S.active) { const p = S.players[id]; if (!p) throw new Error('The backup references a missing player.'); for (const k of ABILITIES) if (!Number.isFinite(p.ab[k])) throw new Error('The backup contains invalid ability values.'); }
  return S;
}
export const safeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';
