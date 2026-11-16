// Match tactics: game plans, how well each suits a matchup, scouting reads and the coach's advice.
// Effects are small shifts in point-win probability (serve points and return points), which compound over a match.
import { clamp, Rng } from './rng';
import type { Abil, Player, Surface } from './types';

export type Tactic = 'balanced' | 'first' | 'grind' | 'backhand' | 'net' | 'return';
export const TACTICS: Tactic[] = ['balanced', 'first', 'grind', 'backhand', 'net', 'return'];
export const TAC: Record<Tactic, { name: string; short: string; text: string }> = {
  balanced: { name: 'Play your game', short: 'Balanced', text: 'No special plan. Safe when you are unsure.' },
  first: { name: 'First strike', short: 'First strike', text: 'Big serve, go for the forehand early, keep points short.' },
  grind: { name: 'Make them play', short: 'Grind', text: 'Extra ball, heavy margins, long rallies. Tests their legs and patience.' },
  backhand: { name: 'Target the backhand', short: 'Backhand', text: 'Pin them in the backhand corner and wait for the short ball.' },
  net: { name: 'Come forward', short: 'Net', text: 'Serve and volley, approach often, take time away.' },
  return: { name: 'Neutralise the serve', short: 'Return', text: 'Stand back, block returns deep and low. Blunts big servers and net rushers.' },
};
/** Which plan blunts which: playing the counter cuts the opponent's plan to 40% of its effect. */
export const COUNTER: Record<Tactic, Tactic | null> = { balanced: null, grind: 'first', first: 'return', net: 'return', backhand: 'net', return: 'net' };
const MAX = 0.024;

export interface Eff { sv: number; rt: number; f: number }
/** How well a plan suits `me` against `opp` on this surface. f is the fit score from -1 to 1. */
export function tacticEff(me: Abil, opp: Abil, t: Tactic, surface: Surface): Eff {
  const s = (x: number, d: number) => clamp(x / d, -1, 1);
  let f = 0, sv = 0, rt = 0;
  if (t === 'first') { f = s((me.serve + me.fh) / 2 - (opp.move + opp.end) / 2, 14) + (surface === 'grass' ? 0.2 : surface === 'clay' ? -0.25 : 0); sv = 1; rt = 0.5; }
  if (t === 'grind') { f = s((me.move + me.end) / 2 - (opp.fh + opp.comp) / 2, 14) + (surface === 'clay' ? 0.3 : surface === 'grass' ? -0.3 : 0); sv = 0.5; rt = 1; }
  if (t === 'backhand') { f = s(opp.fh - opp.bh, 9) * clamp((me.fh - 40) / 30, 0.3, 1); sv = 0.55; rt = 0.9; }
  if (t === 'net') { f = s(me.net - (opp.fh + opp.bh) / 2, 13) + (surface === 'grass' ? 0.35 : surface === 'clay' ? -0.35 : 0); sv = 1; rt = 0.35; }
  if (t === 'return') { f = s((opp.serve + opp.net) / 2 - me.serve + (me.ret - 55) * 0.5, 14); sv = -0.15; rt = 1; }
  f = clamp(f, -1, 1);
  return { sv: MAX * f * sv, rt: MAX * f * rt, f };
}
export const allEff = (me: Abil, opp: Abil, surface: Surface) => Object.fromEntries(TACTICS.map(t => [t, tacticEff(me, opp, t, surface)])) as Record<Tactic, Eff>;
const value = (e: Eff) => e.sv + e.rt;

/** A read of the opponent's abilities: exact with film study, otherwise with an error that shrinks as the coach gets better. */
export const READ_SD: Record<string, number> = { starter: 9, tour: 7, elite: 5, master: 3, legend: 1.5 };
export function readOf(opp: Player, sd: number, seed: string): Abil {
  const r = new Rng(seed), out = { ...opp.ab };
  for (const k of Object.keys(out) as (keyof Abil)[]) out[k] = clamp(out[k] + r.normal(0, sd), 1, 99);
  return out;
}
/** The plan the coach would pick, from a read of the opponent. Accounts for the counter to what the opponent is doing. */
export function coachPick(me: Abil, read: Abil, surface: Surface, oppTac?: Tactic): Tactic {
  const E = allEff(me, read, surface); let best: Tactic = 'balanced', bv = 0.002;
  for (const t of TACTICS) { const v = value(E[t]) + (oppTac && COUNTER[oppTac] === t ? 0.012 : 0); if (v > bv) { bv = v; best = t; } }
  return best;
}
/** Opponents have a plan too: their best plan, then their second best after losing a set. */
export function oppPlans(opp: Abil, me: Abil, surface: Surface): [Tactic, Tactic] {
  const E = allEff(opp, me, surface), list = TACTICS.filter(t => t !== 'balanced').sort((a, b) => value(E[b]) - value(E[a]));
  return [value(E[list[0]]) > 0.004 ? list[0] : 'balanced', value(E[list[1]]) > 0.004 ? list[1] : 'balanced'];
}
export function fitWord(v: number) { return v > 0.022 ? 'Strong fit' : v > 0.009 ? 'Good fit' : v > -0.006 ? 'Neutral' : 'Risky'; }

const AB_NAME: Record<keyof Abil, string> = { serve: 'serve', ret: 'return', fh: 'forehand', bh: 'backhand', net: 'net game', move: 'movement', end: 'endurance', comp: 'composure' };
/** Strengths and weaknesses of the opponent relative to their own level, from a read. */
export function profileOf(read: Abil) {
  const ks = (Object.keys(read) as (keyof Abil)[]), avg = ks.reduce((t, k) => t + read[k], 0) / ks.length;
  const sorted = ks.slice().sort((a, b) => read[b] - read[a]);
  return { strengths: sorted.slice(0, 2).map(k => AB_NAME[k]), weaknesses: sorted.slice(-2).reverse().map(k => AB_NAME[k]), level: avg };
}
export function whyText(t: Tactic, me: Abil, read: Abil, surface: Surface): string {
  if (t === 'first') return read.move + read.end > me.serve + me.fh ? 'Their defence is strong, so short points are a gamble.' : 'Your serve and forehand outgun their defence.';
  if (t === 'grind') return me.move + me.end > read.fh + read.comp ? `You can outlast them${surface === 'clay' ? ', and clay rewards it' : ''}.` : 'They are steadier from the back than you.';
  if (t === 'backhand') return read.bh < read.fh - 6 ? 'Their backhand is clearly the weaker wing.' : 'Their backhand holds up as well as the forehand.';
  if (t === 'net') return me.net > (read.fh + read.bh) / 2 ? `Your volleys beat their passing shots${surface === 'grass' ? ', and grass helps' : ''}.` : 'Their passing shots are better than your volleys.';
  if (t === 'return') return read.serve > 65 || read.net > 65 ? 'Takes the sting out of their serve and net play.' : 'Their serve is not the threat here.';
  return 'Keeps your options open.';
}
