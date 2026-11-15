import { useEffect, useMemo, useState } from 'react';
import { ageOn, fmtDate, wkDate } from '../core/content';
import { COUNTRIES } from '../core/countries';
import type { State } from '../core/types';
import { countedOf } from '../core/world';
import { Avatar, Flag } from './bits';
import { set } from './store';

type Mode = 'rank' | 'race';
export function Rankings({ S }: { S: State }) {
  const [mode, setMode] = useState<Mode>('rank'), [limit, setLimit] = useState(100), [nat, setNat] = useState(''), [q, setQ] = useState(''), [jump, setJump] = useState(0);
  const T = S.tour === 'atp' ? 'ATP' : 'WTA', date = wkDate(S.wk), uid = S.userId;
  const base = useMemo(() => mode === 'rank' ? S.order.map(id => ({ id, pts: S.pts[id] ?? 0 })) : Object.entries(S.race).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id, pts]) => ({ id, pts })), [S, mode]);
  const nations = useMemo(() => [...new Set(S.order.map(id => S.players[id].country))].filter(c => COUNTRIES[c]).sort((a, b) => COUNTRIES[a].name.localeCompare(COUNTRIES[b].name)), [S]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return base.map((r, i) => ({ ...r, pos: i + 1 })).filter(r => (!nat || S.players[r.id]?.country === nat) && (!needle || S.players[r.id]?.name.toLowerCase().includes(needle)));
  }, [base, nat, q]);
  const shown = rows.slice(0, limit), mine = rows.find(r => r.id === uid);
  useEffect(() => { if (jump) document.getElementById('rk-me')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [jump]);
  const goMe = () => { if (mine) { setLimit(Math.max(limit, mine.pos + 10)); setJump(jump + 1); } };
  const top3 = mode === 'rank' && !nat && !q ? base.slice(0, 3) : [];
  return (
    <div>
      <span className="kicker">Published {fmtDate(date)} · {mode === 'rank' ? 'best 18 results of the last 52 weeks' : `points won in ${S.year}`}</span>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: '.6rem' }}>
        <h1>{T} {mode === 'rank' ? 'Rankings' : `Race ${S.year}`}</h1>
        <div className="seg" role="group" aria-label="Ranking type"><button className={mode === 'rank' ? 'on' : ''} aria-pressed={mode === 'rank'} onClick={() => setMode('rank')}>Rankings</button><button className={mode === 'race' ? 'on' : ''} aria-pressed={mode === 'race'} onClick={() => setMode('race')}>Race to the Finals</button></div>
      </div>

      {top3.length === 3 && <div className="podium">{top3.map((r, i) => { const p = S.players[r.id]; return (
        <button key={r.id} className={`pod p${i + 1}`} onClick={() => set({ overlay: { kind: 'player', id: r.id } })}>
          <span className="pod-n">{i + 1}</span><Avatar p={p} size={i === 0 ? 92 : 76} user={p.user ? S.u.avatar : undefined} />
          <span className="pod-name"><Flag c={p.country} size={20} /> {p.name}</span><span className="pod-pts">{r.pts.toLocaleString('en-US')} pts</span>
        </button>); })}</div>}

      <div className="rk-tools">
        <label className="grow">Find a player<input value={q} onChange={e => setQ(e.target.value)} placeholder="Name" /></label>
        <label>Nation<select value={nat} onChange={e => setNat(e.target.value)}><option value="">All nations</option>{nations.map(c => <option key={c} value={c}>{COUNTRIES[c].name}</option>)}</select></label>
        {mine ? <button className="btn" onClick={goMe}>Jump to me · No. {mine.pos}</button> : <span className="muted">{mode === 'race' ? 'No race points yet this season' : ''}</span>}
      </div>

      <div className="scroll glass rk-wrap" role="region" aria-label={`${T} ${mode === 'rank' ? 'rankings' : 'race'} table`} tabIndex={0}>
        <table className="tbl rk">
          <thead><tr><th className="r">Rank</th><th>Move</th><th>Player</th><th>Age</th><th>Nation</th><th className="r">Points</th>{mode === 'rank' && <th className="r">Events counted</th>}</tr></thead>
          <tbody>{shown.map(r => {
            const p = S.players[r.id]; if (!p) return null;
            const prev = S.blockStartRank?.[r.id], mv = mode === 'rank' && prev ? prev - r.pos : 0, me = r.id === uid;
            return (
              <tr key={r.id} id={me ? 'rk-me' : undefined} className={`${me ? 'me' : ''} ${mode === 'race' && r.pos === 8 ? 'cut' : ''}`}>
                <td className="r pos">{r.pos}</td>
                <td className={`mv ${mv > 0 ? 'up' : mv < 0 ? 'down' : ''}`}>{mode === 'rank' ? (prev ? (mv ? `${mv > 0 ? '▲' : '▼'} ${Math.abs(mv)}` : '–') : S.blockStartRank ? <small>new</small> : '–') : ''}</td>
                <td><button className="who" onClick={() => set({ overlay: { kind: 'player', id: r.id } })}><Avatar p={p} size={34} user={p.user ? S.u.avatar : undefined} /><span><b>{p.name}</b>{!p.real && !p.user && <span className="tag">fictional</span>}{p.user && <span className="pill ok">You</span>}</span></button></td>
                <td className="num">{ageOn(p.born, date)}</td>
                <td><Flag c={p.country} /> <small>{p.country}</small></td>
                <td className="r num pts">{r.pts.toLocaleString('en-US')}</td>
                {mode === 'rank' && <td className="r num">{Math.min(18, countedOf(p, S.wk).length)}</td>}
              </tr>);
          })}</tbody>
        </table>
        {!shown.length && <p className="muted" style={{ padding: '1rem' }}>No players match.</p>}
      </div>
      <div className="row">{limit < rows.length && <button className="btn" onClick={() => setLimit(limit + 100)}>Show 100 more</button>}<small>Movement compares with the start of the current or most recent swing. The top eight in the race qualify for the Tour Finals.</small></div>
    </div>
  );
}
