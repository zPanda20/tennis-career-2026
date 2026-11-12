import { loadContent } from './load';
import { validateContent } from '../src/core/content';
import { createCareer, strength } from '../src/core/world';
import { execute } from '../src/core/sim';
import { routes, featuredEvent } from '../src/core/agent';
import type { Setup, State } from '../src/core/types';
const C = loadContent();
console.log('content errors', validateContent(C), 'events', C.events.atp.length, C.events.wta.length);
const setup: Setup = { tour: (process.argv[2] as any) ?? 'atp', name: 'Test Player', country: 'USA', pronouns: 'they', birthMonth: 6, birthDay: 15, hand: 'R', avatar: 0, focusSurface: 'hard', skills: ['serve', 'fh'], profile: (process.argv[3] as any) ?? 'goat', adult: true, detail: 'quick', seed: process.argv[4] ?? 's1' };
let S: State = createCareer(setup, C, '2026-01-01T00:00:00Z');
const me = () => S.players[S.userId];
console.log('start rank', S.rank[S.userId], 'pts', S.pts[S.userId], 'str', strength(me().ab).toFixed(1), 'ceil', strength(me().ceil).toFixed(1));
let n = 0; const t0 = Date.now();
while (S.phase !== 'retired' && n < 400) {
  n++;
  if (S.phase === 'plan') {
    const rs = routes(S), r = rs.find(x => x.recommended) ?? rs[0], ev = featuredEvent(S);
    execute(S, C, { id: 'c' + n, type: 'CommitBlock', plan: { weeks: r.weeks, route: r.key, lifeEv: ev?.id, lifeChoice: ev ? 0 : undefined }, pol: S.u.pol });
  } else if (S.phase === 'interrupt') execute(S, C, { id: 'c' + n, type: 'ResolveInjury', rehab: 'conservative' });
  else if (S.phase === 'yearEnd') {
    const s = S.u.seasons[S.u.seasons.length - 1];
    console.log(s.year, 'age', s.age, 'rank', s.rank, 'pts', s.pts, `${s.w}-${s.l}`, 'titles', s.titles, 'ev', s.events, 'major', s.majorsBest, 'str', strength(me().ab).toFixed(1), 'dev', s.dev, `(${s.devComp}/${s.devTrain})`, 'cash', Math.round(S.u.cash), 'inj', s.injWeeks,
      '| top3', S.order.slice(0, 3).map(id => `${S.players[id].name.split(' ').pop()} ${strength(S.players[id].ab).toFixed(0)}`).join(', '), '| r100', strength(S.players[S.order[99]].ab).toFixed(0), 'r500', strength(S.players[S.order[499]].ab).toFixed(0));
    execute(S, C, { id: 'c' + n, type: 'YearEnd', coach: S.pending?.coachOffers?.[0]?.id ?? 'keep', sponsors: (S.pending?.sponsorOffers ?? []).map(o => o.id), retire: false });
  }
}
console.log('done', S.retire, 'ms', Date.now() - t0, 'state bytes', JSON.stringify(S).length, 'ach', S.u.ach.map(a => a.name).join('; '));
