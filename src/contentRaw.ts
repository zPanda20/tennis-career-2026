// The bundled content package (spec 18.1): text files compiled into the static bundle.
import players_atp from '../content/players_atp.txt?raw';
import players_wta from '../content/players_wta.txt?raw';
import events_atp from '../content/events_atp.txt?raw';
import events_wta from '../content/events_wta.txt?raw';
import events_chal from '../content/events_chal.txt?raw';
import events_wta125 from '../content/events_wta125.txt?raw';
import events_itf_m from '../content/events_itf_m.txt?raw';
import events_itf_w from '../content/events_itf_w.txt?raw';
import { parseContent } from './core/content';
export const CONTENT = parseContent({ players_atp, players_wta, events_atp, events_wta, events_chal, events_wta125, events_itf_m, events_itf_w });
