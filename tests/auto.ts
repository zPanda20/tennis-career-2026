// Shared automated "quick agent" used by the balance and invariant tests: accepts recommendations like a quick-play user.
import { execute } from '../src/core/sim';
import { routes, featuredEvent } from '../src/core/agent';
import { createCareer } from '../src/core/world';
import type { Content } from '../src/core/content';
import type { Setup, State } from '../src/core/types';
export function autoStep(S: State, C: Content, n: number, opts: { retireAge?: number; path?: 'pro' | 'college' | 'academy' } = {}) {
  if (S.phase === 'plan') {
    const rs = routes(S), r = rs.find(x => x.recommended) ?? rs[0], ev = featuredEvent(S);
    execute(S, C, { id: `auto${n}`, type: 'CommitBlock', plan: { weeks: r.weeks, route: r.key, lifeEv: ev?.id, lifeChoice: ev ? n % ev.choices.length : undefined }, pol: S.u.pol });
  } else if (S.phase === 'interrupt') execute(S, C, { id: `auto${n}`, type: 'ResolveInjury', rehab: 'conservative' });
  else if (S.phase === 'live') { // hands-on match: the test agent picks the coach's plan, or lets the coach finish
    const L = S.live!;
    if (L.done) execute(S, C, { id: `auto${n}`, type: 'LiveContinue' });
    else execute(S, C, { id: `auto${n}`, type: 'LiveDecide', tac: (['balanced', 'first', 'grind', 'backhand', 'net', 'return'] as const)[n % 6], reset: L.pause?.kind === 'slide' && L.pause.resetsLeft > 0 });
  }
  else if (S.phase === 'yearEnd') {
    const offers = S.pending?.coachOffers ?? [], best = offers.filter(o => o.cost * 14 < S.u.cash && o.dev > S.u.coach.dev).sort((a, b) => b.dev - a.dev)[0];
    const seen = new Set<string>(), sp = (S.pending?.sponsorOffers ?? []).slice().sort((a, b) => b.monthly - a.monthly).filter(o => !seen.has(o.slot) && seen.add(o.slot)).map(o => o.id);
    const age = S.year - 1 - +S.players[S.userId].born.slice(0, 4);
    execute(S, C, { id: `auto${n}`, type: 'YearEnd', coach: best?.id ?? 'keep', sponsors: sp, retire: !!opts.retireAge && age >= opts.retireAge, path: S.pending?.path?.kind === 'choose' ? opts.path ?? 'pro' : undefined });
  }
}
export function autoCareer(C: Content, setup: Setup, opts: { retireAge?: number; path?: 'pro' | 'college' | 'academy' } = {}): State {
  const S = createCareer(setup, C, '2026-01-01T00:00:00Z');
  for (let n = 0; S.phase !== 'retired' && n < 20000; n++) autoStep(S, C, n, opts);
  return S;
}
export const baseSetup = (tour: 'atp' | 'wta', profile: Setup['profile'], seed: string): Setup => ({ tour, name: 'Test Player', country: ['USA', 'FRA', 'ESP', 'JPN', 'AUS', 'ARG'][seed.length % 6], pronouns: 'they', birthMonth: 6, birthDay: 15, hand: 'R', avatar: 0, focusSurface: 'hard', skills: ['fh', 'serve'], profile, adult: true, detail: 'quick', seed });
