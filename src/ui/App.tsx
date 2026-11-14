import { useEffect, useState } from 'react';
import { fmtDate, ageOn, wkDate } from '../core/content';
import { Avatar, money, rankTxt } from './bits';
import { Home, Planner, Reveal } from './Career';
import { CourtBg, SeasonTrack, tintOf } from './fx';
import { Create, Library } from './Start';
import { Calendar, MatchReport, PlayerCard, PlayerView, Records, Settings, TourneyHub, World } from './Views';
import { Tab, closeCareer, set, useApp } from './store';

const TABS: [Tab, string][] = [['career', 'Career'], ['calendar', 'Calendar'], ['player', 'Player'], ['world', 'Tour'], ['records', 'Records']];
export function App() {
  const app = useApp(), { view, S, tab, overlay, busy, error, notice, save, reduced } = app, [menu, setMenu] = useState(false);
  const tint = view === 'game' ? tintOf(S) : 'clay';
  useEffect(() => { document.documentElement.classList.toggle('reduced', reduced); }, [reduced]);
  useEffect(() => { document.body.className = `s-${tint}`; }, [tint]);
  useEffect(() => { window.scrollTo(0, 0); setMenu(false); }, [tab, view]);
  const fullscreen = overlay?.kind === 'planner' || overlay?.kind === 'reveal';
  return (
    <div className={`stage s-${tint}`}>
      <CourtBg />
      <a className="skip" href="#main">Skip to content</a>
      {view === 'boot' && <main className="page landing"><div className="busy-card"><Bouncer /><p>Loading</p></div></main>}
      {view === 'library' && <Library />}
      {view === 'create' && <Create />}
      {view === 'game' && S && (() => {
        const me = S.players[S.userId];
        return (
          <>
            <header className="hud" aria-hidden={fullscreen || undefined}>
              <button className="crest" onClick={() => set({ tab: 'player' })} aria-label={`${me.name}, open player profile`}>
                <Avatar p={me} size={50} user={S.u.avatar} />
                <span><b>{me.name}</b><small>{me.country} · {S.phase === 'retired' ? `retired ${S.retire!.year}` : `age ${ageOn(me.born, wkDate(S.wk))} · ${rankTxt(S.rank[me.id])}`}</small></span>
              </button>
              <nav className="navpill" aria-label="Main">{TABS.map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => set({ tab: k })}>{t}</button>)}</nav>
              <div className="hud-right">
                <span className="chip money desk"><span className="coin" aria-hidden="true">$</span>{money(S.u.cash)}</span>
                <span className="chip desk">{fmtDate(wkDate(S.wk))}</span>
                <span className={`save ${save}`} role="status">{save === 'saved' ? 'Saved' : save === 'saving' ? 'Saving' : save === 'readonly' ? 'Read-only' : 'Not saved'}</span>
                <button className="icon" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h14M3 10h14M3 14h14" /></svg></button>
              </div>
              {menu && <div className="menu" role="menu"><button role="menuitem" onClick={() => { set({ tab: 'settings' }); setMenu(false); }}>Settings and backup</button><button role="menuitem" onClick={() => { set({ tab: 'records' }); setMenu(false); }}>Records and review</button><button role="menuitem" onClick={closeCareer}>Career library</button></div>}
            </header>
            {!fullscreen && <div className="trackwrap"><SeasonTrack S={S} /></div>}
            {(error || notice) && <div className={error ? 'banner crit' : 'banner'} role={error ? 'alert' : 'status'}><span>{error ?? notice}</span><button className="icon" aria-label="Dismiss" onClick={() => set({ error: null, notice: null })}>✕</button></div>}
            <main id="main" className="page" tabIndex={-1} aria-hidden={fullscreen || undefined}>
              {tab === 'career' && <Home S={S} />}
              {tab === 'calendar' && <Calendar S={S} />}
              {tab === 'player' && <PlayerView S={S} />}
              {tab === 'world' && <World S={S} />}
              {tab === 'records' && <Records S={S} />}
              {tab === 'settings' && <Settings S={S} />}
            </main>
            {!fullscreen && <nav className="bottomnav mob" aria-label="Main">{TABS.slice(0, 4).map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => set({ tab: k })}><i />{t}</button>)}</nav>}
            {overlay?.kind === 'planner' && S.phase === 'plan' && <Planner S={S} />}
            {overlay?.kind === 'reveal' && <Reveal S={S} />}
            {overlay?.kind === 'tourney' && <TourneyHub S={S} ed={overlay.ed} />}
            {overlay?.kind === 'match' && <MatchReport S={S} id={overlay.id} />}
            {overlay?.kind === 'player' && <PlayerCard S={S} id={overlay.id} />}
          </>);
      })()}
      {view !== 'game' && (error || notice) && <div className={`banner float ${error ? 'crit' : ''}`} role={error ? 'alert' : 'status'}><span>{error ?? notice}</span><button className="icon" aria-label="Dismiss" onClick={() => set({ error: null, notice: null })}>✕</button></div>}
      {busy && <div className="busy" role="status" aria-live="polite"><div className="busy-card"><Bouncer /><p>{busy}</p></div></div>}
    </div>
  );
}
export function Bouncer() {
  return <div className="bouncer" aria-hidden="true"><svg className="b" width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="var(--ball)" /><path d="M4.5 4.5c3.6 3.6 3.6 11.4 0 15M19.5 4.5c-3.6 3.6-3.6 11.4 0 15" fill="none" stroke="#fff" strokeWidth="1.8" /></svg><span className="sh" /></div>;
}
