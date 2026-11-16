// Calibration of junior development against the ITF junior → ATP dataset (Reid et al. update, 504 top-50 boys, 2004–2016).
// Runs the world from 2026 to the end of 2034 and follows the juniors born ${LO}–${HI} into the pro ranks.
// npx tsx tests/juniors.ts [atp|wta] [seeds]
import { loadContent } from './load';
import { autoStep, baseSetup } from './auto';
import { createCareer } from '../src/core/world';
import { ageOn, wkDate } from '../src/core/content';

const tour = (process.argv[2] ?? 'atp') as 'atp' | 'wta', nSeeds = +(process.argv[3] ?? 2), END = +(process.argv[4] ?? 2035), LO = +(process.argv[5] ?? 2008), HI = +(process.argv[6] ?? 2010);
const C = loadContent();
type Track = { born: number; jbest: number; best19: number; best22: number; best24: number; best: number; t250?: number; t100?: number; quit?: boolean; speed?: string; pot?: number };
const all: Track[] = []; const teens: number[] = []; const ageTop100: number[] = [];
for (let s = 0; s < nSeeds; s++) {
  const S = createCareer(baseSetup(tour, 'grinder', `jcal-${tour}-${s}`), C, '2026-01-01T00:00:00Z');
  const tr = new Map<string, Track>();
  for (const id of S.active) { const p = S.players[id]; if (p.junior && !p.user) tr.set(id, { born: +p.born.slice(0, 4), jbest: 9999, best19: 9999, best22: 9999, best24: 9999, best: 9999, speed: p.speed, pot: p.pot }); }
  let lastWk = -1, lastYear = S.year; const t0 = Date.now();
  for (let n = 0; S.year < END && S.phase !== 'retired' && n < 40000; n++) {
    autoStep(S, C, n);
    if (S.wk === lastWk) continue; lastWk = S.wk; const d = wkDate(S.wk);
    for (const [id, t] of tr) {
      const p = S.players[id]; if (!p) { if (t.best > 9000) t.quit = true; continue; } if (p.quit) t.quit = true;
      if (p.retired) continue;
      t.jbest = Math.min(t.jbest, p.jbest ?? 9999);
      const r = S.pts[id] > 0 ? S.rank[id] : 9999, age = ageOn(p.born, d);
      if (age < 19) t.best19 = Math.min(t.best19, r); if (age < 22) t.best22 = Math.min(t.best22, r); if (age < 24) t.best24 = Math.min(t.best24, r);
      t.best = Math.min(t.best, r);
      if (r <= 250 && t.t250 === undefined) t.t250 = age; if (r <= 100 && t.t100 === undefined) t.t100 = age;
    }
    if (S.year !== lastYear) {
      lastYear = S.year;
      for (const id of S.active) { const p = S.players[id]; if (p.junior && !p.user && !tr.has(id)) tr.set(id, { born: +p.born.slice(0, 4), jbest: 9999, best19: 9999, best22: 9999, best24: 9999, best: 9999, speed: p.speed, pot: p.pot }); } const top = S.order.slice(0, 100).map(id => ageOn(S.players[id].born, d));
      teens.push(top.filter(a => a < 20).length); ageTop100.push(top.sort((a, b) => a - b)[50]);
      process.stderr.write(`seed ${s} → ${S.year} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
    }
  }
  for (const t of tr.values()) if (t.born >= LO && t.born <= HI) all.push(t);
}
const med = (xs: number[]) => { if (!xs.length) return NaN; const a = xs.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const pct = (xs: Track[], f: (t: Track) => boolean) => xs.length ? `${Math.round((100 * xs.filter(f).length) / xs.length)}%` : '–';
console.log(`\n${tour.toUpperCase()} · ${nSeeds} worlds · ${all.length} juniors born ${LO}–${HI}\n`);
console.log('junior best | n   | top100<24 (data) | ever top50 (data) | ever top10 (data) | median high (data) | quit');
const bands: [string, number, number, string, string, string, string][] = [['1–3', 1, 3, '51%', '46%', '19%', '72'], ['4–10', 4, 10, '29%', '24%', '5%', '154'], ['11–20', 11, 20, '19%', '21%', '4%', '205'], ['21–50', 21, 50, '10%', '10%', '4%', '336'], ['51–100', 51, 100, '', '', '', ''], ['101+', 101, 99999, '', '', '', '']];
for (const [lab, a, b, d1, d2, d3, d4] of bands) {
  const xs = all.filter(t => t.jbest >= a && t.jbest <= b);
  console.log(`${lab.padEnd(11)} | ${String(xs.length).padEnd(3)} | ${pct(xs, t => t.best24 <= 100).padEnd(4)} (${d1.padEnd(3)})       | ${pct(xs, t => t.best <= 50).padEnd(4)} (${d2.padEnd(3)})        | ${pct(xs, t => t.best <= 10).padEnd(4)} (${d3.padEnd(3)})        | ${String(med(xs.map(t => t.best))).padEnd(5)} (${d4.padEnd(3)})         | ${pct(xs, t => !!t.quit)}`);
}
const top50 = all.filter(t => t.jbest <= 50), t10 = all.filter(t => t.best <= 10), t100 = all.filter(t => t.best <= 100);
console.log(`\nTop-50 juniors: best rank before 19 ${med(top50.map(t => t.best19))} (data 745), before 22 ${med(top50.map(t => t.best22))} (data 342)`);
console.log(`Age of first top 250 ${med(top50.filter(t => t.t250 !== undefined).map(t => t.t250!))} (data 21.0), first top 100 ${med(top50.filter(t => t.t100 !== undefined).map(t => t.t100!))} (data 22.2)`);
console.log(`Eventual top-10 (${t10.length}): best before 19 ${med(t10.map(t => t.best19))} (data ~190), before 22 ${med(t10.map(t => t.best22))} (data ~25); junior best ${med(t10.map(t => t.jbest))}`);
console.log(`Players from these cohorts reaching the top 100: ${t100.length} (${(t100.length / nSeeds / (HI - LO + 1)).toFixed(1)} per birth year); share who were top-50 juniors ${pct(t100, t => t.jbest <= 50)}`);
for (const sp of ['early', 'steady', 'late']) { const xs = all.filter(t => t.speed === sp); console.log(`  ${sp.padEnd(6)}: n ${xs.length}, junior top 50 ${pct(xs, t => t.jbest <= 50)}, top 100 by 24 ${pct(xs, t => t.best24 <= 100)}, of junior top-50 → top100<24 ${pct(xs.filter(t => t.jbest <= 50), t => t.best24 <= 100)}`); }
console.log(`Teenagers in the top 100 by year: ${teens.join(' ')} · median age of the top 100: ${ageTop100.map(a => a.toFixed(0)).join(' ')}`);
