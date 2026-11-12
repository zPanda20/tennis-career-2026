// Content package: real players and real 2026 events parsed from the text files in /content.
// Factual identity (name, tour, nationality, birth year, hand, starting rank) is kept apart from authored game ratings,
// which are generated in world.ts. Birth dates are stored to year precision only (bornApprox) and shown as ages.
import type { Band, EvTemplate, Style, Surface, Tour } from './types';

export const CONTENT_VERSION = '2026.1';
export const SNAPSHOT_NOTE: Record<Tour, string> = {
  atp: 'ATP ranking order of 17 November 2025 (the 2025 year-end list used for Australian Open 2026 entry). Starting points are game estimates.',
  wta: 'WTA year-end ranking and points published 10 November 2025.',
};
export interface RealPlayer { rank: number; name: string; country: string; year: number; hand: 'R' | 'L'; style?: Style; pts?: number; outUntil?: number }
export interface Content { version: string; players: Record<Tour, RealPlayer[]>; events: Record<Tour, EvTemplate[]> }
export type RawContent = Record<'players_atp' | 'players_wta' | 'events_atp' | 'events_wta' | 'events_chal' | 'events_wta125' | 'events_itf_m' | 'events_itf_w', string>;

const BASE = Date.UTC(2026, 0, 5), WEEK = 6048e5;
export function firstMonday(y: number) { const d = new Date(Date.UTC(y, 0, 2)); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); }
export const weeksIn = (y: number) => Math.round((firstMonday(y + 1) - firstMonday(y)) / WEEK);
export const absOf = (y: number, week: number) => Math.round((firstMonday(y) - BASE) / WEEK) + week;
export const wkDate = (abs: number, day = 0) => new Date(BASE + abs * WEEK + day * 864e5);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (d: Date | string) => { const x = typeof d === 'string' ? new Date(d + 'T00:00:00Z') : d; return `${x.getUTCDate()} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
export const fmtShort = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
export function ageOn(born: string, d: Date) { const b = new Date(born + 'T00:00:00Z'); let a = d.getUTCFullYear() - b.getUTCFullYear(); if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) a--; return a; }

const REGIONS: Record<string, string> = {
  EU: 'FRA ESP ITA GER GBR NED BEL SUI AUT POR CZE SVK POL HUN ROU BUL SRB CRO SLO BIH MKD GRE TUR SWE NOR DEN FIN EST LAT LTU UKR RUS BLR MDA IRL LUX MON AND SMR LIE GEO ARM CYP',
  NA: 'USA CAN MEX CRC DOM JAM ESA', SA: 'ARG BRA CHI COL PER ECU URU PAR BOL', AS: 'CHN JPN KOR IND THA VIE TPE HKG SGP INA PHI KAZ UZB PAK',
  OC: 'AUS NZL NCL GUM', AF: 'TUN EGY MAR RSA KEN RWA CIV CGO BDI BOT', ME: 'QAT UAE KSA BRN KUW LBN',
};
const REGION_OF: Record<string, string> = {};
for (const [r, list] of Object.entries(REGIONS)) for (const c of list.split(' ')) REGION_OF[c] = r;
export const regionOf = (c: string) => REGION_OF[c] ?? 'EU';
const NEAR: Record<string, string[]> = { EU: ['AF', 'ME'], AF: ['EU', 'ME'], ME: ['EU', 'AF', 'AS'], NA: ['SA'], SA: ['NA'], AS: ['OC', 'ME'], OC: ['AS'] };
/** 0 local, 1 regional, 2 intercontinental */
export function travelClass(home: string, evCountry: string): 0 | 1 | 2 {
  if (home === evCountry) return 0;
  const a = regionOf(home), b = regionOf(evCountry);
  if (a === b) return a === 'EU' ? 0 : 1;
  return NEAR[a]?.includes(b) ? 1 : 2;
}
export const COUNTRY_NAMES: Record<string, string> = { USA: 'United States', GBR: 'Great Britain', FRA: 'France', ESP: 'Spain', ITA: 'Italy', GER: 'Germany', AUS: 'Australia', ARG: 'Argentina', BRA: 'Brazil', CAN: 'Canada', JPN: 'Japan', CHN: 'China', CZE: 'Czechia', POL: 'Poland', SUI: 'Switzerland', NED: 'Netherlands', BEL: 'Belgium', SRB: 'Serbia', CRO: 'Croatia', RUS: 'Russia', UKR: 'Ukraine', KAZ: 'Kazakhstan', GRE: 'Greece', NOR: 'Norway', DEN: 'Denmark', SWE: 'Sweden', FIN: 'Finland', AUT: 'Austria', POR: 'Portugal', ROU: 'Romania', BUL: 'Bulgaria', HUN: 'Hungary', SVK: 'Slovakia', TUR: 'Türkiye', CHI: 'Chile', COL: 'Colombia', MEX: 'Mexico', KOR: 'South Korea', IND: 'India', TPE: 'Chinese Taipei', THA: 'Thailand', NZL: 'New Zealand', RSA: 'South Africa', TUN: 'Tunisia', EGY: 'Egypt', MON: 'Monaco', IRL: 'Ireland' };
export const countryName = (c: string) => COUNTRY_NAMES[c] ?? c;

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const playerId = (tour: Tour, name: string) => `${tour}:${slug(name)}`;
const weekOf = (mmdd: string) => Math.floor((Date.UTC(2026, +mmdd.slice(0, 2) - 1, +mmdd.slice(3, 5)) - BASE) / WEEK);
const surf = (s: string): [Surface, boolean] => [s[0] === 'C' ? 'clay' : s[0] === 'G' ? 'grass' : 'hard', s.endsWith('i')];
const lines = (raw: string) => raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

function parsePlayers(raw: string): RealPlayer[] {
  return lines(raw).map(l => {
    const [rank, name, country, year, hand, style, pts] = l.split('|');
    const p: RealPlayer = { rank: +rank, name, country, year: +year, hand: (hand as 'R' | 'L') || 'R' };
    if (style) p.style = style as Style;
    if (pts) p.pts = +pts;
    if (name === 'Holger Rune') p.outUntil = 26; // long-term injury absence that began before the starting snapshot
    return p;
  });
}
function parseMain(raw: string, tour: Tour): EvTemplate[] {
  const T = tour.toUpperCase();
  return lines(raw).map(l => {
    const [d, name, city, country, cat, s, draw, weeks, dates] = l.split('|');
    const band: Band = cat === 'GS' ? 'GS' : cat === 'F' ? 'F' : (`T${cat}` as Band);
    const [surface, indoor] = surf(s);
    const slam = name.startsWith('Australian') ? 'ao' : name.startsWith('French') ? 'rg' : name === 'Wimbledon' ? 'wim' : name === 'US Open' ? 'uso' : undefined;
    const label = band === 'GS' ? 'Grand Slam' : band === 'F' ? `${T} Finals` : tour === 'atp' && cat === '1000' ? 'ATP Masters 1000' : `${T} ${cat}`;
    return { series: `${tour}:${slug(name)}`, name, city, country, tour, band, cat: label, surface, indoor, draw: +draw, weeks: +weeks, week: weekOf(d), dates, slam };
  });
}
function parseWeekly(raw: string, tour: Tour, kind: 'chal' | 'w125' | 'itf'): EvTemplate[] {
  const out: EvTemplate[] = [];
  for (const l of lines(raw)) {
    const [d, rest] = l.split('|'); const week = weekOf(d);
    for (const item of rest.split(';')) {
      const f = item.split(',');
      let cat: string, city: string, country: string, s: string, band: Band, name: string;
      if (kind === 'w125') { [city, country, s] = f; cat = 'WTA 125'; band = 'UL'; name = `${city} 125`; }
      else if (kind === 'chal') { [cat, city, country, s] = f; band = +cat >= 100 ? 'UL' : 'SL'; name = `${city} Challenger`; cat = `Challenger ${cat}`; }
      else { [cat, city, country, s] = f; band = cat === 'W100' ? 'UL' : cat === 'W75' || cat === 'W50' ? 'SL' : 'EP'; name = `${cat} ${city}`; cat = `ITF ${cat}`; }
      const [surface, indoor] = surf(s);
      out.push({ series: `${tour}:${slug(cat)}-${slug(city)}-w${week}`, name, city, country, tour, band, cat, surface, indoor, draw: 32, weeks: 1, week });
    }
  }
  return out;
}
/** July–December ITF events are not verified: reuse first-half venues and flag them provisional. */
function provisionalItf(evs: EvTemplate[]): EvTemplate[] {
  const out: EvTemplate[] = [];
  for (let w = 26; w <= 49; w++) {
    const src = w <= 38 ? w - 13 : w - 39;
    for (const e of evs.filter(x => x.week === src)) out.push({ ...e, week: w, prov: true, series: e.series.replace(/-w\d+$/, `-w${w}`) });
  }
  return out;
}
export function parseContent(raw: RawContent): Content {
  const itfM = parseWeekly(raw.events_itf_m, 'atp', 'itf'), itfW = parseWeekly(raw.events_itf_w, 'wta', 'itf');
  const atp = [...parseMain(raw.events_atp, 'atp'), ...parseWeekly(raw.events_chal, 'atp', 'chal'), ...itfM, ...provisionalItf(itfM)];
  const wta = [...parseMain(raw.events_wta, 'wta'), ...parseWeekly(raw.events_wta125, 'wta', 'w125'), ...itfW, ...provisionalItf(itfW)];
  const seen = new Set<string>();
  for (const e of [...atp, ...wta]) { let s = e.series, i = 2; while (seen.has(s)) s = `${e.series}-${i++}`; e.series = s; seen.add(s); }
  return { version: CONTENT_VERSION, players: { atp: parsePlayers(raw.players_atp), wta: parsePlayers(raw.players_wta) }, events: { atp, wta } };
}
export function validateContent(c: Content): string[] {
  const errs: string[] = [];
  for (const t of ['atp', 'wta'] as Tour[]) {
    for (const e of c.events[t]) {
      if (!(e.week >= 0 && e.week < 52)) errs.push(`${e.name}: week out of range`);
      if (!e.country || !e.city) errs.push(`${e.name}: missing location`);
      if (![8, 28, 30, 32, 48, 56, 96, 128].includes(e.draw)) errs.push(`${e.name}: unsupported draw ${e.draw}`);
    }
    const names = new Set<string>();
    for (const p of c.players[t]) { if (names.has(p.name)) errs.push(`duplicate player ${p.name}`); names.add(p.name); if (!(p.year > 1975 && p.year < 2010)) errs.push(`${p.name}: birth year`); }
    for (const s of ['ao', 'rg', 'wim', 'uso']) if (!c.events[t].some(e => e.slam === s)) errs.push(`${t}: missing slam ${s}`);
  }
  return errs;
}
