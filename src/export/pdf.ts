// Client-side exports (spec 20): a paginated, text-selectable PDF review and the versioned JSON archive.
// Nothing is uploaded. PDF libraries load on demand so they never slow down ordinary play.
import { BAND_NAME, RULES_SUMMARY } from '../core/balance';
import { SNAPSHOT_NOTE, countryName } from '../core/content';
import { buildArchive, h2h, legacy, notableWins, peakSnap, retireSnap, retrospective, roundName, safeName, totals } from '../core/selectors';
import { ABILITIES, ABILITY_NAMES, State } from '../core/types';
import { saveFile } from '../ui/store';

const fileBase = (S: State) => `${safeName(S.players[S.userId].name)}-${S.u.seasons[0]?.year ?? 2026}-${S.retire?.year ?? S.year}`;
const m$ = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
// jsPDF's built-in fonts cover Latin-1 only: transliterate anything else so names stay readable instead of garbled
const tx = (s: unknown) => String(s ?? '').normalize('NFC').replace(/[–—]/g, '-').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/★/g, '*').replace(/[^\x00-\xff]/g, c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x00-\xff]/g, '?'));

export async function exportArchive(S: State, redact: boolean) {
  const a = buildArchive(S, { redact, nowUtc: new Date().toISOString() });
  await saveFile(`${fileBase(S)}-archive.json`, JSON.stringify(a, null, 1), 'application/json');
}
export async function exportPdf(S: State, redact: boolean) {
  const [{ jsPDF }, auto] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = (auto as any).default ?? (auto as any).autoTable;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }), W = doc.internal.pageSize.getWidth(), M = 42, u = S.u, me = S.players[S.userId], t = totals(S), leg = legacy(S), pk = peakSnap(S), rs = retireSnap(S);
  let y = M;
  const need = (h: number) => { if (y + h > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = M; } };
  const h1 = (s: string) => { need(40); doc.setFont('times', 'bold').setFontSize(17).setTextColor(23, 33, 43); doc.text(tx(s), M, y); y += 22; };
  const para = (s: string, size = 10, color: [number, number, number] = [23, 33, 43]) => { doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...color); const lines = doc.splitTextToSize(tx(s), W - 2 * M); need(lines.length * (size + 3)); doc.text(lines, M, y); y += lines.length * (size + 3) + 5; };
  const table = (head: string[], body: (string | number)[][], opts: any = {}) => { autoTable(doc, { startY: y, head: [head.map(tx)], body: body.map(r => r.map(tx)), margin: { left: M, right: M, bottom: 50 }, styles: { fontSize: 8, cellPadding: 3, textColor: [23, 33, 43] }, headStyles: { fillColor: [23, 59, 87], textColor: 255 }, alternateRowStyles: { fillColor: [246, 245, 240] }, ...opts }); y = (doc as any).lastAutoTable.finalY + 16; };
  const title = `${me.name}: career review`;
  doc.setProperties({ title: tx(title), subject: 'Tennis Career 2026 retirement review', creator: 'Tennis Career 2026' });
  doc.setFont('times', 'bold').setFontSize(26).setTextColor(23, 59, 87); doc.text(tx(me.name), M, y + 10); y += 34;
  para(`${countryName(me.country)} · ${S.tour === 'atp' ? "men's" : "women's"} tour · ${me.hand === 'R' ? 'right-handed' : 'left-handed'} · career ${u.seasons[0]?.year ?? 2026} to ${S.retire?.year ?? S.year}`, 11, [91, 102, 112]);
  doc.setFont('times', 'bold').setFontSize(15).setTextColor(23, 33, 43); doc.text(tx(leg.label), M, y + 4); y += 20;
  para(leg.reasons.join(' · '));
  table(['Career high', 'Major titles', 'Titles', 'Played matches', 'Weeks at No. 1', 'Prize money'], [[t.bestRank < 9999 ? `${t.bestRank} (${t.bestRankDate})` : '-', t.majors, `${t.titles} (${t.tourTitles} main tour, ${t.lowerTitles} lower tour)`, `${t.w}-${t.l}`, t.weeksNo1, m$(t.prize)]]);
  h1('Retrospective'); for (const p of retrospective(S, redact)) para(p);
  para(`Career profile: ${u.profileSelected ? 'selected' : 'randomly generated'} (${{ goat: 'GOAT Contention', contender: 'Contender', grinder: 'Grinder' }[u.profile]}). Retired ${S.retire?.date ?? ''} (${S.retire?.reason ?? 'active'}).${redact ? ' Personal-life details have been left out of this export at the player\'s request.' : ''}`, 9, [91, 102, 112]);
  h1('Abilities: start, peak and retirement');
  table(['Ability', 'Start (age 19)', pk ? `Peak (${pk.date}, age ${pk.age})` : 'Peak', 'Retirement'], ABILITIES.map(a => [ABILITY_NAMES[a], Math.round(u.startAb[a]), pk ? Math.round(pk.ab[a]) : '-', Math.round((rs ?? me).ab[a])]));
  para('The peak is a complete snapshot from one date in the career. It never combines best values from different ages, and temporary condition is excluded.', 8, [91, 102, 112]);
  h1('Season by season');
  table(['Year', 'Age', 'Year-end rank', 'Best rank', 'Points', 'W-L', 'Titles', 'Finals', 'Best major', 'Prize', 'Weeks injured'], u.seasons.map(s => [s.year, s.age, `${s.rank}${s.no1 ? ' *' : ''}`, s.bestRank, s.pts, `${s.w}-${s.l}`, s.titles, s.finals, roundName(s.majorsBest), m$(s.prize), s.injWeeks]));
  const majors = u.tourneys.filter(x => x.band === 'GS' && x.reached && x.reached !== 'WD');
  if (majors.length) { h1('Majors'); table(['Year', 'Tournament', 'Entry', 'Result'], majors.map(x => [x.year, x.name, x.status, x.title ? 'Champion' : roundName(x.reached)])); }
  const riv = h2h(S).slice(0, 25);
  if (riv.length) { h1('Head-to-head (most frequent opponents)'); table(['Opponent', 'Country', 'Wins', 'Losses', 'Last met'], riv.map(r => [r.name + (r.real ? '' : ' (fictional)'), r.country, r.w, r.l, r.last])); }
  const wins = notableWins(S, 12);
  if (wins.length) { h1('Notable wins'); table(['Year', 'Opponent (rank at the time)', 'Tournament', 'Round', 'Score'], wins.map(m => [m.year, `${m.oppName} (${m.oppRank})`, u.tourneys.find(x => x.ed === m.ed)?.name ?? '', roundName(m.round), m.score])); }
  if (u.ach.length) { h1('Milestones'); table(['Date', 'Milestone'], u.ach.map(a => [a.date, a.name])); }
  if (u.injuries.length) { h1('Health history'); table(['Date', 'Problem', 'Severity', 'Weeks out', 'Rehabilitation', 'Lasting effect'], u.injuries.map(i => [i.date, i.loc, i.sev, i.weeks, i.rehab, i.perm ? i.perm.map(p => `${ABILITY_NAMES[p.ab]} -${p.loss}`).join(', ') : 'none'])); }
  h1('Coaching and sponsorship');
  table(['Coach', 'Tier', 'From', 'To'], u.coachHistory.map(c => [c.name, c.tier, c.since, c.left ?? '']));
  if (u.sponsorHistory.length) table(['Sponsor (fictional economy)', 'Type', 'From', 'To'], u.sponsorHistory.map(s => [s.name, s.slot, s.since, s.until - 1]));
  const ch = u.choices.filter(c => !redact || !c.personal);
  if (ch.length) { h1('Decisions and consequences'); table(['Date', 'Situation', 'Choice', 'Effect'], ch.map(c => [c.date, c.title, c.label, c.fx + (c.follow?.done ? '; later consequence recorded' : '')]), { columnStyles: { 2: { cellWidth: 170 }, 3: { cellWidth: 150 } } }); }
  doc.addPage(); y = M; h1('Complete record: every tournament');
  table(['Year', 'Dates', 'Tournament', 'Level', 'Surface', 'Entry', 'Result', 'Pts', 'Prize'], u.tourneys.map(x => [x.year, x.dates, x.name + (x.prov ? ' (provisional)' : ''), BAND_NAME[x.band], x.surface, x.status, x.title ? 'Champion' : roundName(x.reached), x.pts, m$(x.prize)]), { styles: { fontSize: 7, cellPadding: 2 } });
  h1('Complete record: every match');
  table(['Year', 'Tournament', 'Round', 'Opponent (rank)', 'Result', 'Score', 'Type'], u.matches.map(m => [m.year, u.tourneys.find(x => x.ed === m.ed)?.name ?? '', m.round, `${m.oppName} (${m.oppRank})`, m.won ? 'W' : 'L', m.score, m.cls === 'wo' ? 'walkover (not a played match)' : m.cls === 'ret' ? 'retirement' : 'played']), { styles: { fontSize: 7, cellPadding: 2 } });
  h1('About this record');
  para(`${SNAPSHOT_NOTE[S.tour]} All results from 1 January 2026 are simulated. ${RULES_SUMMARY.join(' ')}`, 8, [91, 102, 112]);
  para(`Engine ${S.v.engine} · balance ${S.v.balance} · content ${S.v.content} · career ${S.careerId}. A free private hobby game; not affiliated with or endorsed by any tour, tournament, player or brand.`, 8, [91, 102, 112]);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(91, 102, 112); doc.text(tx(`${me.name} · career review`), M, doc.internal.pageSize.getHeight() - 24); doc.text(`Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: 'right' }); }
  await saveFile(`${fileBase(S)}-career-review.pdf`, doc.output('blob'), 'application/pdf');
}
