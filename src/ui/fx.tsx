// Centre Court visual vocabulary: tennis balls, rings, the season track, the court backdrop, the momentum wave.
import { BLOCKS } from '../core/balance';
import type { State, Surface, UMatch } from '../core/types';
import { absOf, wkDate } from '../core/content';

export const SURF_COLOR: Record<Surface, string> = { hard: '#5DB8FF', clay: '#FF8A4C', grass: '#8EE06A' };
export const BLOCK_SURF: Surface[] = ['hard', 'clay', 'grass', 'hard'];
export const SWING_NAME: Record<number, string> = { 0: 'The Australian swing', 1: 'The clay swing', 2: 'The grass swing', 3: 'The American and Asian swing' };
export const SWING_SHORT: Record<number, [string, string]> = { 0: ['The Aussie', 'swing'], 1: ['The clay', 'swing'], 2: ['The grass', 'swing'], 3: ['The hard-court', 'swing'] };
export const SWING_ENDS: Record<number, string> = { 0: 'Builds to the Australian Open, then Indian Wells and Miami', 1: 'Ends at the French Open', 2: 'Builds to Wimbledon', 3: 'Through the US Open to the Tour Finals' };

/** Season colour for an absolute week: the swing it falls in (Aussie hard, clay, grass, late hard). */
export function seasonOf(abs: number): Surface {
  const d = wkDate(abs), y = d.getUTCFullYear(), w = abs - absOf(y, 0);
  return w >= 0 && w < BLOCKS[1] ? 'hard' : w < BLOCKS[2] ? 'clay' : w < BLOCKS[3] ? 'grass' : 'hard';
}
export function tintOf(S: State | null): Surface {
  if (!S || S.phase === 'retired' || S.phase === 'yearEnd') return 'hard';
  return BLOCK_SURF[S.block] ?? 'hard';
}

export function Ball({ size = 22, empty, glow }: { size?: number; empty?: boolean; glow?: boolean }) {
  if (empty) return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="ball-ic"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" /></svg>;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={`ball-ic ${glow ? 'glow' : ''}`}>
      <circle cx="12" cy="12" r="11" fill="var(--ball)" />
      <path d="M4.5 4.5c3.6 3.6 3.6 11.4 0 15M19.5 4.5c-3.6 3.6-3.6 11.4 0 15" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
export function Arrow({ back }: { back?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{back ? <path d="M15 9H3M8 4L3 9l5 5" /> : <path d="M3 9h12M10 4l5 5-5 5" />}</svg>;
}
/** Run of balls: one filled per win, an empty ring for the match that ended the run. */
export function BallRun({ wins, lost, size = 20, label }: { wins: number; lost: boolean; size?: number; label: string }) {
  return <span className="ballrun" role="img" aria-label={label}>{Array.from({ length: Math.min(wins, 9) }, (_, i) => <Ball key={i} size={size} />)}{lost && <Ball size={size} empty />}</span>;
}
export function Ring({ value, size = 72, stroke = 7, warn, children, label }: { value: number; size?: number; stroke?: number; warn?: boolean; children?: React.ReactNode; label: string }) {
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={warn ? 'var(--warn)' : 'var(--ball)'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * v).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />
      </svg>
      <span className="ring-in">{children}</span>
    </span>
  );
}
export function CourtBg() {
  return (
    <svg className="courtbg" aria-hidden="true" viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice">
      <defs><linearGradient id="cfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity="1" /></linearGradient><mask id="cmask"><rect width="1440" height="460" fill="url(#cfade)" /></mask></defs>
      <g mask="url(#cmask)" fill="none" stroke="var(--line)" strokeWidth="3">
        <path d="M160 470 L560 60 L880 60 L1280 470" /><path d="M300 470 L610 60 M1140 470 L830 60" />
        <path d="M569 105 L871 105 M418 270 L1022 270 M720 105 L720 270" /><path d="M420 170 L1020 170" strokeWidth="6" />
      </g>
    </svg>
  );
}
/** Season timeline: four swings coloured by surface, majors as nodes, a ball for "now". */
export function SeasonTrack({ S }: { S: State }) {
  const W = 1000, wk = S.week, n = 52, x = (w: number) => 10 + (w / n) * (W - 20);
  const segs: [number, number, Surface][] = [[BLOCKS[0], BLOCKS[1], 'hard'], [BLOCKS[1], BLOCKS[2], 'clay'], [BLOCKS[2], BLOCKS[3], 'grass'], [BLOCKS[3], n, 'hard']];
  const majors = S.cal.filter(e => e.band === 'GS' || e.band === 'F').map(e => ({ x: x(e.week + (e.weeks === 2 ? 0.5 : 0)), name: e.band === 'F' ? 'Finals' : e.name, s: e.surface, past: e.startWk + e.weeks <= S.wk }));
  const now = S.phase === 'retired' ? null : x(Math.min(wk, n));
  return (
    <svg className="seasontrack" viewBox={`0 0 ${W} 58`} preserveAspectRatio="none" role="img" aria-label={`Season ${S.year}: week ${Math.min(wk + 1, 52)} of 52`}>
      {segs.map(([a, b, s], i) => { const past = b <= wk, cur = a <= wk && wk < b; return <line key={i} x1={x(a) + 4} x2={x(b) - 4} y1="18" y2="18" stroke={SURF_COLOR[s]} strokeWidth="6" strokeLinecap="round" opacity={past ? 1 : cur ? 0.75 : 0.35} />; })}
      {majors.map((m, i) => <g key={i}><circle cx={m.x} cy="18" r="7" fill={m.past ? SURF_COLOR[m.s] : 'var(--bg)'} stroke={SURF_COLOR[m.s]} strokeWidth="2.5" /><text x={m.x} y="48" textAnchor="middle" className="track-t">{m.name.replace(' Open', '')}</text></g>)}
      {now !== null && <g><circle cx={now} cy="18" r="17" fill="var(--ball)" opacity="0.22" /><circle cx={now} cy="18" r="10" fill="var(--ball)" /></g>}
    </svg>
  );
}
/** Momentum from game-by-game flow: a running balance of games won, drawn as a two-colour wave. */
export function Momentum({ m, oppName, upto }: { m: UMatch; oppName: string; upto?: number }) {
  if (!m.flow || m.flow.length < (upto ? 1 : 6)) return null;
  const g = m.flow.split('').map(Number), W = 760, H = 120, mid = 60;
  let v = 0; const pts: [number, number][] = [[0, mid]];
  g.forEach((w, i) => { v = v * 0.86 + (w ? 1 : -1); pts.push([((i + 1) / g.length) * W, mid - Math.max(-4.6, Math.min(4.6, v)) * 11.5]); });
  const cut = upto ? pts.slice(0, Math.min(pts.length, upto + 1)) : pts;
  // smooth with midpoint quadratic curves so the wave reads as a swing, not a saw
  let d = `M${cut[0][0]} ${cut[0][1]}`;
  for (let k = 1; k < cut.length - 1; k++) { const mx = (cut[k][0] + cut[k + 1][0]) / 2, my = (cut[k][1] + cut[k + 1][1]) / 2; d += ` Q${cut[k][0].toFixed(1)} ${cut[k][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  const lastX = cut[cut.length - 1][0];
  d += ` L${lastX.toFixed(1)} ${cut[cut.length - 1][1].toFixed(1)}`;
  const area = `${d} L${lastX.toFixed(1)} ${mid} L0 ${mid} Z`;
  const sets = m.sets ?? [], bounds: number[] = []; let acc = 0;
  for (const s of sets.slice(0, -1)) { acc += s[0] + s[1]; bounds.push((acc / g.length) * W); }
  const id = `mo${m.id.replace(/[^a-z0-9]/gi, '').slice(-10)}`;
  return (
    <figure className="momentum">
      <figcaption><span>Momentum</span><span className="legend"><i style={{ background: '#fff' }} />You<i style={{ background: 'var(--glow)' }} />{oppName.split(' ').slice(-1)[0]}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label="How the match swung, game by game">
        <defs><clipPath id={`${id}t`}><rect width={W} height={mid} /></clipPath><clipPath id={`${id}b`}><rect y={mid} width={W} height={H} /></clipPath></defs>
        <path d={area} clipPath={`url(#${id}t)`} fill="rgba(255,255,255,0.82)" />
        <path d={area} clipPath={`url(#${id}b)`} fill="var(--glow)" />
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="rgba(255,255,255,0.3)" />
        {bounds.filter(b => b <= lastX + 1).map((b, i) => <line key={i} x1={b} x2={b} y1="4" y2={H - 4} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 5" />)}
        {sets.map((_, i) => { const a = i === 0 ? 0 : bounds[i - 1], b = bounds[i] ?? W; if (a >= lastX - 1) return null; return <text key={i} x={(a + b) / 2} y={H + 12} textAnchor="middle" className="track-t">SET {i + 1}</text>; })}
      </svg>
    </figure>
  );
}
