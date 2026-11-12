// Balance run: automated careers per profile and tour, reporting the share that win a major or reach the top 10 (spec 23.4).
// Usage: tsx tests/balance.ts <tour> <profile> <count> [seedPrefix]
import { loadContent } from './load';
import { autoCareer, baseSetup } from './auto';
const [tour, profile, count, prefix = 'b'] = process.argv.slice(2);
const C = loadContent(); let major = 0, top10 = 0, top100 = 0; const best: number[] = [], inj: number[] = [], perm: number[] = [], majors: number[] = [], ratio: number[] = [];
for (let i = 0; i < +count; i++) {
  const S = autoCareer(C, baseSetup(tour as any, profile as any, `${prefix}${i}x${'y'.repeat(i % 6)}`), { retireAge: 35 });
  const u = S.u, m = u.tourneys.filter(t => t.title && t.band === 'GS').length, br = u.rankHist.reduce((b, h) => Math.min(b, h.rank), 9999);
  if (m) major++; if (br <= 10) top10++; if (br <= 100) top100++; best.push(br); majors.push(m);
  inj.push(u.seasons.reduce((t, s) => t + s.injWeeks, 0)); perm.push(u.injuries.filter(x => x.perm).length);
  const c = u.seasons.slice(0, 8).reduce((t, s) => t + s.devComp, 0), tr = u.seasons.slice(0, 8).reduce((t, s) => t + s.devTrain, 0); ratio.push(c / (c + tr));
}
best.sort((a, b) => a - b); const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(JSON.stringify({ tour, profile, n: +count, major: major / +count, top10: top10 / +count, top100: top100 / +count, medianBest: med(best), bestRanks: best, majors, medianInjWeeks: med(inj), permInjuries: perm.reduce((a, b) => a + b, 0), compShare: +(ratio.reduce((a, b) => a + b, 0) / ratio.length).toFixed(2) }));
