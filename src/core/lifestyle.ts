// Life off court: where you live, the home you keep, the staff around you and the time you invest in your people.
import { ECON, START_YEAR } from './balance';
import { clamp } from './rng';
import type { Ability, State } from './types';

// ---------- home base ----------
export interface Base { id: string; city: string; country: string; mult: number; note: string }
export const BASES: Base[] = [
  { id: 'monaco', city: 'Monte Carlo', country: 'MON', mult: 1.9, note: 'Tax-friendly, glamorous, very expensive. Short trips to the European swing.' },
  { id: 'barcelona', city: 'Barcelona', country: 'ESP', mult: 1.1, note: 'Academies, clay courts and a deep pool of practice partners.' },
  { id: 'london', city: 'London', country: 'GBR', mult: 1.55, note: 'Expensive, but the grass swing and European events are close.' },
  { id: 'paris', city: 'Paris', country: 'FRA', mult: 1.35, note: 'Central to the European calendar.' },
  { id: 'rome', city: 'Rome', country: 'ITA', mult: 1.15, note: 'Italian clay, Italian Challengers and easy European travel.' },
  { id: 'belgrade', city: 'Belgrade', country: 'SRB', mult: 0.75, note: 'Affordable base inside Europe with strong tennis culture.' },
  { id: 'dubai', city: 'Dubai', country: 'UAE', mult: 1.4, note: 'A hub between Europe and Asia; warm training all year.' },
  { id: 'bradenton', city: 'Bradenton, Florida', country: 'USA', mult: 1.15, note: 'Academy town. The American hard-court swing is on the doorstep.' },
  { id: 'miami', city: 'Miami', country: 'USA', mult: 1.45, note: 'Glamorous American base, close to Latin America.' },
  { id: 'buenosaires', city: 'Buenos Aires', country: 'ARG', mult: 0.7, note: 'Cheap, clay-rich and close to the South American Challengers.' },
  { id: 'melbourne', city: 'Melbourne', country: 'AUS', mult: 1.25, note: 'Perfect for January, a long way from everything else.' },
  { id: 'tokyo', city: 'Tokyo', country: 'JPN', mult: 1.3, note: 'The Asian swing nearby; long flights to Europe.' },
  { id: 'singapore', city: 'Singapore', country: 'SGP', mult: 1.45, note: 'An efficient Asian hub with direct flights everywhere.' },
];
export const hometown = (S: State): Base => ({ id: 'home', city: 'Your hometown', country: S.players[S.userId].country, mult: 0.85, note: 'Family and friends close by, and lower costs. Your best friendship stays strong here.' });
export const baseOf = (S: State): Base => { const id = S.u.home?.base ?? 'home'; return id === 'home' ? hometown(S) : BASES.find(b => b.id === id) ?? hometown(S); };
/** Country you travel from: decides trip costs and travel fatigue. */
export const homeOf = (S: State) => baseOf(S).country;

// ---------- homes ----------
export interface HomeTier { name: string; price: number; rent: number; recov: number; morale: number; partner: number; court: boolean; text: string }
export const HOMES: HomeTier[] = [
  { name: 'Rented room', price: 0, rent: 0, recov: 0, morale: 0, partner: 0, court: false, text: 'Covered by your living costs. Basic, noisy, fine.' },
  { name: 'Apartment', price: 60000, rent: 450, recov: 1.5, morale: 0.12, partner: 0.1, court: false, text: 'Your own space. Better sleep between events.' },
  { name: 'Townhouse', price: 220000, rent: 1300, recov: 3, morale: 0.22, partner: 0.2, court: false, text: 'Room for a home gym and for family to stay.' },
  { name: 'Villa with a court', price: 850000, rent: 4200, recov: 4.5, morale: 0.32, partner: 0.3, court: true, text: 'A private court keeps you sharp in the weeks off.' },
  { name: 'Estate', price: 3500000, rent: 14000, recov: 6, morale: 0.42, partner: 0.4, court: true, text: 'Recovery suite, courts on two surfaces, total privacy.' },
];
export const homePrice = (S: State, tier: number) => Math.round(HOMES[tier].price * baseOf(S).mult / 1000) * 1000;
export const homeRent = (S: State, tier: number) => Math.round(HOMES[tier].rent * baseOf(S).mult / 10) * 10;
export const homeUpkeep = (S: State, tier: number) => Math.round(HOMES[tier].price * 0.0025 * baseOf(S).mult / 10) * 10;
/** Monthly cost of the current home: rent, or upkeep when owned. */
export function homeMonthly(S: State) { const h = S.u.home; if (!h || !h.tier) return 0; return h.owned ? homeUpkeep(S, h.tier) : homeRent(S, h.tier); }

// ---------- staff ----------
export type StaffRole = 'physio' | 'fitness' | 'hitting' | 'psych';
export const STAFF: Record<StaffRole, { name: string; cost: [number, number]; does: string; lv: [string, string] }> = {
  physio: { name: 'Physiotherapist', cost: [600, 1500], does: 'Lowers injury risk and clears strain faster.', lv: ['Travelling physio', 'Tour-level physio'] },
  fitness: { name: 'Fitness trainer', cost: [500, 1300], does: 'More growth in movement and endurance, faster recovery between events.', lv: ['Strength coach', 'Performance director'] },
  hitting: { name: 'Hitting partner', cost: [300, 900], does: 'Keeps you sharp in weeks off and adds a little to every training block.', lv: ['Club-level hitter', 'Former tour pro'] },
  psych: { name: 'Sports psychologist', cost: [450, 1200], does: 'Builds composure, steadies morale and confidence.', lv: ['Mental-skills coach', 'Elite psychologist'] },
};
export const ROLES = Object.keys(STAFF) as StaffRole[];
export const staffLevel = (S: State, r: StaffRole) => S.u.staff?.find(s => s.role === r)?.level ?? 0;
export const staffMonthly = (S: State) => (S.u.staff ?? []).reduce((t, s) => t + STAFF[s.role].cost[s.level - 1], 0);

/** Weekly living costs of the lifestyle: base-adjusted essentials, home and staff. */
export const livingMonthly = (S: State) => ECON.essentials * baseOf(S).mult;
export const lifestyleMonthly = (S: State) => homeMonthly(S) + staffMonthly(S);

// ---------- training and health modifiers used by the weekly upkeep ----------
export function trainMult(S: State, k: Ability): number {
  const c = S.u.coach; let m = 1;
  if (c.spec === k || (c.spec === 'physical' && (k === 'move' || k === 'end'))) m *= c.spec === 'physical' ? 1.2 : 1.3;
  const fit = staffLevel(S, 'fitness'), psy = staffLevel(S, 'psych'), hit = staffLevel(S, 'hitting');
  if (fit && (k === 'move' || k === 'end')) m *= 1 + 0.12 * fit;
  if (psy && k === 'comp') m *= 1 + 0.15 * psy;
  if (hit) m *= 1 + 0.04 * hit;
  return m;
}
export const injuryMult = (S: State) => 1 - 0.12 * staffLevel(S, 'physio');

/** The user's weekly off-court effects. Called from the weekly upkeep. */
export function lifestyleWeek(S: State, played: boolean) {
  const p = S.players[S.userId], u = S.u, h = HOMES[u.home?.tier ?? 0];
  if (!played) {
    p.fatigue -= h.recov + staffLevel(S, 'fitness') * 1;
    p.strain -= staffLevel(S, 'physio') * 0.5;
    p.sharp += (h.court ? 1 : 0) + staffLevel(S, 'hitting') * 0.6;
  }
  p.morale += h.morale + staffLevel(S, 'psych') * 0.15;
  if (staffLevel(S, 'psych') && p.conf < 45) p.conf += 0.3 * staffLevel(S, 'psych');
  if (u.rel.partner !== null) u.rel.partner = Math.min(100, u.rel.partner + h.partner);
  if (baseOf(S).id === 'home') u.rel.friend = Math.min(100, u.rel.friend + 0.15);
}

// ---------- time with your people ----------
export interface LifeAction { id: string; who: 'coach' | 'friend' | 'partner'; title: string; text: string; cost: (S: State) => number; ok?: (S: State) => string | null; fx: string }
export const LIFE_ACTIONS: LifeAction[] = [
  { id: 'review', who: 'coach', title: 'Sit down and review the plan', text: 'An honest hour on what is working and what is not.', cost: () => 0, fx: 'Coach trust +4' },
  { id: 'dinner', who: 'coach', title: 'Take the team to dinner', text: 'Good food, no tennis talk. Teams that like each other work better.', cost: S => Math.round(150 * baseOf(S).mult * (1 + 0.3 * (S.u.staff?.length ?? 0)) / 10) * 10, fx: 'Coach trust +5, morale up' },
  { id: 'bonus', who: 'coach', title: 'Pay your coach a performance bonus', text: 'A month\'s fee on top, to say the work is noticed.', cost: S => S.u.coach.cost, fx: 'Coach trust +10' },
  { id: 'extend', who: 'coach', title: 'Offer a contract extension', text: 'Commit to another year together. Coaches value security.', cost: () => 0, ok: S => (S.u.coach.until > S.year + 1 ? 'Already contracted beyond next season' : null), fx: 'Coach trust +7, contract one more year' },
  { id: 'friend', who: 'friend', title: 'Fly your best friend out to an event', text: 'A familiar face in the players\' box.', cost: S => Math.round(500 * baseOf(S).mult / 10) * 10, fx: 'Friendship +8, morale up' },
  { id: 'away', who: 'partner', title: 'A weekend away together', text: 'Phones off, no rankings.', cost: S => Math.round(800 * baseOf(S).mult / 10) * 10, ok: S => (S.u.rel.partner === null ? 'You are single right now' : null), fx: 'Relationship +8, fresher, a little less sharp' },
];
export const absBlock = (S: State) => (S.year - START_YEAR) * 4 + S.block;
export const actionUsed = (S: State, id: string) => (S.u.lifeUsed?.[id] ?? -1) === absBlock(S);

export function applyLifeAction(S: State, id: string) {
  const a = LIFE_ACTIONS.find(x => x.id === id); if (!a) throw new Error('Unknown action.');
  if (actionUsed(S, id)) throw new Error('Already done this swing.');
  const why = a.ok?.(S); if (why) throw new Error(why);
  const cost = a.cost(S), u = S.u, p = S.players[S.userId];
  if (cost > u.cash) throw new Error('Not affordable right now.');
  const trust = (d: number) => { u.rel.coach = clamp(u.rel.coach + d, 0, 100); u.coach.trust = u.rel.coach; };
  if (id === 'review') trust(4);
  if (id === 'dinner') { trust(5); p.morale = clamp(p.morale + 2, 0, 100); }
  if (id === 'bonus') trust(10);
  if (id === 'extend') { trust(7); u.coach.until += 1; }
  if (id === 'friend') { u.rel.friend = clamp(u.rel.friend + 8, 0, 100); p.morale = clamp(p.morale + 2, 0, 100); }
  if (id === 'away' && u.rel.partner !== null) { u.rel.partner = clamp(u.rel.partner + 8, 0, 100); p.fatigue = clamp(p.fatigue - 4, 0, 100); p.sharp = clamp(p.sharp - 2, 0, 100); }
  (u.lifeUsed ??= {})[id] = absBlock(S);
  return cost;
}
