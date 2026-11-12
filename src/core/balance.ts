// Versioned balance configuration. Every numeric rule of the simulation lives here so it can be explained and regression-tested.
// Values marked "spec" come straight from the design document; values marked "tuned" were adjusted through automated full-career runs.
import type { Band, Surface, Ability, Tour, ProfileKind, Style } from './types';

export const ENGINE_VERSION = '1.0.0';
export const BALANCE_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;
export const START_YEAR = 2026;
export const WORLD_SIZE = 800; // spec 14.4
export const RETIRE_AGE = 40; // spec

// spec 13.2 ranking points by round lost (W, F, SF, QF, R16, R32, R64, R128)
export const POINTS: Record<Band, number[]> = {
  GS: [2000, 1300, 800, 400, 200, 100, 50, 10], T1000: [1000, 650, 400, 200, 100, 50, 25, 10], T500: [500, 325, 195, 108, 54, 1, 0, 0],
  T250: [250, 165, 100, 50, 25, 0, 0, 0], UL: [100, 60, 36, 20, 9, 0, 0, 0], SL: [50, 30, 18, 10, 4, 0, 0, 0], EP: [15, 8, 4, 2, 1, 0, 0, 0], F: [0, 0, 0, 0, 0, 0, 0, 0],
};
export const ROUND_KEYS = ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'];
export const QUAL_POINTS: Record<Band, number> = { GS: 10, T1000: 5, T500: 5, T250: 5, UL: 2, SL: 2, EP: 0, F: 0 }; // spec
export const FINALS_POINTS = { rr: 200, sf: 400, f: 500 }; // spec
export const BEST_N = 18; // spec

// spec 11.3 fictional economy (career dollars)
export const PRIZE: Record<Band, { champ: number; floor: number }> = {
  EP: { champ: 3000, floor: 100 }, SL: { champ: 12000, floor: 400 }, UL: { champ: 30000, floor: 1000 }, T250: { champ: 80000, floor: 3000 },
  T500: { champ: 180000, floor: 5000 }, T1000: { champ: 400000, floor: 8000 }, GS: { champ: 1000000, floor: 20000 }, F: { champ: 250000, floor: 60000 },
};
export const PRIZE_MULT: Record<string, number> = { W: 1, F: 0.55, SF: 0.3, QF: 0.16, R16: 0.08, R32: 0.04 };
export const ECON = { startCash: 8000, support: 500, essentials: 350, reserve: 1000, local: [400, 800], regional: [900, 1500], inter: [2000, 3500] };

// spec 9.2 neutral anchors, with tour-specific tuning (spec asks for separate calibration)
export const ANCHOR: Record<Tour, { fs: number; p1: number; p2: number }> = { atp: { fs: 0.62, p1: 0.715, p2: 0.515 }, wta: { fs: 0.62, p1: 0.645, p2: 0.455 } };
export const PER_POINT = 0.003; // spec
export const P_CLAMP: [number, number] = [0.25, 0.85]; // spec
// spec A2 rally weights: forehand, backhand, movement, composure, net
export const RALLY: Record<Surface, Record<'fh' | 'bh' | 'move' | 'comp' | 'net', number>> = {
  hard: { fh: 0.28, bh: 0.24, move: 0.24, comp: 0.19, net: 0.05 }, clay: { fh: 0.27, bh: 0.24, move: 0.29, comp: 0.18, net: 0.02 }, grass: { fh: 0.26, bh: 0.22, move: 0.2, comp: 0.17, net: 0.15 },
};
export const COND = { fatigue: 0.03, conf: 0.015, sharp: 0.01, fam: 0.01 }; // spec

// spec 6: development
export const DEV = {
  baseComp: 3.6, // spec initial 1.50; tuned so profiles can approach their ceilings over a career
  trainPool: 0.6, // spec initial 0.30; tuned
  matchWeekTrain: 0.25, // spec
  headroomDiv: 40, // spec
  cWidth: 0.22, // spec
  exposure: { oneSided: 0.2, straight: 0.6, close: 0.85, epic: 1.0 }, // spec
  weekCreditCap: 2.0,
  age: [[21, 1.2], [24, 1.0], [27, 0.7], [30, 0.4], [34, 0.2], [99, 0.1]] as [number, number][], // spec
  lr: { goat: [1.15, 1.45], contender: [0.95, 1.2], grinder: [0.75, 1.05] } as Record<ProfileKind, [number, number]>, // spec
  ceil: { goat: [93, 99], contender: [85, 94], grinder: [75, 88] } as Record<ProfileKind, [number, number]>, // spec
  mix: { goat: 0.04, contender: 0.26, grinder: 0.7 }, // spec
  use: { serve: 0.16, ret: 0.16, fh: 0.16, bh: 0.14, net: 0.06, move: 0.12, end: 0.1, comp: 0.1 } as Record<Ability, number>,
};
export const TRAIN: Record<string, { opp: number; fat: number; strain: number; risk: number }> = {
  relaxed: { opp: 0.65, fat: 3, strain: 1, risk: 1 }, normal: { opp: 1, fat: 6, strain: 2, risk: 1 }, intense: { opp: 1.35, fat: 11, strain: 5, risk: 1.35 },
}; // spec 7.1
export const RECOVERY = { fat: 14, strain: 4, extra: 6, matchWeekFat: 6, matchWeekStrain: 0 }; // spec 7.2
export const HEALTH = { base: 0.0015, perFat: 0.00005, perStrain: 0.00015, cap: 0.03, acute: 0.0012, sev: [0.7, 0.24, 0.05, 0.01], permMajor: 0.15, permSevere: 0.4 }; // spec 10
export const START_COND = { fatigue: 10, strain: 5, sharp: 55, conf: 50, morale: 65 }; // spec
// spec 20.4 peak index
export const PEAK_W: Record<Ability, number> = { serve: 0.18, ret: 0.17, fh: 0.15, bh: 0.15, net: 0.05, move: 0.13, end: 0.1, comp: 0.07 };

// World calibration (authored game estimates, not measurements of real athletes)
export const LEVEL: Record<Tour, [number, number][]> = {
  atp: [[1, 94], [2, 93.5], [3, 89.5], [5, 88], [10, 86], [20, 83], [50, 78.5], [100, 73.5], [200, 67], [300, 62], [450, 56.5], [600, 52.5], [800, 48.5], [1000, 45]],
  wta: [[1, 94], [2, 92.5], [3, 91], [5, 89], [10, 86], [20, 83], [50, 78], [100, 73], [200, 66.5], [300, 61], [450, 55.5], [600, 51.5], [800, 47.5], [1000, 44]],
};
export const START_PTS: Record<Tour, [number, number][]> = {
  atp: [[1, 12050], [2, 11500], [3, 5160], [4, 4830], [5, 4245], [7, 4135], [10, 2990], [15, 2600], [20, 2150], [30, 1650], [50, 1050], [75, 790], [100, 610], [150, 400], [200, 300], [300, 150], [400, 62], [500, 28], [600, 16], [750, 8], [900, 3], [1000, 1]],
  wta: [[1, 10870], [200, 365], [300, 170], [400, 70], [500, 30], [600, 16], [750, 8], [900, 3], [1000, 1]],
};
export const STYLE_OFF: Record<Style, Record<Ability, number>> = {
  S: { serve: 7, ret: -4, fh: 2, bh: -1, net: -5, move: -4, end: -1, comp: 1 }, B: { serve: 1, ret: 0, fh: 4, bh: 2, net: -8, move: -1, end: -1, comp: -1 },
  C: { serve: -4, ret: 4, fh: -2, bh: 2, net: -9, move: 4, end: 3, comp: 0 }, A: { serve: 0, ret: 0, fh: 1, bh: 1, net: -2, move: 1, end: -1, comp: 0 },
  N: { serve: 5, ret: -3, fh: -1, bh: -2, net: 5, move: -1, end: -2, comp: 0 },
};
// Default acceptance cut-offs (last direct rank, last qualifying rank) until a series has its own history
export const CUTS: Record<string, [number, number]> = { GS: [104, 232], T1000: [85, 140], T1000s: [50, 85], T500: [60, 110], T250: [95, 170], UL: [230, 380], SL: [420, 620], EP: [600, 780], F: [8, 8] };
export const BAND_NAME: Record<Band, string> = { GS: 'Grand Slam', F: 'Tour Finals', T1000: 'Tour 1000', T500: 'Tour 500', T250: 'Tour 250', UL: 'Upper lower tour', SL: 'Strong lower tour', EP: 'Entry professional' };
export const BAND_VAL: Record<Band, number> = { GS: 2000, F: 1500, T1000: 1000, T500: 500, T250: 250, UL: 100, SL: 50, EP: 15 };
export const BLOCKS = [0, 12, 22, 30]; // first week index of blocks A–D (spec 4.2)
export const BLOCK_NAMES = ['Block A · January to March', 'Block B · April to the clay major', 'Block C · June and July', 'Block D · August to year end'];
export const RULES_SUMMARY = [
  'Rankings count the best 18 results of the previous 52 weeks, plus Tour Finals points. This is a game rule, not the full official ATP or WTA ranking system; mandatory-event counting and protected rankings are omitted.',
  'Lower-tier events are grouped into three game bands (entry professional, strong lower tour, upper lower tour) with simplified points.',
  'Entry lists lock on the Monday ranking of the week an event starts (Grand Slam lists lock one week earlier, with qualifying played that week).',
  'Prize money, costs and sponsorships are a fictional economy in career dollars.',
  'All results from 1 January 2026 onward are simulated. Player ratings are authored game estimates.',
];
export function lerpTable(t: [number, number][], x: number): number {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) {
    const [x0, y0] = t[i - 1], [x1, y1] = t[i];
    const f = (Math.log(x) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
    return y0 + (y1 - y0) * f;
  }
  return t[t.length - 1][1];
}
