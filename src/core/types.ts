export type Tour = 'atp' | 'wta';
export type Surface = 'hard' | 'clay' | 'grass';
export type Band = 'GS' | 'F' | 'T1000' | 'T500' | 'T250' | 'UL' | 'SL' | 'EP' | 'J';
export const ABILITIES = ['serve', 'ret', 'fh', 'bh', 'net', 'move', 'end', 'comp'] as const;
export type Ability = (typeof ABILITIES)[number];
export type Abil = Record<Ability, number>;
export const ABILITY_NAMES: Record<Ability, string> = { serve: 'Serve', ret: 'Return', fh: 'Forehand', bh: 'Backhand', net: 'Net play', move: 'Movement', end: 'Endurance', comp: 'Composure' };
export type Style = 'S' | 'B' | 'C' | 'A' | 'N';
export const STYLE_NAMES: Record<Style, string> = { S: 'Big server', B: 'Aggressive baseliner', C: 'Counterpuncher', A: 'All-court player', N: 'Serve-and-net player' };
export type ProfileKind = 'goat' | 'contender' | 'grinder';
export type Intensity = 'relaxed' | 'normal' | 'intense';
export type Priority = 'prep' | 'recovery' | 'social' | 'relationship' | 'professional';
export type Focus = Ability | 'physical' | 'surface' | 'balanced';

export interface RankRec { ed: string; pts: number; exp: number; yr: number; cls: 't' | 'f' | 'bg'; q?: number }

export interface Player { edge?: number;
  id: string; name: string; country: string; born: string; bornApprox?: boolean; hand: 'R' | 'L'; tour: Tour; real: boolean; user?: boolean;
  ab: Abil; ceil: Abil; lr: number; curve: number; resil: number; injSus: number; declineAge: number; style: Style;
  fam: Record<Surface, number>;
  fatigue: number; strain: number; sharp: number; conf: number; morale: number;
  injuredUntil: number; commit: Record<number, string>; consec: number; lastWk: number;
  res: RankRec[]; debut: number; retired?: number; titles: number; majors: number; bestRank: number;
  wkCredit?: number; wkMatches?: number; wkSurf?: Surface;
  junior?: boolean; jres?: { ed: string; pts: number; exp: number; yr: number }[]; jbest?: number; jtitles?: number; speed?: 'early' | 'steady' | 'late'; pot?: number; quit?: number;
}

export interface EvTemplate {
  series: string; name: string; city: string; country: string; tour: Tour; band: Band; cat: string; surface: Surface; indoor: boolean;
  draw: number; weeks: number; week: number; dates?: string; prov?: boolean; slam?: 'ao' | 'rg' | 'wim' | 'uso';
}
export interface MatchLite { r: string; a: string; b: string | null; w: string; s: string; cls: 'played' | 'ret' | 'wo' | 'bye' }
export interface Edition extends EvTemplate {
  id: string; year: number; startWk: number; entryWk: number; qSpots: number; qSize: number; wc: number; direct: number;
  md: string[]; q: string[]; alt: string[]; wcs: string[]; quals: string[];
  slots?: (string | null)[]; round?: number; done?: boolean; cancelled?: boolean; champion?: string; runnerUp?: string;
  lost?: Record<string, string>; cut?: number; qcut?: number; log?: MatchLite[]; rr?: any; jl?: number;
}

export interface MatchStats { aces: number; df: number; fsIn: number; fsTot: number; fsWon: number; ssWon: number; ssTot: number; bpWon: number; bpTot: number; pts: number; retWon: number }
export interface MatchResult {
  winner: 0 | 1; sets: [number, number, number?, number?][]; score: string; stats: [MatchStats, MatchStats]; points: number; minutes: number;
  fatigue: [number, number]; cls: 'played' | 'ret'; retiredSide?: 0 | 1; closeness: number; turning: string[]; flow: number[];
  pause?: import('./match').Pause; plan?: { my: string[]; opp: string[] };
}
export interface UMatch {
  id: string; ed: string; year: number; wk: number; round: string; qual: boolean; opp: string; oppName: string; oppRank: number; oppReal: boolean; oppCountry: string;
  myRank: number; won: boolean; score: string; cls: 'played' | 'ret' | 'wo'; p: number; stats?: [MatchStats, MatchStats]; minutes: number; reasons: string[]; turning: string[];
  surface: Surface; dev: number; fat: number; flow?: string; sets?: [number, number, number?][]; plan?: { my: string[]; opp: string[] }; live?: boolean;
}
export interface UTourney {
  ed: string; series: string; name: string; cat: string; band: Band; surface: Surface; city: string; country: string; year: number; wk: number; dates: string;
  status: 'MD' | 'Q' | 'WC' | 'LL' | 'ALT' | 'REJ' | 'WD'; via?: string; qualified?: boolean; reached: string; pts: number; prize: number; cost: number; title: boolean; final: boolean;
  matches: string[]; prov?: boolean; note?: string; champion?: string; log?: MatchLite[]; jl?: number;
}
export interface Injury { id: string; wk: number; year: number; date: string; loc: string; kind: 'acute' | 'overuse' | 'illness'; sev: 'minor' | 'moderate' | 'major' | 'severe'; estMin: number; estMax: number; weeks: number; rehab: 'conservative' | 'specialist' | 'early'; perm?: { ab: Ability; loss: number }[]; returnedWk?: number; desc: string }
export type CoachTier = 'starter' | 'tour' | 'elite' | 'master' | 'legend';
export interface Coach { spec?: Ability | 'physical'; persona?: string; id: string; name: string; tier: CoachTier; dev: number; recovery: number; style: Style; fit: number; cost: number; since: number; until: number; trust: number }
export interface Sponsor { kind?: 'retainer' | 'performance' | 'loyalty'; lowerBonus?: number; signing?: number; id: string; slot: 'apparel' | 'racket' | 'partner'; brand: number; name: string; monthly: number; titleBonus: number; appearances: number; since: number; until: number }
export interface Ledger { wk: number; year: number; cat: string; amt: number; ref?: string }
export interface Choice { id: string; ev: string; choice: number; wk: number; year: number; date: string; title: string; label: string; fx: string; personal: boolean; follow?: { dueBlock: number; text: string; done?: boolean } }
export interface AttrChange { wk: number; year: number; ab: Ability; from: number; to: number; cause: 'competition' | 'training' | 'aging' | 'injury'; note?: string }
export interface Snapshot { id: string; wk: number; year: number; date: string; age: number; ab: Abil; fam: Record<Surface, number>; style: Style; perm: { ab: Ability; loss: number }[]; index: number; src: string; rank: number }
export interface Season { year: number; n: number; rank: number; pts: number; w: number; l: number; titles: number; finals: number; majorsBest: string; prize: number; injWeeks: number; dev: number; devComp: number; devTrain: number; bestRank: number; events: number; age: number; no1: boolean; jrank?: number; stage?: string }
export interface Achievement { id: string; name: string; wk: number; year: number; date: string; ref?: string }
export interface Policies { match?: 'auto' | 'big' | 'all'; detail: 'quick' | 'detailed'; intensity: Intensity; focus: Focus; priority: Priority; fallback: 'nearest' | 'rest'; adult: boolean; surfacePrep?: Surface }

export interface UserCareer {
  profile: ProfileKind; profileSelected: boolean; focusSurface: Surface | 'all'; skills: [Ability, Ability]; pronouns: string; avatar: number;
  cash: number; ledger: Ledger[]; coach: Coach; coachHistory: (Coach & { left?: number; reason?: string })[]; sponsors: Sponsor[]; sponsorHistory: Sponsor[];
  injuries: Injury[]; choices: Choice[]; tourneys: UTourney[]; matches: UMatch[]; attr: AttrChange[]; snaps: Snapshot[]; seasons: Season[]; ach: Achievement[];
  rankHist: { wk: number; rank: number; pts: number }[]; pol: Policies; rel: { coach: number; agent: number; friend: number; partner: number | null; partnerName?: string };
  startAb: Abil; startRank: number; evSeen: Record<string, number>; follow: { dueBlock: number; ev: string; choice: number }[]; blockMods: { train?: number; recov?: number };
  portrait?: string;
  devYear: { comp: number; train: number }; injWeeksYear: number; no1Weeks: number; hardship: number; finalSeasonWarned?: boolean; lastOfferYear: number; rivals: string[];
  rivalNo?: string[]; goals?: Goal[];
  stage?: 'junior' | 'path' | 'pro'; academy?: Academy; path?: { kind: PathKind; from: number; until: number }; usoWc?: number; college?: { year: number; w: number; l: number; ncaa?: string; matches: { wk: number; opp: string; school: string; won: boolean; score: string }[] }[]; jstart?: boolean;
  home?: { base: string; tier: number; owned: boolean }; staff?: { role: 'physio' | 'fitness' | 'hitting' | 'psych'; level: 1 | 2; name: string; since: number }[]; lifeUsed?: Record<string, number>;
}
export interface Goal { id: string; year: number; kind: 'rank' | 'title' | 'wins' | 'major' | 'jrank' | 'jtitle'; target: number; bands?: Band[]; label: string; reward: number; done?: number; failed?: boolean }
export interface News { wk: number; year: number; kind: 'champ' | 'rank' | 'rival' | 'upset' | 'teen' | 'retire' | 'yearEnd' | 'you'; text: string; ids: string[]; band?: Band }
export interface Pending { type: 'injury' | 'yearEnd' | 'forcedRetire'; injury?: string; coachOffers?: Coach[]; sponsorOffers?: Sponsor[]; text?: string; path?: PathDecision }
/** The decision at 18 (choose), the yearly check-in during the four path years (review) and the end of the path (final). */
export interface PathDecision { kind: 'choose' | 'review' | 'final'; current?: PathKind; yearsLeft?: number; read: { peak: number; cur: number; now: number; pot: number; verdict: string; age: number; jbest: number; levelTop100: number }; record: string[] }
export type PathChoice = PathKind | 'stay' | 'quit';
export interface BlockPlan { wc?: string[]; weeks: Record<number, string>; route: string; lifeEv?: string; lifeChoice?: number }
export interface BlockSummary { year: number; block: number; fromWk: number; toWk: number; rankFrom: number; rankTo: number; ptsFrom: number; ptsTo: number; tourneys: string[]; notes: string[]; dev: Partial<Abil>; cashFrom: number; cashTo: number; injuries: string[]; newAch: string[]; world: string[]; follow: string[] }
export interface WorldRec { champs: { ed: string; name: string; year: number; band: Band; cat: string; w: string; f?: string; wk: number }[]; yearEnd: Record<number, { id: string; pts: number }[]>; no1: Record<string, number>; retired: { id: string; year: number }[]; rookies: Record<number, string[]>; news?: News[]; mile?: Record<string, number>; lastNo1?: string }

export interface State {
  v: { schema: number; engine: string; balance: string; content: string; rng: string };
  careerId: string; seed: string; tour: Tour; userId: string; createdUtc: string; rev: number; seq: number;
  wk: number; year: number; week: number; block: number; phase: 'plan' | 'interrupt' | 'yearEnd' | 'retired' | 'live';
  live?: Live; midWeek?: boolean; jrank?: Record<string, number>; jpts?: Record<string, number>; jorder?: string[];
  players: Record<string, Player>; active: string[]; rank: Record<string, number>; pts: Record<string, number>; race: Record<string, number>; order: string[];
  cal: Edition[]; memo: Record<string, { cut: number; qcut: number }>; bandMemo: Record<string, { cut: number; qcut: number; n: number }>;
  u: UserCareer; world: WorldRec; pending?: Pending; plan?: BlockPlan; lastSummary?: BlockSummary; sumAcc?: BlockSummary; retire?: { year: number; wk: number; reason: string; date: string };
  blockStartRank?: Record<string, number>;
  ledger: { seq: number; wk: number; date: string; type: string; cmd: string; data?: any }[]; lastCmd?: string; nextPid: number;
}
export interface Setup { tour: Tour; name: string; country: string; pronouns: string; birthMonth: number; birthDay: number; hand: 'R' | 'L'; avatar: number; focusSurface: Surface | 'all'; skills: [Ability, Ability]; profile: ProfileKind | 'unknown'; adult: boolean; detail: 'quick' | 'detailed'; seed: string; portrait?: string; start?: 'junior' | 'pro'; speed?: 'early' | 'steady' | 'late' | 'unknown'; academy?: Academy }
export type Academy = 'club' | 'national' | 'elite';
export type PathKind = 'pro' | 'college' | 'academy';

/** A user match being played hands-on: decisions so far, where it is paused, and the final result once done. */
export interface Live {
  key: string; ed: string; round: string; a: string; b: string; u: 0 | 1; dec: import('./match').Decision[]; film?: boolean;
  pause?: import('./match').Pause; done?: { winner: 0 | 1; score: string; sets: [number, number, number?, number?][]; flow: number[]; stats: [MatchStats, MatchStats]; plan?: { my: string[]; opp: string[] }; cls: 'played' | 'ret' };
}
