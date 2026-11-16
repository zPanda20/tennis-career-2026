// Rival cards, season goals, the trophy cabinet, tour news and console-style watch controls.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSetting, setSetting } from '../persist/db';
import { blockWeeks, estimate } from '../core/agent';
import { fmtShort, wkDate } from '../core/content';
import { goalProgress } from '../core/goals';
import { newsSince } from '../core/news';
import { RIVAL_MEETINGS, playedVs, rivalCandidates, rivalFit, rivalIn, rivalsIn } from '../core/rivals';
import { roundName } from '../core/selectors';
import type { Band, Edition, Goal, News, State, UTourney } from '../core/types';
import { Avatar, EvName, Flag, Modal, money, rankOf } from './bits';
import { Ring } from './fx';
import { dispatch, set, useApp } from './store';

const last = (n: string) => n.split(' ').slice(1).join(' ') || n;

// ---------- rivals ----------
export function RivalCard({ S, id }: { S: State; id: string }) {
  const p = S.players[id], u = S.u, { save } = useApp(), ro = save === 'readonly' || S.phase === 'retired';
  const fit = useMemo(() => (p ? rivalFit(S, id) : null), [S, id]);
  const ms = useMemo(() => playedVs(S, id).slice().reverse(), [S, id]);
  const next = useMemo(() => upcomingWith(S, id, 3), [S, id]);
  if (!p || !fit) return null;
  const isRival = u.rivals.includes(id), denied = (u.rivalNo ?? []).includes(id);
  const setR = (yes: boolean) => dispatch({ type: 'SetRival', opp: id, yes }, yes ? 'Rival confirmed' : 'Saved');
  return (
    <Modal title={isRival ? 'Rival' : 'Rival card'} onClose={() => set({ overlay: null })} wide>
      <div className="rival-top">
        <Avatar p={p} size={96} />
        <div className="grow">
          <span className="kicker">{isRival ? 'Confirmed rival' : denied ? 'Not a rival' : `Met ${ms.length} times`}</span>
          <h2 className="display" style={{ margin: '.3rem 0' }}><Flag c={p.country} size={22} /> {p.name}</h2>
          <p className="muted">{p.retired ? `Retired after ${p.retired}` : rankOf(S, id)} · career high {p.bestRank < 9999 ? p.bestRank : '–'} · {p.titles} titles{p.majors ? `, ${p.majors} majors` : ''}</p>
        </div>
        <div className="h2h-big" aria-label={`Head to head ${fit.w} wins, ${fit.l} losses`}><span className={fit.w >= fit.l ? 'lead' : ''}>{fit.w}</span><i>–</i><span className={fit.l > fit.w ? 'lead' : ''}>{fit.l}</span><small>head to head</small></div>
      </div>
      <div className="rival-grid">
        <section className="glass">
          <div className="sec-head"><h3>Rivalry fit</h3></div>
          <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
            <Ring value={fit.score / 100} size={104} stroke={10} label={`Rivalry fit ${fit.score} out of 100`}><span className="big" style={{ fontSize: '2.2rem' }}>{fit.score}</span></Ring>
            <div><b style={{ fontSize: '1.2rem' }}>{fit.verdict}</b><p className="muted" style={{ margin: '.3rem 0 0' }}>{fit.future}.</p></div>
          </div>
          <ul className="facts">{fit.facts.map(f => <li key={f.k} className={f.good ? 'good' : ''}><span className="mk" aria-hidden="true">{f.good ? '✓' : '·'}</span><span><small>{f.k}</small><br />{f.v}</span></li>)}</ul>
          <p className="help">Potential is a scouting read, not an exact figure. A good rival has a similar ceiling, a similar age and plays the same level of events, so you keep meeting.</p>
        </section>
        <section className="glass">
          <div className="sec-head"><h3>Meetings</h3><small>{ms.length}</small></div>
          <ul className="list">{ms.slice(0, 8).map(m => <li key={m.id}><button className="rowbtn" onClick={() => set({ overlay: { kind: 'match', id: m.id } })}><span className="grow"><b>{m.won ? 'Won' : 'Lost'} {m.score}</b><small>{u.tourneys.find(t => t.ed === m.ed)?.name ?? ''} {m.year} · {m.qual ? 'qualifying' : roundName(m.round)} · <span style={{ textTransform: 'capitalize' }}>{m.surface}</span></small></span></button></li>)}</ul>
          {next.length > 0 && <><div className="sec-head" style={{ marginTop: '1rem' }}><h3>Next likely meeting</h3></div>
            <ul className="plain">{next.map(n => <li key={n.ed.id}><b><EvName name={n.ed.name} surface={n.ed.surface} /></b> <small>{fmtShort(wkDate(n.ed.startWk))} · {n.how === 'entered' ? 'entered' : n.how}</small></li>)}</ul></>}
        </section>
      </div>
      {!ro && <div className="row" style={{ marginTop: '1rem', gap: '.8rem' }}>
        {!isRival && <button className="cta" onClick={() => setR(true)}>Confirm as rival</button>}
        {!isRival && !denied && <button className="btn" onClick={() => setR(false)}>Not a rival</button>}
        {isRival && <button className="btn" onClick={() => setR(false)}>Remove as rival</button>}
        <button className="btn ghost" onClick={() => set({ overlay: { kind: 'player', id } })}>Full player card</button>
      </div>}
      {isRival && <p className="muted">Rivals get a "next meeting" alert when you plan, their milestones in tour news, and their matches against you are always shown game by game in Top player mode.</p>}
    </Modal>
  );
}
/** Upcoming events where both you and this player are likely to be in the draw. */
export function upcomingWith(S: State, id: string, n: number, untilWk = Infinity): { ed: Edition; how: 'entered' | 'likely' | 'possible' }[] {
  const out: { ed: Edition; how: 'entered' | 'likely' | 'possible' }[] = [];
  for (const ed of S.cal.slice().sort((a, b) => a.startWk - b.startWk)) {
    if (ed.done || ed.cancelled || ed.band === 'F' || ed.startWk < S.wk || ed.startWk >= untilWk) continue;
    if (estimate(S, ed) === 'unlikely') continue;
    const how = rivalIn(S, ed, id); if (how && how !== 'possible') out.push({ ed, how });
    if (out.length >= n) break;
  }
  return out;
}
export function RivalTag({ S, ed }: { S: State; ed: Edition }) {
  const rs = rivalsIn(S, ed).filter(r => r.how !== 'possible' || S.u.rivals.length <= 3);
  if (!rs.length) return null;
  return <span className="tag rival" title={rs.map(r => `${S.players[r.id].name}: ${r.how}`).join(', ')}>⚔ {rs.map(r => last(S.players[r.id].name)).join(', ')}{rs.every(r => r.how === 'possible') ? '?' : ''}</span>;
}
/** The first planned or likely meeting with a confirmed rival during this block. */
export function nextMeeting(S: State, weeks: number[], plan?: Record<number, string>) {
  if (!weeks.length) return null;
  const end = weeks[weeks.length - 1] + 1;
  for (const id of S.u.rivals) {
    if (plan) { for (const edId of Object.values(plan)) { const ed = S.cal.find(e => e.id === edId); const how = ed && rivalIn(S, ed, id); if (ed && how) return { id, ed, how }; } continue; }
    const [m] = upcomingWith(S, id, 1, end); if (m) return { id, ...m };
  }
  return null;
}
export function RivalAlert({ S }: { S: State }) {
  const cands = useMemo(() => rivalCandidates(S), [S]);
  const weeks = useMemo(() => (S.phase === 'plan' ? blockWeeks(S) : []), [S]);
  const nm = useMemo(() => nextMeeting(S, weeks), [S, weeks]);
  if (!cands.length && !nm) return null;
  return (
    <section className="glass rival-alert">
      {nm && <button className="rowbtn" onClick={() => set({ overlay: { kind: 'rival', id: nm.id } })}><Avatar p={S.players[nm.id]} size={44} /><span className="grow"><small className="eyebrow" style={{ margin: 0 }}>Next meeting</small><br /><b>{S.players[nm.id].name}</b> is {nm.how === 'entered' ? 'entered at' : 'likely at'} <EvName name={nm.ed.name} surface={nm.ed.surface} /> <small>{fmtShort(wkDate(nm.ed.startWk))}</small></span><span className="pill">Rival</span></button>}
      {cands.slice(0, 2).map(id => <button key={id} className="rowbtn" onClick={() => set({ overlay: { kind: 'rival', id } })}><Avatar p={S.players[id]} size={44} /><span className="grow"><small className="eyebrow" style={{ margin: 0 }}>New rival card</small><br /><b>{S.players[id].name}</b> <small>· met {playedVs(S, id).length} times</small></span><span className="pill ok">Review</span></button>)}
    </section>
  );
}

export function RivalsSection({ S }: { S: State }) {
  const u = S.u, cands = rivalCandidates(S);
  const row = (id: string, tag: string) => { const ms = playedVs(S, id), w = ms.filter(m => m.won).length; return <li key={id}><button className="rowbtn" onClick={() => set({ overlay: { kind: 'rival', id } })}><Avatar p={S.players[id]} size={40} /><span className="grow"><b>{S.players[id]?.name}</b><small>{rankOf(S, id)} · {tag}</small></span><span className="num pts">{w}–{ms.length - w}</span></button></li>; };
  return (
    <section className="sec">
      <div className="sec-head"><h3>Rivals</h3><small>a card appears after {RIVAL_MEETINGS} meetings</small></div>
      {u.rivals.length + cands.length ? <ul className="list">{u.rivals.filter(id => S.players[id]).map(id => row(id, 'rival'))}{cands.map(id => row(id, 'card waiting for your decision'))}</ul> : <p className="muted">No rival cards yet. Play someone three times and they get one.</p>}
    </section>
  );
}

// ---------- goals ----------
export function GoalRow({ S, g }: { S: State; g: Goal }) {
  const pr = goalProgress(S, g), done = g.done !== undefined;
  return (
    <li className={`goal ${done ? 'done' : g.failed ? 'failed' : ''}`}>
      <span className="gmark" aria-hidden="true">{done ? '✓' : g.failed ? '✕' : ''}</span>
      <span className="grow"><b>{g.label}</b>
        {pr.of > 1 && !done && <span className="track" role="meter" aria-label={g.label} aria-valuenow={pr.now} aria-valuemin={0} aria-valuemax={pr.of}><i className="fill" style={{ width: `${(pr.now / pr.of) * 100}%` }} /></span>}
        <small>{done ? `Done ${fmtShort(wkDate(g.done!))}` : g.failed ? 'Missed' : pr.text}</small></span>
      <span className={`reward-chip ${done ? 'got' : ''}`}>{money(g.reward)}</span>
    </li>
  );
}
export function GoalsCard({ S, year = S.year, title }: { S: State; year?: number; title?: string }) {
  const gs = (S.u.goals ?? []).filter(g => g.year === year);
  if (!gs.length) return null;
  const n = gs.filter(g => g.done !== undefined).length;
  return (
    <section className="glass">
      <div className="sec-head"><h3>{title ?? `${year} goals`}</h3><small>{n} of {gs.length} met</small></div>
      <ul className="plain goals">{gs.map(g => <GoalRow key={g.id} S={S} g={g} />)}</ul>
      <p className="help">Each goal pays a small reward and a lift in confidence the week you reach it.</p>
    </section>
  );
}

// ---------- trophy cabinet ----------
const metal = (b: Band) => (b === 'GS' || b === 'F' ? 'gold' : b === 'T1000' || b === 'T500' ? 'silver' : 'bronze');
const ORDER: Band[] = ['GS', 'F', 'T1000', 'T500', 'T250', 'UL', 'SL', 'EP'];
function Cup({ m, size = 64 }: { m: string; size?: number }) {
  return (
    <svg className={`cup ${m}`} width={size} height={size * 1.15} viewBox="0 0 64 74" aria-hidden="true">
      <defs><linearGradient id={`cg-${m}`} x1="0" x2="1"><stop offset="0" stopColor="var(--c1)" /><stop offset=".5" stopColor="var(--c2)" /><stop offset="1" stopColor="var(--c1)" /></linearGradient></defs>
      <path d="M14 6h36v14c0 12-8 20-18 20S14 32 14 20z" fill={`url(#cg-${m})`} />
      <path d="M14 10H6c0 9 4 14 10 15M50 10h8c0 9-4 14-10 15" fill="none" stroke="var(--c1)" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="28" y="40" width="8" height="12" fill="var(--c1)" /><rect x="18" y="52" width="28" height="6" rx="2" fill={`url(#cg-${m})`} /><rect x="13" y="58" width="38" height="10" rx="2" fill="var(--c1)" />
    </svg>
  );
}
export function TrophyCabinet({ S }: { S: State }) {
  const { assets } = useApp(), u = S.u, [sort, setSortRaw] = useState<'best' | 'recent'>(() => (getSetting('trophySort', 'best') as 'best' | 'recent'));
  const setSort = (v: 'best' | 'recent') => { setSetting('trophySort', v); setSortRaw(v); };
  const titles = useMemo(() => u.tourneys.filter(t => t.title).sort((a, b) => sort === 'recent' ? b.wk - a.wk : ORDER.indexOf(a.band) - ORDER.indexOf(b.band) || b.wk - a.wk), [S, sort]);
  const slamOf = (t: UTourney) => S.cal.find(e => e.series === t.series)?.slam ?? (t.name.startsWith('Australian') ? 'ao' : t.name.startsWith('French') ? 'rg' : t.name === 'Wimbledon' ? 'wim' : t.name === 'US Open' ? 'uso' : undefined);
  const finals = u.tourneys.filter(t => t.final && !t.title && (t.band === 'GS' || t.band === 'F' || t.band === 'T1000')).length;
  return (
    <section className="sec">
      <div className="sec-head"><h3>Trophy cabinet</h3><small>{titles.length} {titles.length === 1 ? 'title' : 'titles'}{finals ? ` · ${finals} big finals lost` : ''}</small></div>
      {titles.length > 1 && <div className="seg small-seg" role="group" aria-label="Sort trophies"><button className={sort === 'best' ? 'on' : ''} aria-pressed={sort === 'best'} onClick={() => setSort('best')}>Biggest first</button><button className={sort === 'recent' ? 'on' : ''} aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>Most recent</button></div>}
      {titles.length ? <div className="cabinet">{titles.map(t => {
        const slam = t.band === 'GS' ? slamOf(t) : undefined, img = slam ? assets[`trophy:${slam}:${S.tour}`] : undefined;
        return (
          <button key={t.ed} className={`trophy-slot ${t.band === 'GS' ? 'major' : ''}`} onClick={() => set({ overlay: { kind: 'tourney', ed: t.ed } })} aria-label={`${t.name} ${t.year}`}>
            <span className="tr-art">{img ? <img src={img} alt="" /> : <Cup m={metal(t.band)} size={t.band === 'GS' ? 70 : 54} />}</span>
            <span className="tr-name"><EvName name={t.name} surface={t.surface} /></span>
            <small>{t.year} · {t.cat}</small>
          </button>);
      })}</div> : <div className="cabinet empty"><span className="trophy-slot ghost"><span className="tr-art"><Cup m="ghost" size={54} /></span><small>Your first title goes here</small></span></div>}
    </section>
  );
}

// ---------- news ----------
const NEWS_ICON: Record<News['kind'], string> = { champ: '🏆', rank: '▲', rival: '⚔', upset: '⚡', teen: '★', retire: '👋', yearEnd: '①', you: '●' };
export function NewsList({ items, S }: { items: News[]; S: State }) {
  return <ul className="news">{items.map((n, i) => <li key={i} className={`nw ${n.kind}`}><span className="ic" aria-hidden="true">{NEWS_ICON[n.kind]}</span><span className="grow">{n.text}</span><small>{fmtShort(wkDate(n.wk))}</small></li>)}</ul>;
}
export function NewsCard({ S }: { S: State }) {
  const all = S.world.news ?? [], from = S.lastSummary?.fromWk ?? 0;
  const items = useMemo(() => { const since = newsSince(S, from).filter(n => n.kind !== 'you'); return (since.length >= 3 ? since : all.filter(n => n.kind !== 'you')).slice(-7).reverse(); }, [S]);
  if (!items.length) return null;
  return <section className="glass"><div className="sec-head"><h3>Around the tour</h3><small>breaking news</small></div><NewsList S={S} items={items} /></section>;
}
export function NewsTicker({ S }: { S: State }) {
  const items = (S.world.news ?? []).slice(-10).reverse();
  if (items.length < 2) return null;
  const run = [...items, ...items];
  return (
    <div className="ticker" role="region" aria-label="Breaking news">
      <span className="tk-label">Breaking</span>
      <div className="tk-track"><div className="tk-run" aria-hidden="true">{run.map((n, i) => <span key={i} className={`tk ${n.kind}`}><i>{NEWS_ICON[n.kind]}</i>{n.text}</span>)}</div>
        <span className="sr">{items.map(n => n.text).join('. ')}</span></div>
    </div>
  );
}

// ---------- console-style watch controls ----------
export interface WatchKeys { toggle: () => void; next: () => void; back: () => void; end: () => void; summary: () => void; close: () => void }
export function useWatchControls(h: WatchKeys) {
  const ref = useRef(h); ref.current = h;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const c = ref.current;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); c.toggle(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); c.end(); }
      else if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); c.next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'j') { e.preventDefault(); c.back(); }
      else if (e.key === 'End' || e.key === 'e') { e.preventDefault(); c.end(); }
      else if (e.key === 's') { e.preventDefault(); c.summary(); }
    };
    document.addEventListener('keydown', k);
    // gamepad: A next, B back, X or Start play/pause, RB end of match, Y summary, d-pad left/right step
    let raf = 0, prev: boolean[] = [];
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [], gp = [...pads].find(Boolean);
      if (gp) {
        const b = gp.buttons.map(x => x.pressed), hit = (i: number) => b[i] && !prev[i], c = ref.current;
        if (hit(0) || hit(15)) c.next(); if (hit(1) || hit(14)) c.back(); if (hit(2) || hit(9)) c.toggle(); if (hit(5)) c.end(); if (hit(3)) c.summary();
        prev = b;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => { document.removeEventListener('keydown', k); cancelAnimationFrame(raf); };
  }, []);
}
