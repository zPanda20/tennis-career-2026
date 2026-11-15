import { useMemo } from 'react';
import { fillText } from '../core/agent';
import type { Priority, State } from '../core/types';
import { Avatar } from './bits';
import { Ring, SWING_SHORT } from './fx';
import { dispatch, useApp } from './store';
import { HomeBase, Housing, PeopleTime, Team } from './LifePlus';

const PRI: [Priority, string, string][] = [
  ['prep', 'Focused preparation', 'Most useful training. Morale can slowly dip under sustained pressure.'],
  ['recovery', 'Recovery', 'Faster recovery between events, less skill work.'],
  ['social', 'Social life', 'Friends, dinners, nights out. Morale rises; a little sharpness lost.'],
  ['relationship', 'Relationship time', 'Time with your partner and friends. Relationships deepen.'],
  ['professional', 'Professional commitments', 'Sponsor days and media. Reputation grows; costs training time.'],
];
const word = (v: number) => (v >= 75 ? 'Strong' : v >= 58 ? 'Good' : v >= 42 ? 'Steady' : v >= 25 ? 'Strained' : 'Distant');
const mood = (v: number) => (v >= 75 ? 'Loving life' : v >= 60 ? 'Happy' : v >= 45 ? 'Okay' : v >= 30 ? 'Low' : 'Struggling');

export function Life({ S }: { S: State }) {
  const u = S.u, me = S.players[S.userId], rel = u.rel as any, { save } = useApp(), ro = save === 'readonly' || S.phase === 'retired';
  const people = [
    { k: 'Coach', name: u.coach.name.split(' (')[0], v: u.rel.coach, note: 'Trust grows when you follow the plan and talk things through.' },
    { k: 'Agent', name: rel.agentName ?? 'Your agent', v: u.rel.agent, note: 'Your reputation in the game: sponsors and invitations follow it.' },
    { k: 'Best friend', name: rel.friendName ?? 'A close friend', v: u.rel.friend, note: 'Time at home and being there when it matters keep this strong.' },
    { k: 'Partner', name: u.rel.partner === null ? 'Single' : u.rel.partnerName ?? 'Your partner', v: u.rel.partner ?? 0, note: u.rel.partner === null ? 'Life events may introduce someone.' : 'Relationship time and travelling together help; long absences strain it.' },
  ];
  const history = useMemo(() => S.ledger.filter(e => e.type === 'BlockCommitted' && e.data?.priority).map(e => ({ year: e.data.year as number, block: e.data.block as number, pri: e.data.priority as Priority })), [S]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const h of history) c[h.pri] = (c[h.pri] ?? 0) + 1; return c; }, [history]);
  const setPri = (p: Priority) => dispatch({ type: 'ChangeDelegation', pol: { ...u.pol, priority: p } }, 'Saving');
  const pending = u.choices.filter(c => c.follow && !c.follow.done).length;
  return (
    <div>
      <section className="hero">
        <div>
          <span className="kicker">Off the court</span>
          <h1 className="mega"><span>Life on</span><span className="ol">tour</span></h1>
          <p className="lede">How {me.name.split(' ')[0]} is doing away from the matches: the people around you, how you spend your free time, and the choices that shape it.</p>
        </div>
        <div className="medal">
          <Ring value={me.morale / 100} size={260} stroke={16} warn={me.morale < 45} label={`Morale ${Math.round(me.morale)} out of 100, ${mood(me.morale)}`}>
            <span className="lbl">Morale</span><span className="big" style={{ fontSize: '4.8rem' }}>{Math.round(me.morale)}</span><span className={`delta ${me.morale < 45 ? 'down' : ''}`}>{mood(me.morale)}</span>
          </Ring>
        </div>
      </section>

      <div className="home-grid">
        <div className="col">
          <section className="glass">
            <div className="sec-head"><h3>Your people</h3></div>
            <div className="people">{people.map(p => (
              <div key={p.k} className="person">
                <Avatar name={p.name === 'Single' ? '?' : p.name} size={52} />
                <div className="grow">
                  <div className="row between" style={{ margin: 0 }}><span><small className="eyebrow" style={{ margin: 0 }}>{p.k}</small><br /><b>{p.name}</b></span>{(p.k !== 'Partner' || u.rel.partner !== null) && <span className={`pill ${p.v < 35 ? 'crit' : p.v >= 58 ? 'ok' : ''}`}>{word(p.v)}</span>}</div>
                  {(p.k !== 'Partner' || u.rel.partner !== null) && <div className="track" role="meter" aria-label={`${p.k}: ${word(p.v)}`} aria-valuenow={Math.round(p.v)} aria-valuemin={0} aria-valuemax={100}><i className={`fill ${p.v < 35 ? 'warn' : ''}`} style={{ width: `${p.v}%` }} /></div>}
                  <small>{p.note}</small>
                </div>
              </div>))}</div>
          </section>

          <PeopleTime S={S} ro={ro} />
          <section className="glass">
            <div className="sec-head"><h3>Decisions and consequences</h3>{pending > 0 && <small>{pending} may still come back</small>}</div>
            {u.choices.length ? <ul className="plain timeline">{u.choices.slice().reverse().map(c => (
              <li key={c.id}>
                <span className="num">{c.date.slice(0, 7)}</span> <b>{c.title}</b>{c.personal && <span className="tag">personal</span>}<br />
                <span>{c.label}.</span> <small>{c.fx}</small>
                {c.follow?.done && <p className="note story" style={{ marginTop: '.4rem' }}>{fillText(S, c.follow.text)}</p>}
                {c.follow && !c.follow.done && <small className="muted"> · this may come back later</small>}
              </li>))}</ul> : <p className="muted">No life decisions yet. One may come up when you plan each swing.</p>}
          </section>
        </div>

        <div className="col">
          <section className="glass">
            <div className="sec-head"><h3>Free time</h3><small>applies from the next swing</small></div>
            <div className="choice-grid" role="radiogroup" aria-label="How you spend time off court">
              {PRI.map(([k, t, d]) => <button key={k} role="radio" aria-checked={u.pol.priority === k} disabled={ro} className={`choice slim ${u.pol.priority === k ? 'on' : ''}`} onClick={() => setPri(k)}><b>{t}</b><span>{d}</span></button>)}
            </div>
          </section>
          <section className="glass">
            <div className="sec-head"><h3>How you've spent it</h3><small>{history.length} {history.length === 1 ? 'swing' : 'swings'}</small></div>
            {history.length ? <>
              <div className="stack">{PRI.filter(([k]) => counts[k]).map(([k, t]) => <div key={k} className="stack-row"><span>{t}</span><span className="track"><i className="fill" style={{ width: `${(counts[k] / history.length) * 100}%` }} /></span><b className="num">{counts[k]}</b></div>)}</div>
              <ul className="plain" style={{ marginTop: '.8rem' }}>{history.slice(-6).reverse().map((h, i) => <li key={i}><small>{h.year} · {SWING_SHORT[h.block].join(' ').toLowerCase()}</small> · {PRI.find(p => p[0] === h.pri)![1]}</li>)}</ul>
            </> : <p className="muted">Your choices appear here after each swing you plan.</p>}
          </section>
        </div>
      </div>
      <div className="manage-grid">
        <div className="col"><Team S={S} ro={ro} /></div>
        <div className="col"><HomeBase S={S} ro={ro} /><Housing S={S} ro={ro} /></div>
      </div>
    </div>
  );
}
