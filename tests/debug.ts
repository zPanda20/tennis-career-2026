import { loadContent } from './load';
import { autoStep, baseSetup } from './auto';
import { createCareer, strength } from '../src/core/world';
import { routes } from '../src/core/agent';
const [tour, profile, seed, country] = process.argv.slice(2);
const C = loadContent(); const st = baseSetup(tour as any, profile as any, seed); if (country) st.country = country;
const S = createCareer(st, C, '2026-01-01T00:00:00Z');
console.log('country', st.country, 'rank', S.rank[S.userId]);
for (let n = 0; n < 14 && S.phase !== 'retired'; n++) {
  if (S.phase === 'plan') { const rs = routes(S); console.log(`Y${S.year} B${S.block} cash ${Math.round(S.u.cash)} rank ${S.rank[S.userId]} str ${strength(S.players[S.userId].ab).toFixed(1)} |`, rs.map(r => `${r.key}${r.recommended ? '*' : ''}:${r.picks.map(o => `${o.ed.cat.replace('ITF ', '')}/${o.status[0]}/${o.tc}/${o.cost}`).join(',')}`).join(' || ').slice(0, 420)); }
  autoStep(S, C, n);
  if (S.lastSummary && S.phase !== 'yearEnd') console.log('   ->', S.lastSummary.tourneys.map(id => { const t = S.u.tourneys.find(x => x.ed === id)!; return `${t.cat.replace('ITF ', '')}:${t.status}:${t.reached}`; }).join(' '), '|', S.lastSummary.notes.slice(0, 3).join(' / ').slice(0, 200));
}
