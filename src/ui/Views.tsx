import { COACH_TIER_NAME } from '../core/world';
import { useMemo, useState } from 'react';
import { BAND_NAME, BAND_VAL, RULES_SUMMARY } from '../core/balance';
import { estimate } from '../core/agent';
import { SNAPSHOT_NOTE, ageOn, countryName, fmtDate, fmtShort, wkDate } from '../core/content';
import { h2h, legacy, notableWins, peakSnap, retireSnap, retrospective, roundName, totals } from '../core/selectors';
import { ABILITIES, ABILITY_NAMES, Ability, STYLE_NAMES, State, UMatch } from '../core/types';
import { strength } from '../core/world';
import { Avatar, Bar, BrandMark, EventLogo, Modal, Pill, Section, Stat, SurfaceTag, Who, money, rankTxt } from './bits';
import { clearPack, importPack } from './pack';
import { Momentum } from './fx';
import { EvName, Flag, portraitFromFile } from './bits';
import { dispatch, exportBackup, get, set, useApp } from './store';
import { RivalsSection, TrophyCabinet } from './Extras';
import { RIVAL_MEETINGS } from '../core/rivals';
import { exportArchive, exportPdf } from '../export/pdf';

const ABILITY_HELP: Record<Ability, string> = { serve: 'First and second serve effectiveness', ret: 'Neutralising serves and starting rallies', fh: 'Forehand rally control and finishing', bh: 'Backhand stability and attacking quality', net: 'Approach conversion and volleys', move: 'Court coverage and recovery between shots', end: 'Resistance to match fatigue', comp: 'Performance stability under pressure' };
const age = (S: State, born: string) => ageOn(born, wkDate(S.wk));

export function Calendar({ S }: { S: State }) {
  const [mode, setMode] = useState<'relevant' | 'main' | 'all'>('relevant'), u = S.u;
  const weeks = useMemo(() => {
    const map = new Map<number, typeof S.cal>();
    for (const e of S.cal) {
      const mine = u.tourneys.find(t => t.ed === e.id), est = !e.done && e.entryWk >= S.wk && e.band !== 'F' ? estimate(S, e) : null;
      if (mode === 'main' && BAND_VAL[e.band] < 250) continue;
      if (mode === 'relevant' && !mine && e.band !== 'GS' && (!est || est === 'unlikely')) continue;
      (map.get(e.startWk) ?? map.set(e.startWk, []).get(e.startWk)!).push(e);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [S, mode]);
  return (
    <div>
      <div className="row between"><h1>{S.year} calendar</h1>
        <div className="seg" role="group" aria-label="Which events to show">{([['relevant', 'For you'], ['main', 'Main tour'], ['all', 'Everything']] as const).map(([k, t]) => <button key={k} className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{t}</button>)}</div></div>
      <p className="muted">{S.year === 2026 ? 'Real 2026 events. Lower-tier entries from July onward marked "provisional" reuse first-half venues.' : 'Simulated calendar: the 2026 pattern carried forward, not a confirmed real-world schedule.'} Entry lists lock on the Monday ranking of the event's first week.</p>
      {weeks.map(([w, evs]) => (
        <section key={w} className={`agenda ${w < S.wk ? 'past' : ''}`}>
          <h3>{fmtShort(wkDate(w))}{w === S.wk ? <Pill tone="ok">This week</Pill> : null}</h3>
          <ul className="list">{evs.sort((a, b) => BAND_VAL[b.band] - BAND_VAL[a.band]).map(e => {
            const mine = u.tourneys.find(t => t.ed === e.id), est = !e.done && e.entryWk >= S.wk && e.band !== 'F' ? estimate(S, e) : null, champ = S.world.champs.find(c => c.ed === e.id);
            const inner = <>
              <span className="grow"><b><EvName name={e.name} surface={e.surface} /></b><small><Flag c={e.country} size={14} /> {e.cat} · {e.city}, {e.country} · {e.dates}{e.weeks === 2 ? ' · two weeks' : ''}{e.prov ? ' · provisional' : ''}</small></span>
              <SurfaceTag s={e.surface} indoor={e.indoor} />
              <span className="res">{mine ? (mine.reached && mine.reached !== 'WD' ? <Pill tone={mine.title ? 'ok' : ''}>{mine.title ? 'Champion' : roundName(mine.reached)}</Pill> : <Pill tone="warn">{mine.status === 'ALT' ? 'Not accepted' : mine.status === 'WD' ? 'Withdrew' : 'Entered'}</Pill>) : est ? <Pill tone={est === 'accepted' ? 'ok' : est === 'alternate' ? 'warn' : est === 'unlikely' ? 'crit' : ''}>{est}</Pill> : e.cancelled ? <small>Not held</small> : champ ? <small>Won by {S.players[champ.w]?.name}</small> : null}</span></>;
            return <li key={e.id}>{mine ? <button className="rowbtn" onClick={() => set({ overlay: { kind: 'tourney', ed: e.id } })}>{inner}</button> : <div className="rowbtn static">{inner}</div>}</li>;
          })}</ul>
        </section>))}
    </div>
  );
}

/** Ranking history on a log scale fitted to this player's own range, so a climb from 900 to 300 or from 12 to 1 reads equally clearly. */
export function RankChart({ S }: { S: State }) {
  const h = S.u.rankHist; if (h.length < 3) return null;
  const ranks = h.map(p => p.rank), best = Math.min(...ranks), worst = Math.max(...ranks), bi = ranks.indexOf(best);
  const lo = Math.log10(Math.max(1, best / 1.25)), hi = Math.log10(Math.max(best * 2, worst * 1.2)), W = 640, H = 200, top = 14, bot = H - 24;
  const ly = (r: number) => top + ((Math.log10(Math.max(1, r)) - lo) / (hi - lo)) * (bot - top);
  const x0 = h[0].wk, x1 = Math.max(h[h.length - 1].wk, x0 + 10), lx = (wk: number) => ((wk - x0) / (x1 - x0)) * (W - 56) + 46;
  const NICE = [1, 2, 3, 5, 10, 20, 30, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
  let ticks = NICE.filter(r => r >= 10 ** lo && r <= 10 ** hi); while (ticks.length > 6) ticks = ticks.filter((_, i) => i % 2 === 0);
  const step = Math.max(1, Math.floor(h.length / 320)), pts = h.filter((_, i) => i % step === 0 || i === h.length - 1).map(p => `${lx(p.wk).toFixed(1)},${ly(p.rank).toFixed(1)}`).join(' ');
  const years = Array.from({ length: Math.floor((x1 - x0) / 52) + 1 }, (_, i) => i).filter((_, i, a) => a.length < 12 || i % 2 === 0);
  const area = `${lx(h[0].wk)},${bot} ${pts} ${lx(h[h.length - 1].wk)},${bot}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Ranking history from ${h[0].rank} to ${h[h.length - 1].rank}, best ${best}`}>
      <defs><linearGradient id="rkfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--ball)" stopOpacity=".28" /><stop offset="1" stopColor="var(--ball)" stopOpacity="0" /></linearGradient></defs>
      {ticks.map(r => <g key={r}><line x1="46" x2={W - 10} y1={ly(r)} y2={ly(r)} className="grid" /><text x="40" y={ly(r) + 4} textAnchor="end">{r}</text></g>)}
      {years.map(i => <text key={i} x={lx(x0 + i * 52)} y={H - 4} className="yr">{2026 + i}</text>)}
      <polygon points={area} fill="url(#rkfill)" />
      <polyline points={pts} className="line" />
      <circle cx={lx(h[bi].wk)} cy={ly(best)} r="5" fill="var(--ball)" /><text x={Math.min(W - 60, lx(h[bi].wk) + 8)} y={Math.max(top + 10, ly(best) - 6)} className="best">best {best}</text>
    </svg>
  );
}

export function PlayerView({ S }: { S: State }) {
  const u = S.u, me = S.players[S.userId], t = useMemo(() => totals(S), [S]), sum = S.lastSummary, pk = peakSnap(S);
  const byCat = useMemo(() => { const m: Record<string, number> = {}; for (const l of u.ledger) m[l.cat] = (m[l.cat] ?? 0) + l.amt; return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [S]);
  return (
    <div className="grid-2">
      <div className="col">
        <div className="card idcard"><PortraitPicker S={S} /><div><h2 className="display">{me.name}</h2><p>{countryName(me.country)} · age {age(S, me.born)} · {me.hand === 'R' ? 'right-handed' : 'left-handed'} · {STYLE_NAMES[me.style].toLowerCase()}</p><p className="muted">{rankTxt(S.rank[me.id])} · {S.pts[me.id] ?? 0} points · career high {t.bestRank < 9999 ? t.bestRank : '–'}</p></div></div>
        <Section title="Abilities" aside={<small>1 to 100 · change over the last block</small>}>
          {ABILITIES.map(a => <div key={a}><Bar label={ABILITY_NAMES[a]} value={me.ab[a]} delta={sum?.dev[a]} /><p className="help">{ABILITY_HELP[a]}{u.injuries.some(i => i.perm?.some(p => p.ab === a)) ? ' · permanently reduced by injury' : ''}</p></div>)}
          <p className="muted">Started at {ABILITIES.map(a => `${ABILITY_NAMES[a]} ${Math.round(u.startAb[a])}`).join(', ')}.{pk ? ` Best overall level so far: ${pk.date.slice(0, 4)}, aged ${pk.age}.` : ''}</p>
        </Section>
        <Section title="Surface familiarity"><Bar label="Hard" value={me.fam.hard} tone="hard" /><Bar label="Clay" value={me.fam.clay} tone="clay" /><Bar label="Grass" value={me.fam.grass} tone="grass" /><p className="help">Comfort on a surface: a small performance adjustment that grows with matches and surface preparation.</p></Section>
        <Section title="Ranking history"><RankChart S={S} /></Section>
        <RivalsSection S={S} />
      </div>
      <div className="col">
        <TrophyCabinet S={S} />
        <Section title="Career record" aside={<small>simulated career only</small>}>
          <div className="stats"><Stat k="Played matches" v={`${t.w}–${t.l}`} sub={`walkovers ${t.woW} received, ${t.woL} given`} /><Stat k="Titles" v={t.titles} sub={`${t.majors} major · ${t.tourTitles - t.majors} other main tour · ${t.lowerTitles} lower tour`} /><Stat k="Runner-up" v={t.runnerUps} /><Stat k="Prize money" v={money(t.prize)} /><Stat k="Main draw" v={`${t.mdW}–${t.mdL}`} /><Stat k="Qualifying" v={`${t.qualW}–${t.qualL}`} /><Stat k="Hard" v={`${t.bySurface.hard.w}–${t.bySurface.hard.l}`} /><Stat k="Clay" v={`${t.bySurface.clay.w}–${t.bySurface.clay.l}`} /><Stat k="Grass" v={`${t.bySurface.grass.w}–${t.bySurface.grass.l}`} /><Stat k="Weeks at No. 1" v={t.weeksNo1} /></div>
          <p className="muted">Started on 1 January 2026 ranked {u.startRank} with background points from before the career. Those are starting history, not simulated-career results.</p>
        </Section>
        {u.seasons.length > 0 && <Section title="Seasons"><SeasonTable S={S} /></Section>}
        <Section title="Team and contracts">
          <p><b>Coach:</b> {u.coach.name} · {COACH_TIER_NAME[u.coach.tier]} tier · since {u.coach.since} · {money(u.coach.cost)} a month · trust {Math.round(u.rel.coach)}/100</p>
          {u.sponsors.length ? u.sponsors.map(s => <p key={s.id}><BrandMark sp={s} /> <small>{s.slot} · {money(s.monthly)} a month · through {s.until - 1}</small></p>) : <p className="muted">No sponsorship contracts yet. Offers arrive at the year-end review as results and ranking improve.</p>}
        </Section>
        <Section title="Health">{u.injuries.length ? <ul className="plain">{u.injuries.slice().reverse().slice(0, 8).map(i => <li key={i.id}><b>{i.date}</b> · {i.sev} {i.loc} · {i.weeks} {i.weeks === 1 ? 'week' : 'weeks'} out{i.perm ? ` · lasting loss: ${i.perm.map(p => `${ABILITY_NAMES[p.ab]} −${p.loss}`).join(', ')}` : ''}</li>)}</ul> : <p className="muted">No injuries recorded.</p>}</Section>
        <Section title="Finances" aside={<small>career dollars, a simplified economy</small>}>
          <div className="stats"><Stat k="Cash" v={money(u.cash)} /></div>
          <table className="tbl"><caption className="sr">Career income and spending by category</caption><tbody>{byCat.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num r">{money(v)}</td></tr>)}</tbody></table>
        </Section>
      </div>
    </div>
  );
}
export function SeasonTable({ S }: { S: State }) {
  return <div className="scroll" role="region" aria-label="Season by season table" tabIndex={0}><table className="tbl"><thead><tr><th>Year</th><th>Age</th><th className="r">Rank</th><th className="r">Best</th><th className="r">Points</th><th>W–L</th><th className="r">Titles</th><th>Best major</th><th className="r">Prize</th><th className="r">Inj. wks</th></tr></thead>
    <tbody>{S.u.seasons.map(s => <tr key={s.year}><td>{s.year}</td><td>{s.age}</td><td className="r num">{s.rank}{s.no1 ? ' ★' : ''}</td><td className="r num">{s.bestRank}</td><td className="r num">{s.pts}</td><td className="num">{s.w}–{s.l}</td><td className="r num">{s.titles}</td><td>{roundName(s.majorsBest)}</td><td className="r num">{money(s.prize)}</td><td className="r num">{s.injWeeks}</td></tr>)}</tbody></table></div>;
}

export function World({ S }: { S: State }) {
  const [tab, setTab] = useState<'rank' | 'race' | 'champs' | 'rivals' | 'find'>('champs'), [n, setN] = useState(50), [q, setQ] = useState('');
  const race = useMemo(() => Object.entries(S.race).sort((a, b) => b[1] - a[1]).slice(0, 60), [S]), riv = useMemo(() => h2h(S), [S]);
  const found = useMemo(() => (q.trim().length < 2 ? [] : Object.values(S.players).filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40)), [S, q]);
  return (
    <div>
      <div className="row between"><h1>{S.tour === 'atp' ? "Men's" : "Women's"} tour</h1><div className="seg wrap" role="group" aria-label="World view">{([['champs', 'Champions'], ['rivals', 'Head to head'], ['find', 'Find a player']] as const).map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}</div></div>
      {tab === 'rank' && <><p className="muted">Published {fmtDate(wkDate(S.wk))}. Best 18 results of the last 52 weeks.</p>
        <ol className="list rank">{S.order.slice(0, n).map((id, i) => <li key={id} className={id === S.userId ? 'me' : ''}><span className="pos num">{i + 1}</span><Who S={S} id={id} sub={`age ${age(S, S.players[id].born)}`} /><span className="num pts">{S.pts[id].toLocaleString('en-US')}</span></li>)}</ol>
        <div className="row">{n < S.order.length && <button className="btn" onClick={() => setN(n + 100)}>Show more</button>}{S.rank[S.userId] > n && <button className="btn ghost" onClick={() => setN(Math.ceil(S.rank[S.userId] / 50) * 50)}>Show down to my ranking</button>}</div></>}
      {tab === 'race' && <><p className="muted">Points earned in {S.year}. The top eight qualify for the Tour Finals.</p><ol className="list rank">{race.map(([id, pts], i) => <li key={id} className={`${id === S.userId ? 'me' : ''} ${i === 7 ? 'cut' : ''}`}><span className="pos num">{i + 1}</span><Who S={S} id={id} /><span className="num pts">{pts.toLocaleString('en-US')}</span></li>)}</ol>{!race.length && <p className="muted">No results yet this season.</p>}</>}
      {tab === 'champs' && <Champions S={S} />}
      {tab === 'rivals' && (riv.length ? <div className="glass list-glass">{riv.slice(0, 80).map(r => <div key={r.opp} className="h2h-row">{S.players[r.opp] ? <Who S={S} id={r.opp} rank={S.rank[r.opp]} sub={<>last met {r.last}{S.u.rivals.includes(r.opp) && <span className="tag rival">rival</span>}</>} /> : <span className="grow"><b>{r.name}</b></span>}{r.w + r.l >= RIVAL_MEETINGS && S.players[r.opp] && <button className="btn small" onClick={() => set({ overlay: { kind: 'rival', id: r.opp } })}>Rival card</button>}<span className={`pts ${r.w > r.l ? 'up' : ''}`}>{r.w}–{r.l}</span></div>)}</div> : <p className="muted">No played matches yet. Walkovers never count toward head-to-head records.</p>)}
      {tab === 'find' && <><label className="search">Search players, including retired ones<input value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name" /></label>{found.length > 0 && <div className="glass list-glass">{found.map(p => <div key={p.id} className="h2h-row"><Who S={S} id={p.id} rank={S.rank[p.id]} sub={p.retired ? `retired ${p.retired}` : `${p.titles} titles since 2026`} /></div>)}</div>}</>}
    </div>
  );
}

const LEVELS: [string, string, (b: string) => boolean][] = [['big', 'Majors and Masters', b => ['GS', 'F', 'T1000'].includes(b)], ['tour', 'All tour events', b => BAND_VAL[b as keyof typeof BAND_VAL] >= 250], ['all', 'Every level', () => true]];
function Champions({ S }: { S: State }) {
  const [lv, setLv] = useState('tour'), years = [...new Set(S.world.champs.map(c => c.year))].sort((a, b) => b - a), [yr, setYr] = useState(years[0] ?? S.year);
  const f = LEVELS.find(l => l[0] === lv)![2], rows = S.world.champs.filter(c => c.year === yr && f(c.band)).slice().reverse();
  if (!S.world.champs.length) return <p className="muted">No tournaments completed yet.</p>;
  return (
    <>
      <div className="tour-tools">
        <label>Season<select value={yr} onChange={e => setYr(Number(e.target.value))}>{years.map(y => <option key={y}>{y}</option>)}</select></label>
        <div className="seg small-seg" role="group" aria-label="Event level" style={{ margin: 0 }}>{LEVELS.map(([k, t]) => <button key={k} className={lv === k ? 'on' : ''} aria-pressed={lv === k} onClick={() => setLv(k)}>{t}</button>)}</div>
      </div>
      <div className="glass list-glass">{rows.map(c => { const ed = S.cal.find(e => e.id === c.ed) ?? S.cal.find(e => e.name === c.name); return (
        <div key={c.ed} className={`champ-row ${c.band === 'GS' ? 'gs' : ''}`}>
          <span className="ev"><b>{ed ? <EvName name={c.name} surface={ed.surface} /> : c.name}</b>{c.w === S.userId && <span className="pill ok">You</span>}<small>{c.cat}</small></span>
          <Who S={S} id={c.w} sub={c.f ? `beat ${S.players[c.f]?.name ?? 'unknown'}` : undefined} />
        </div>); })}
        {!rows.length && <p className="muted" style={{ padding: '1rem' }}>No champions at this level in {yr}.</p>}</div>
    </>
  );
}

export function PlayerCard({ S, id }: { S: State; id: string }) {
  const p = S.players[id], ms = S.u.matches.filter(m => m.opp === id), w = ms.filter(m => m.won && m.cls !== 'wo').length, l = ms.filter(m => !m.won && m.cls !== 'wo').length;
  if (!p) return null;
  return (
    <Modal title={p.name} onClose={() => set({ overlay: null })}>
      <div className="idcard"><Avatar p={p} size={84} user={p.user ? S.u.avatar : undefined} /><div><p>{countryName(p.country)} · {p.retired ? `retired after ${p.retired}` : `age ${age(S, p.born)}`} · {p.hand === 'R' ? 'right-handed' : 'left-handed'} · {STYLE_NAMES[p.style].toLowerCase()}</p>
        <p className="muted">{p.retired ? '' : `${rankTxt(S.rank[id])} · `}career high {p.bestRank < 9999 ? p.bestRank : '–'} · {p.titles} titles since 2026{p.majors ? `, ${p.majors} majors` : ''}</p>
        {!p.real && !p.user && <Pill>Fictional player generated for this world</Pill>}{!p.retired && p.injuredUntil > S.wk && <Pill tone="warn">Currently unavailable</Pill>}</div></div>
      <Section title="Abilities" aside={<small>{p.real ? 'authored game estimates, not measurements' : p.user ? '' : 'generated'}</small>}><div className="mini-ab">{ABILITIES.map(a => <Stat key={a} k={ABILITY_NAMES[a]} v={Math.round(p.ab[a])} />)}</div></Section>
      {!p.user && w + l >= RIVAL_MEETINGS && <button className="btn rival-open" onClick={() => set({ overlay: { kind: 'rival', id } })}>⚔ {S.u.rivals.includes(id) ? 'Rival card' : 'Open rival card'}</button>}
      {!p.user && <Section title={`Your record: ${w}–${l}`}>{ms.length ? <ul className="list">{ms.slice().reverse().map(m => <li key={m.id}><button className="rowbtn" onClick={() => set({ overlay: { kind: 'match', id: m.id } })}><span className="grow"><b>{m.won ? 'Won' : 'Lost'} {m.score}</b><small>{S.u.tourneys.find(t => t.ed === m.ed)?.name} {m.year} · {roundName(m.round)}</small></span></button></li>)}</ul> : <p className="muted">You have not played each other.</p>}</Section>}
    </Modal>
  );
}

export function TourneyHub({ S, ed }: { S: State; ed: string }) {
  const u = S.u, t = u.tourneys.find(x => x.ed === ed), [draw, setDraw] = useState(false), { assets } = useApp();
  if (!t) return null;
  const ms = t.matches.map(id => u.matches.find(m => m.id === id)!).filter(Boolean), slam = S.cal.find(e => e.series === t.series)?.slam, trophy = t.title && slam ? assets[`trophy:${slam}:${S.tour}`] : null;
  const rounds = t.log ? [...new Set(t.log.map(m => m.r))] : [];
  return (
    <Modal title={`${t.name} ${t.year}`} onClose={() => set({ overlay: null })} wide>
      <div className="row between"><div><p>{t.cat} · {t.city}, {t.country} · {t.dates}{t.prov ? ' · provisional calendar entry' : ''}</p><SurfaceTag s={t.surface} /></div><EventLogo slam={slam} tour={S.tour} size={52} /></div>
      <div className="stats"><Stat k="Entry" v={t.status === 'MD' ? 'Main draw' : t.status === 'WC' ? 'Wildcard' : t.status === 'Q' ? (t.qualified ? 'Qualified' : 'Qualifying') : t.status === 'ALT' ? 'Not accepted' : 'Withdrew'} sub={t.via} /><Stat k="Result" v={t.title ? 'Champion' : roundName(t.reached)} /><Stat k="Ranking points" v={t.pts} /><Stat k="Prize" v={money(t.prize)} sub={`trip cost ${money(t.cost)}`} /></div>
      {trophy && <img className="trophy" src={trophy} alt="" />}
      {t.note && <p className="note">{t.note}</p>}
      {ms.length > 0 && <Section title="Your matches"><ul className="list">{ms.map(m => <li key={m.id}><button className="rowbtn" onClick={() => set({ overlay: { kind: 'match', id: m.id } })}><span className="grow"><b>{roundName(m.round)}: {m.won ? 'beat' : 'lost to'} {m.oppName}</b><small>ranked {m.oppRank} at entry{m.oppReal ? '' : ' · fictional'}</small></span><span className="num score">{m.score}</span></button></li>)}</ul></Section>}
      {t.champion && !t.title && <p className="muted">Champion: {t.champion}</p>}
      {t.log && t.log.length > 0 && <><button className="btn small" aria-expanded={draw} onClick={() => setDraw(!draw)}>{draw ? 'Hide' : 'Show'} the full main draw</button>
        {draw && rounds.map(r => <Section key={r} title={roundName(r)}><ul className="plain draw">{t.log!.filter(m => m.r === r).map((m, i) => <li key={i} className={m.a === S.userId || m.b === S.userId ? 'me' : ''}><b>{S.players[m.w]?.name ?? '?'}</b> d. {S.players[m.w === m.a ? m.b! : m.a]?.name ?? '?'} <span className="num">{m.s}</span></li>)}</ul></Section>)}</>}
    </Modal>
  );
}
export function MatchReport({ S, id }: { S: State; id: string }) {
  const m = S.u.matches.find(x => x.id === id) as UMatch | undefined, me = S.players[S.userId];
  if (!m) return null;
  const t = S.u.tourneys.find(x => x.ed === m.ed), a = m.stats?.[0], b = m.stats?.[1], pc = (x: number, y: number) => (y ? `${Math.round((x / y) * 100)}%` : '–');
  return (
    <Modal title={`${roundName(m.round)} · ${t?.name ?? ''} ${m.year}`} onClose={() => set({ overlay: t ? { kind: 'tourney', ed: t.ed } : null })}>
      <p className="scoreline display" aria-label={`${m.won ? 'Won' : 'Lost'} ${m.score}`}><span className={m.won ? 'win' : 'loss'}>{m.won ? 'Won' : 'Lost'}</span> {m.score}</p>
      <p>{me.name} ({m.myRank}) v {m.oppName} ({m.oppRank}){m.oppReal ? '' : ', a fictional player'} · {m.surface} · {m.cls === 'wo' ? 'walkover, not a played match' : `${Math.floor(m.minutes / 60)}h ${String(m.minutes % 60).padStart(2, '0')}m (estimated)`}{m.cls === 'ret' ? ' · ended by retirement' : ''}</p>
      <ul className="plain reasons">{m.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      {a && b && <table className="tbl stats-tbl"><caption className="sr">Match statistics</caption><thead><tr><th>{me.name.split(' ').pop()}</th><th></th><th>{m.oppName.split(' ').pop()}</th></tr></thead><tbody>
        {[['Aces', a.aces, b.aces], ['Double faults', a.df, b.df], ['First serves in', pc(a.fsIn, a.fsTot), pc(b.fsIn, b.fsTot)], ['First-serve points won', pc(a.fsWon, a.fsIn), pc(b.fsWon, b.fsIn)], ['Second-serve points won', pc(a.ssWon, a.ssTot), pc(b.ssWon, b.ssTot)], ['Return points won', pc(a.retWon, b.fsTot), pc(b.retWon, a.fsTot)], ['Break points won', `${a.bpWon}/${a.bpTot}`, `${b.bpWon}/${b.bpTot}`], ['Total points', a.pts, b.pts]].map(([k, x, y]) => <tr key={k as string}><td className="num">{x}</td><td className="c">{k}</td><td className="num r">{y}</td></tr>)}</tbody></table>}
      {m.flow && <div className="glass" style={{ marginTop: '1rem' }}><Momentum m={m} oppName={m.oppName} /></div>}
      {m.turning.length > 0 && <p className="muted">Key moments: {m.turning.join(' · ')}.</p>}
      {m.cls !== 'wo' && <p className="muted">Before the match you were {m.p < 0.35 ? 'the underdog' : m.p > 0.65 ? 'the favourite' : 'evenly matched'}. {m.p > 0.25 && m.p < 0.75 ? 'Matches like this are where most development comes from.' : m.p >= 0.75 ? 'Easy wins help confidence and earnings more than skill.' : 'A heavy mismatch teaches a little, but not efficiently.'} Fatigue from this match: +{Math.round(m.fat)}.</p>}
    </Modal>
  );
}

export function Records({ S }: { S: State }) {
  const u = S.u, me = S.players[S.userId], t = useMemo(() => totals(S), [S]), leg = useMemo(() => legacy(S), [S]), retired = S.phase === 'retired';
  const [redact, setRedact] = useState(false), [all, setAll] = useState(false), [busy, setBusy] = useState('');
  const retro = useMemo(() => retrospective(S, redact), [S, redact]), pk = peakSnap(S), rs = retireSnap(S), riv = h2h(S).slice(0, 8), wins = notableWins(S, 8);
  const timeline = useMemo(() => [...u.ach.map(a => ({ d: a.date, t: a.name })), ...u.injuries.filter(i => i.sev !== 'minor').map(i => ({ d: i.date, t: `${i.sev[0].toUpperCase() + i.sev.slice(1)} ${i.loc} injury (${i.weeks} weeks out)` })), ...u.coachHistory.filter(c => c.left).map(c => ({ d: `${c.left}-12-31`, t: `Coaching change: ${c.name.split(' (')[0]} (${c.since}–${c.left})` }))].sort((a, b) => (a.d < b.d ? -1 : 1)), [S]);
  const majors = u.tourneys.filter(x => x.band === 'GS' && x.reached && x.reached !== 'WD');
  const run = async (label: string, f: () => Promise<void>) => { setBusy(label); try { await f(); } catch (e: any) { set({ error: `Export failed: ${e.message}. Your career is unaffected; try again.` }); } setBusy(''); };
  return (
    <div className="records">
      <div className="card hero-rec">
        <Avatar p={me} size={96} user={u.avatar} />
        <div><p className="eyebrow">{retired ? `Career review · ${u.seasons[0]?.year ?? 2026}–${S.retire!.year}` : 'Career so far'}</p><h2 className="display">{me.name}</h2>
          <p>{countryName(me.country)} · {S.tour === 'atp' ? "men's" : "women's"} tour · {me.hand === 'R' ? 'right-handed' : 'left-handed'} · {u.focusSurface === 'all' ? 'all-round' : u.focusSurface + '-court'} focus · profile: {u.profileSelected ? `${{ goat: 'GOAT Contention', contender: 'Contender', grinder: 'Grinder' }[u.profile]} (selected)` : retired ? `Unknown Prospect (drawn: ${{ goat: 'GOAT Contention', contender: 'Contender', grinder: 'Grinder' }[u.profile]})` : 'Unknown Prospect'}</p>
          <p className="legacy">{leg.label}</p><p className="muted">{leg.reasons.join(' · ')}</p></div>
      </div>
      <div className="stats wide"><Stat k="Career high" v={t.bestRank < 9999 ? t.bestRank : '–'} sub={t.bestRankDate} /><Stat k="Major titles" v={t.majors} /><Stat k="Titles" v={t.titles} sub={`${t.tourTitles} main tour · ${t.lowerTitles} lower`} /><Stat k="Played matches" v={`${t.w}–${t.l}`} /><Stat k="Weeks at No. 1" v={t.weeksNo1} /><Stat k="Prize money" v={money(t.prize)} /></div>
      {retired && <Section title="Retrospective">{retro.map((p, i) => <p key={i} className="story">{p}</p>)}<p className="muted">Assembled from recorded events only. Retired {S.retire!.date} ({S.retire!.reason}).</p></Section>}
      {retired && <Section title="Save your career">
        <label className="check"><input type="checkbox" checked={redact} onChange={e => setRedact(e.target.checked)} /><span>Leave personal-life details out of the exports <small>The files will state that they are redacted. Your private record here keeps everything.</small></span></label>
        <p className="muted">The PDF contains this overview followed by every season, tournament, match and head-to-head record. The archive is a versioned JSON file with the complete career ledger{redact ? ', minus personal-life choices' : ''}.</p>
        <div className="row"><button className="btn primary" disabled={!!busy} onClick={() => run('pdf', () => exportPdf(S, redact))}>{busy === 'pdf' ? 'Building PDF…' : 'Save review as PDF'}</button><button className="btn" disabled={!!busy} onClick={() => run('json', () => exportArchive(S, redact))}>{busy === 'json' ? 'Saving…' : 'Save career archive (JSON)'}</button></div>
      </Section>}
      <Section title="Seasons">{u.seasons.length ? <SeasonTable S={S} /> : <p className="muted">The first season is still in progress.</p>}</Section>
      <Section title="Ranking history"><RankChart S={S} /></Section>
      <Section title="Abilities" aside={<small>start{pk ? ` · peak (${pk.date.slice(0, 4)}, age ${pk.age})` : ''}{rs ? ' · retirement' : ' · now'}</small>}>
        <table className="tbl"><thead><tr><th>Ability</th><th className="r">Start</th>{pk && <th className="r">Peak</th>}<th className="r">{rs ? 'Final' : 'Now'}</th></tr></thead><tbody>{ABILITIES.map(a => <tr key={a}><td>{ABILITY_NAMES[a]}</td><td className="r num">{Math.round(u.startAb[a])}</td>{pk && <td className="r num">{Math.round(pk.ab[a])}</td>}<td className="r num">{Math.round((rs ?? me).ab[a])}</td></tr>)}</tbody></table>
        <p className="muted">The peak is one complete snapshot from a single real date in the career, never a mix of best values from different ages. Temporary condition is not part of it.</p>
      </Section>
      <Section title="Majors">{majors.length ? <ul className="plain">{majors.map(m => <li key={m.ed}><button className="link" onClick={() => set({ overlay: { kind: 'tourney', ed: m.ed } })}>{m.name} {m.year}</button>: {m.title ? <b>Champion</b> : roundName(m.reached)}</li>)}</ul> : <p className="muted">No major appearances.</p>}</Section>
      <div className="grid-2"><Section title="Most frequent opponents">{riv.length ? <ul className="list">{riv.map(r => <li key={r.opp} className="rowbtn static">{S.players[r.opp] ? <Who S={S} id={r.opp} /> : <b className="grow">{r.name}</b>}<span className="num pts">{r.w}–{r.l}</span></li>)}</ul> : <p className="muted">None yet.</p>}</Section>
        <Section title="Notable wins" aside={<small>opponent's ranking at the time</small>}>{wins.length ? <ul className="plain">{wins.map(m => <li key={m.id}><button className="link" onClick={() => set({ overlay: { kind: 'match', id: m.id } })}>{m.oppName} ({m.oppRank})</button> · {u.tourneys.find(x => x.ed === m.ed)?.name} {m.year}, {roundName(m.round).toLowerCase()}</li>)}</ul> : <p className="muted">None yet.</p>}</Section></div>
      <Section title="Timeline">{timeline.length ? <ul className="plain timeline">{timeline.map((e, i) => <li key={i}><span className="num">{e.d.slice(0, 7)}</span> {e.t}</li>)}</ul> : <p className="muted">Milestones will appear here.</p>}</Section>
      <Section title="Decisions and consequences">{u.choices.filter(c => !redact || !c.personal).length ? <ul className="plain">{u.choices.filter(c => !redact || !c.personal).map(c => <li key={c.id}><b>{c.date.slice(0, 7)} · {c.title}:</b> {c.label}. <small>{c.fx}{c.follow ? (c.follow.done ? ' · had a later consequence' : ' · consequence pending') : ''}</small></li>)}</ul> : <p className="muted">No decisions recorded{redact ? ' outside personal life' : ''}.</p>}</Section>
      <div className="grid-2"><Section title="Coaching history"><ul className="plain">{[...u.coachHistory, ...(retired ? [] : [u.coach])].map((c, i) => <li key={i}>{c.name} · {c.tier} · {c.since}–{(c as any).left ?? 'now'}</li>)}</ul></Section>
        <Section title="Sponsorship history">{u.sponsorHistory.length ? <ul className="plain">{u.sponsorHistory.map(s => <li key={s.id}><BrandMark sp={s} size={20} /> <small>{s.slot} · {s.since}–{s.until - 1}</small></li>)}</ul> : <p className="muted">None.</p>}</Section></div>
      <Section title={`Every tournament (${u.tourneys.length})`} aside={<button className="btn small" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Hide' : 'Show'}</button>}>
        {all && <div className="scroll" role="region" aria-label="All tournaments table" tabIndex={0}><table className="tbl"><thead><tr><th>Year</th><th>Tournament</th><th>Level</th><th>Entry</th><th>Result</th><th className="r">Pts</th><th className="r">Prize</th></tr></thead><tbody>{u.tourneys.map(x => <tr key={x.ed}><td>{x.year}</td><td><button className="link" style={{ textDecoration: 'none' }} onClick={() => set({ overlay: { kind: 'tourney', ed: x.ed } })}><EvName name={x.name} surface={x.surface} /></button></td><td>{BAND_NAME[x.band]}</td><td>{x.status}</td><td>{x.title ? 'Champion' : roundName(x.reached)}</td><td className="r num">{x.pts}</td><td className="r num">{money(x.prize)}</td></tr>)}</tbody></table></div>}
      </Section>
    </div>
  );
}

export function Settings({ S }: { S: State }) {
  const { assets, reduced, save } = useApp(), u = S.u, n = Object.keys(assets).length, [msg, setMsg] = useState(''), ro = save === 'readonly';
  const pol = (p: Partial<typeof u.pol>) => dispatch({ type: 'ChangeDelegation', pol: { ...u.pol, ...p } }, 'Saving…');
  return (
    <div className="narrow">
      <h1>Settings</h1>
      <Section title="Play">
        <fieldset disabled={ro || S.phase === 'retired'}><legend>Detail</legend><div className="seg">{(['quick', 'detailed'] as const).map(d => <button key={d} className={u.pol.detail === d ? 'on' : ''} aria-pressed={u.pol.detail === d} onClick={() => pol({ detail: d })}>{d === 'quick' ? 'Quick play' : 'Detailed play'}</button>)}</div><p className="muted">Applies to future decisions only. Switching never changes past results, cash or odds.</p></fieldset>
        <label className="check"><input type="checkbox" disabled={ro || S.phase === 'retired'} checked={u.pol.adult} onChange={e => pol({ adult: e.target.checked })} /><span>Adult themes in life events</span></label>
        <label className="check"><input type="checkbox" checked={reduced} onChange={e => { localStorage.setItem('tc26:reduced', e.target.checked ? '1' : '0'); set({ reduced: e.target.checked }); }} /><span>Reduce motion</span></label>
      </Section>
      <Section title="Private image pack">
        <p>Player photos and logos are not part of the game. If you keep your own images in a folder with an <code>image-pack.json</code> file, you can load them here. They are stored in this browser only and never uploaded.</p>
        <p className="muted">{n ? `${n} images loaded.` : 'No image pack loaded.'} {msg}</p>
        <div className="row"><label className="btn">Load image pack folder<input type="file" hidden multiple {...({ webkitdirectory: '', directory: '' } as any)} onChange={async e => { const f = e.target.files; if (f?.length) { setMsg('Reading images…'); setMsg(await importPack(f)); } e.target.value = ''; }} /></label>{n > 0 && <button className="btn ghost" onClick={async () => { await clearPack(); setMsg('Image pack removed.'); }}>Remove images</button>}</div>
      </Section>
      <Section title="Backup"><p>Browser storage can be cleared or evicted. A backup file is your durable copy{S.phase === 'retired' ? '; for a retired career, use the archive export in Records' : ''}.</p><div className="row"><button className="btn" onClick={exportBackup}>Export a backup of this career</button><button className="btn ghost" onClick={() => { get(); import('./store').then(m => m.closeCareer()); }}>Back to the career library</button></div></Section>
      <Section title="Rules in this game"><ul className="plain">{RULES_SUMMARY.map((r, i) => <li key={i}>{r}</li>)}</ul></Section>
      <Section title="Data and versions"><p className="muted">{SNAPSHOT_NOTE[S.tour]} Real players' birth dates are stored to the year and shown as ages. Players outside the starting top 200 are fictional and labelled. Event calendars come from the public 2026 tour schedules. Engine {S.v.engine} · balance {S.v.balance} · content {S.v.content} · {S.v.rng}. Overall strength of your player right now: {strength(S.players[S.userId].ab).toFixed(1)} (diagnostic only, not used in matches).</p></Section>
    </div>
  );
}

/** The player's own portrait: upload, replace or remove. Stored with the career and included in backups. */
export function PortraitPicker({ S }: { S: State }) {
  const me = S.players[S.userId], { save } = useApp(), ro = save === 'readonly' || S.phase === 'retired';
  const pick = async (f?: File) => { if (!f) return; try { const data = await portraitFromFile(f); await dispatch({ type: 'SetPortrait', data }, 'Saving portrait'); } catch (e: any) { set({ error: e.message }); } };
  return (
    <div className="portrait">
      <Avatar p={me} size={110} user={S.u.avatar} />
      {!ro && <div className="row" style={{ margin: '.5rem 0 0', gap: '.4rem' }}>
        <label className="btn small">{S.u.portrait ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
        {S.u.portrait && <button className="btn small ghost" onClick={() => dispatch({ type: 'SetPortrait', data: null }, 'Saving')}>Remove</button>}
      </div>}
    </div>
  );
}
