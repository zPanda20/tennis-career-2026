import { useEffect, useState } from 'react';
import { fmtDate, ageOn, wkDate } from '../core/content';
import { Avatar, EventLogo, rankTxt } from './bits';
import { Home, Planner } from './Career';
import { Create, Library } from './Start';
import { Calendar, MatchReport, PlayerCard, PlayerView, Records, Settings, TourneyHub, World } from './Views';
import { Tab, closeCareer, set, useApp } from './store';

const TABS: [Tab, string, string][] = [['career', 'Career', '◎'], ['calendar', 'Calendar', '▦'], ['player', 'Player', '☺'], ['world', 'World', '◍'], ['records', 'Records', '☰'], ['settings', 'Settings', '⚙']];
export function App() {
  const app = useApp(), { view, S, tab, overlay, busy, error, notice, save, reduced } = app, [menu, setMenu] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle('reduced', reduced); }, [reduced]);
  useEffect(() => { window.scrollTo(0, 0); setMenu(false); }, [tab, view]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {view === 'boot' && <main className="page narrow"><p className="muted">Loading…</p></main>}
      {view === 'library' && <Library />}
      {view === 'create' && <Create />}
      {view === 'game' && S && (() => {
        const me = S.players[S.userId];
        return (
          <div className="shell">
            <header className="top">
              <button className="idbtn" onClick={() => set({ tab: 'player' })} aria-label={`${me.name}, open player profile`}><Avatar p={me} size={40} user={S.u.avatar} /><span><b>{me.name}</b><small>{S.phase === 'retired' ? `Retired ${S.retire!.year}` : `${rankTxt(S.rank[me.id])} · age ${ageOn(me.born, wkDate(S.wk))} · ${fmtDate(wkDate(S.wk))}`}</small></span></button>
              <nav className="nav desk" aria-label="Main">{TABS.map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => set({ tab: k })}>{t}</button>)}</nav>
              <div className="top-right"><EventLogo tour={S.tour} size={26} /><span className={`save ${save}`} role="status">{save === 'saved' ? 'Saved' : save === 'saving' ? 'Saving…' : save === 'readonly' ? 'Read-only' : 'Not saved'}</span>
                <button className="btn small ghost mob" aria-expanded={menu} onClick={() => setMenu(!menu)}>Menu</button><button className="btn small ghost desk" onClick={closeCareer}>Careers</button></div>
              {menu && <div className="menu mob" role="menu"><button role="menuitem" onClick={() => set({ tab: 'records' })}>Records and review</button><button role="menuitem" onClick={() => set({ tab: 'settings' })}>Settings and backup</button><button role="menuitem" onClick={closeCareer}>Career library</button></div>}
            </header>
            {(error || notice) && <div className={error ? 'banner crit' : 'banner'} role={error ? 'alert' : 'status'}><span>{error ?? notice}</span><button className="icon" aria-label="Dismiss" onClick={() => set({ error: null, notice: null })}>✕</button></div>}
            <main id="main" className="page" tabIndex={-1}>
              {tab === 'career' && <Home S={S} />}
              {tab === 'calendar' && <Calendar S={S} />}
              {tab === 'player' && <PlayerView S={S} />}
              {tab === 'world' && <World S={S} />}
              {tab === 'records' && <Records S={S} />}
              {tab === 'settings' && <Settings S={S} />}
            </main>
            <nav className="nav mob bottom" aria-label="Main">{TABS.slice(0, 4).map(([k, t, i]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => set({ tab: k })}><span aria-hidden="true">{i}</span>{t}</button>)}</nav>
            {overlay?.kind === 'planner' && S.phase === 'plan' && <Planner S={S} />}
            {overlay?.kind === 'tourney' && <TourneyHub S={S} ed={overlay.ed} />}
            {overlay?.kind === 'match' && <MatchReport S={S} id={overlay.id} />}
            {overlay?.kind === 'player' && <PlayerCard S={S} id={overlay.id} />}
          </div>);
      })()}
      {view !== 'game' && (error || notice) && <div className={`banner float ${error ? 'crit' : ''}`} role={error ? 'alert' : 'status'}><span>{error ?? notice}</span><button className="icon" aria-label="Dismiss" onClick={() => set({ error: null, notice: null })}>✕</button></div>}
      {busy && <div className="busy" role="status" aria-live="polite"><div className="busy-card"><div className="ball" aria-hidden="true" /><p>{busy}</p></div></div>}
    </>
  );
}
