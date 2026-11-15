import { ReactNode, useEffect, useRef } from 'react';
import { BRANDS } from '../core/names';
import { countryName } from '../core/content';
import { COUNTRIES, NEUTRAL } from '../core/countries';
import type { Player, Sponsor, State, Surface } from '../core/types';
import { set, useApp } from './store';

export const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const SURF: Record<Surface, string> = { hard: 'Hard', clay: 'Clay', grass: 'Grass' };
export const rankTxt = (r?: number) => (r ? `No. ${r}` : 'Unranked');

export function Avatar({ p, size = 44, name, user }: { p?: Player; size?: number; name?: string; user?: number }) {
  const { assets, S } = useApp(), nm = p?.name ?? name ?? '?', src = (p?.user && S?.u.portrait) || assets[`player:${nm}`];
  const initials = nm.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hues = [212, 16, 148, 268, 38, 186, 330, 96], hue = user !== undefined ? hues[user % hues.length] : [...nm].reduce((t, c) => t + c.charCodeAt(0), 0) % 360;
  if (src) return <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} loading="lazy" />;
  return <span className="avatar ph" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 32% 88%)`, color: `hsl(${hue} 45% 28%)` }}>{initials}</span>;
}
export function Who({ S, id, rank, sub }: { S: State; id: string; rank?: number; sub?: ReactNode }) {
  const p = S.players[id]; if (!p) return <span>Unknown player</span>;
  return (
    <button className="who" onClick={() => set({ overlay: { kind: 'player', id } })}>
      <Avatar p={p} size={36} user={p.user ? S.u.avatar : undefined} />
      <span><b>{p.name}</b>{!p.real && !p.user && <span className="tag" title="Generated player, not a real person">fictional</span>}<small><Flag c={p.country} size={15} /> {p.country}{rank ? ` · ${rankTxt(rank)}` : ''}{sub ? <> · {sub}</> : null}</small></span>
    </button>
  );
}
export function Bar({ label, value, max = 100, tone = 'action', invert, note, delta }: { label: string; value: number; max?: number; tone?: string; invert?: boolean; note?: string; delta?: number }) {
  const v = Math.max(0, Math.min(max, value)), bad = invert ? v > 60 : v < 35, mid = invert ? v > 40 : v < 55;
  return (
    <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(v)} aria-label={`${label}${note ? `, ${note}` : ''}`}>
      <div className="bar-top"><span>{label}</span><span className="num">{Math.round(v)}{delta !== undefined && Math.abs(delta) >= 0.05 ? <em className={delta > 0 ? 'up' : 'down'}> {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}</em> : null}{note ? <small> {note}</small> : null}</span></div>
      <div className="track"><i className={`fill ${tone === 'cond' ? (bad ? 'crit' : mid ? 'warn' : 'ok') : tone}`} style={{ width: `${(v / max) * 100}%` }} /></div>
    </div>
  );
}
export function Stat({ k, v, sub }: { k: string; v: ReactNode; sub?: ReactNode }) { return <div className="stat"><span className="k">{k}</span><span className="v num">{v}</span>{sub ? <span className="sub">{sub}</span> : null}</div>; }
export function Pill({ tone, children }: { tone?: string; children: ReactNode }) { return <span className={`pill ${tone ?? ''}`}>{children}</span>; }
export function SurfaceTag({ s, indoor }: { s: Surface; indoor?: boolean }) { return <span className={`surf ${s}`}><i aria-hidden="true" />{SURF[s]}{indoor ? ' (indoor)' : ''}</span>; }
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; ref.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); return () => { document.removeEventListener('keydown', k); prev?.focus?.(); };
  }, []);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="Close">✕</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function BrandMark({ sp, size = 28 }: { sp: Pick<Sponsor, 'slot' | 'brand' | 'name'>; size?: number }) {
  const { assets, labels } = useApp(), key = `brand:${sp.slot}:${sp.brand}`, src = assets[key];
  return <span className="brand">{src ? <img src={src} alt="" style={{ height: size, maxWidth: size * 3 }} /> : <span className="brand-ph" aria-hidden="true">{(labels[key] ?? sp.name)[0]}</span>}<b>{labels[key] ?? BRANDS[sp.slot][sp.brand] ?? sp.name}</b></span>;
}
export function EventLogo({ slam, tour, size = 40 }: { slam?: string; tour: string; size?: number }) {
  const { assets } = useApp(), src = slam ? assets[`event:${slam}`] : assets[`event:${tour}`];
  return src ? <img className="evlogo" src={src} alt="" style={{ height: size, maxWidth: size * 2.4 }} /> : null;
}
/** National flag (image, so it renders on every platform). Neutral athletes get a plain marker, as on the tours. */
export function Flag({ c, size = 18 }: { c: string; size?: number }) {
  const k = COUNTRIES[c], label = NEUTRAL.has(c) ? 'Neutral athlete' : k?.name ?? c;
  if (NEUTRAL.has(c) || !k) return <span className="flag neutral" role="img" aria-label={label} title={label} style={{ height: size * 0.75, width: size }} />;
  return <span className={`flag fi fi-${k.iso}`} role="img" aria-label={label} title={label} style={{ height: size * 0.75, width: size }} />;
}
/** Event name tinted by its court surface. */
export const EvName = ({ name, surface }: { name: string; surface: Surface }) => <span className={`evn ${surface}`}>{name}</span>;
/** Downscale an image file to a square portrait data URL (centre crop). */
export async function portraitFromFile(file: File, px = 320): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is too large.');
  const bmp = await createImageBitmap(file), s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = c.height = px; const g = c.getContext('2d')!;
  g.drawImage(bmp, (bmp.width - s) / 2, Math.max(0, (bmp.height - s) / 2 - s * 0.08), s, s, 0, 0, px, px); bmp.close();
  let out = c.toDataURL('image/webp', 0.82); if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.82);
  return out;
}
export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) { return <section className="sec"><div className="sec-head"><h3>{title}</h3>{aside}</div>{children}</section>; }
