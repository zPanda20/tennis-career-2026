// Junior-start careers through each path: npx tsx tests/jcareer.ts [atp|wta] [profile] [n]
import { loadContent } from './load';
import { autoStep, baseSetup } from './auto';
import { createCareer } from '../src/core/world';
const tour = (process.argv[2] ?? 'atp') as 'atp' | 'wta', prof = (process.argv[3] ?? 'contender') as any, N = +(process.argv[4] ?? 2);
const C = loadContent();
for (const path of ['pro', 'college', 'academy'] as const) for (let i = 0; i < N; i++) {
  const S = createCareer({ ...baseSetup(tour, prof, `jc-${path}-${i}`), start: 'junior', academy: i % 2 ? 'elite' : 'national' }, C, '2026-01-01T00:00:00Z');
  const line: string[] = []; let yr = S.year;
  for (let n = 0; S.year < 2033 && S.phase !== 'retired' && n < 20000; n++) {
    autoStep(S, C, n, { path });
    if (S.year !== yr) { yr = S.year; const me = S.players[S.userId]; line.push(`${yr - 1}:${S.u.stage}${me.junior ? ` j${S.jrank?.[S.userId]}` : ''} r${S.pts[S.userId] > 0 ? S.rank[S.userId] : '-'} lv${(Object.values(me.ab).reduce((a, b) => a + b, 0) / 8).toFixed(1)} $${Math.round(S.u.cash / 1000)}k`); }
  }
  const me = S.players[S.userId], col = (S.u.college ?? []).map(c => `${c.year} ${c.w}-${c.l}${c.ncaa ? ' ' + c.ncaa : ''}`).join('; ');
  console.log(`${path.padEnd(7)} #${i} speed ${me.speed} pot ${me.pot?.toFixed(0)} jbest ${me.jbest} jtitles ${me.jtitles} | ${line.join(' · ')}${col ? ` | college ${col}` : ''}`);
}
