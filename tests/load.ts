import { readFileSync } from 'node:fs';
import { parseContent, RawContent } from '../src/core/content';
const keys = ['players_atp', 'players_wta', 'events_atp', 'events_wta', 'events_chal', 'events_wta125', 'events_itf_m', 'events_itf_w'] as const;
export function loadContent() {
  const raw = {} as RawContent;
  for (const k of keys) raw[k] = readFileSync(new URL(`../content/${k}.txt`, import.meta.url), 'utf8');
  return parseContent(raw);
}
