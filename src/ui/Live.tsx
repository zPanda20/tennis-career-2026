// Hands-on matches: scouting and preparation before the first ball, a plan for every set, and ways to stop a slide.
// Optional: with the match setting on "Coach plays them", none of this appears and the coach makes the same calls.
import { useEffect, useMemo, useState } from 'react';
import { expectedWin } from '../core/match';
import { h2h } from '../core/selectors';
import { COUNTER, TAC, TACTICS, Tactic, allEff, coachPick, fitWord, oppPlans, profileOf, READ_SD, readOf, whyText } from '../core/tactics';
import { matchKey, readSeed } from '../core/tour';
import type { MatchStats, State, UMatch } from '../core/types';
import { EvName } from './bits';
import { Board, Col, Plates } from './Career';
import { Momentum, seasonOf } from './fx';
import { dispatch, get, set } from './store';

type Mode = 'auto' | 'big' | 'all';
export const MATCH_MODES: [Mode, string, string][] = [
  ['auto', 'Coach plays them', 'Fastest. Your coach picks every plan.'],
  ['big', 'I play the big ones', 'Finals, semi-finals, majors, top-10 opponents and rivals.'],
  ['all', 'I play every match', 'Every main-draw match. Qualifying stays with the coach.'],
];
export function MatchModePicker({ value, onChange, compact }: { value: Mode; onChange: (m: Mode) => void; compact?: boolean }) {
  return (
    <div className={`mmode ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Who plays your matches">
      {MATCH_MODES.map(([k, t, d]) => <button key={k} role="radio" aria-checked={value === k} className={`choice slim ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}><b>{t}</b>{!compact && <span>{d}</span>}</button>)}
    </div>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const pct = (x: number, y: number) => (y ? Math.round((x / y) * 100) : 0);
function numbers(st: [MatchStats, MatchStats], u: number) {
  const me = st[u], op = st[1 - u];
  return { serve: pct(me.fsWon + me.ssWon, me.fsTot), ret: pct(me.retWon, op.fsTot), bp: `${me.bpWon}/${me.bpTot}`, obp: `${op.bpWon}/${op.bpTot}`, pts: [me.pts, op.pts] };
}

export function LiveMatch({ S }: { S: State }) {
  const L = S.live!, ed = S.cal.find(e => e.id === L.ed)!, me = S.players[S.userId], oppId = L.u === 0 ? L.b : L.a, opp = S.players[oppId], u = L.u;
  const read = useMemo(() => readOf(opp, L.film ? 0 : READ_SD[S.u.coach.tier] ?? 6, readSeed(S, matchKey(ed, L.round, L.a, L.b))), [S, L.film]);
  const P = L.pause, D = L.done, rules = { surface: ed.surface, bestOf: (ed.band === 'GS' && S.tour === 'atp' ? 5 : 3) as 3 | 5, tb10: ed.band === 'GS', tour: S.tour };
  const flow = D?.flow ?? P?.flow ?? [], sets = D?.sets ?? P?.sets ?? [];
  const persp = (s: [number, number, number?, number?]) => (u === 0 ? [s[0], s[1], s[2] !== undefined ? Math.min(s[2]!, s[3]!) : undefined] : [s[1], s[0], s[2] !== undefined ? Math.min(s[2]!, s[3]!) : undefined]) as [number, number, number?];
  const m = {
    id: L.key, ed: L.ed, year: S.year, wk: S.wk, round: L.round, qual: false, opp: oppId, oppName: opp.name, oppRank: S.rank[oppId], oppReal: opp.real, oppCountry: opp.country, myRank: S.rank[S.userId],
    won: !!D && D.winner === u, score: D?.score ?? '', cls: D?.cls ?? 'played', p: expectedWin(me, opp, rules),
    minutes: Math.round(flow.length * 7.4), reasons: [], turning: [], surface: ed.surface, dev: 0, fat: 0, flow: flow.map(g => (g === u ? '1' : '0')).join(''), sets: sets.map(persp),
  } as UMatch;
  const cols: Col[] = sets.map(persp).map(s => ({ a: s[0], b: s[1], tb: s[2] }));
  if (P && P.kind !== 'start') { const g = u === 0 ? P.g : [P.g[1], P.g[0]]; if (P.kind === 'slide') cols.push({ a: g[0], b: g[1], live: true }); else cols.push({ a: 0, b: 0, pend: true }); }
  if (P?.kind === 'start') cols.push({ a: 0, b: 0, pend: true });
  const setsWon = sets.map(persp).reduce((t, s) => [t[0] + (s[0] > s[1] ? 1 : 0), t[1] + (s[1] > s[0] ? 1 : 0)], [0, 0]);
  const title = D ? (D.winner === u ? 'Match won' : 'Match lost') : P?.kind === 'start' ? 'Match preparation' : P?.kind === 'set' ? `Set break · ${setsWon[0] === setsWon[1] ? `${setsWon[0]} all` : setsWon[0] > setsWon[1] ? `you lead ${setsWon[0]}-${setsWon[1]}` : `${opp.name.split(' ').slice(-1)[0]} leads ${setsWon[1]}-${setsWon[0]}`}` : 'Momentum check';
  const [tac, setTac] = useState<Tactic | null>(null), [drill, setDrill] = useState(false);
  useEffect(() => { setTac(null); }, [P?.at, P?.kind]);
  const lastOpp = P && P.oppTacs.length ? (P.oppTacs[P.oppTacs.length - 1] as Tactic) : undefined;
  const scoutedOpp = oppPlans(read, me.ab, ed.surface)[0];
  const coachTac = coachPick(me.ab, read, ed.surface, P?.kind === 'start' ? undefined : lastOpp);
  const chosen = tac ?? (P?.kind === 'slide' ? null : coachTac);
  const decide = (extra: { tac?: Tactic; reset?: boolean; auto?: boolean; drill?: boolean }) => dispatch({ type: 'LiveDecide', ...extra }, '');
  const cont = () => dispatch({ type: 'LiveContinue' }, 'Back to the tour').then(ok => { const s = get().S; if (ok && s && s.phase !== 'live' && s.lastSummary && (s.phase === 'plan' || s.phase === 'yearEnd')) set({ overlay: { kind: 'reveal' } }); });

  return (
    <div className={`screen live-screen s-${seasonOf(S.wk)}`} role="dialog" aria-modal="true" aria-label="Live match">
      <div className="screen-in">
      <div className="screen-top"><div><div className="k">{ed.cat} · {roundLabelLong(L.round)} · hands-on match</div><div className="t"><EvName name={ed.name} surface={ed.surface} /></div></div></div>
      <div className="reveal-head"><span className="kicker">{ed.surface} · best of {rules.bestOf}</span><h1 className={`mega ${D ? '' : 'live'}`}>{title}</h1></div>
      <Plates S={S} m={m} done={!!D}><Board S={S} m={m} cols={cols} done={!!D} note={P?.kind === 'start' ? 'about to start' : undefined} /></Plates>

      {P?.kind === 'start' && <StartPanel S={S} read={read} film={!!L.film} scoutedOpp={scoutedOpp} coachTac={coachTac} chosen={chosen!} setTac={setTac} drill={drill} setDrill={setDrill} oppId={oppId} m={m} />}
      {P?.kind === 'set' && <SetPanel S={S} P={P} u={u} read={read} coachTac={coachTac} chosen={chosen!} setTac={setTac} lastOpp={lastOpp} m={m} />}
      {P?.kind === 'slide' && <SlidePanel P={P} u={u} chosen={tac} setTac={setTac} read={read} S={S} m={m} lastOpp={lastOpp} />}
      {D && <div className="reveal-grid"><section className="glass" style={{ gridColumn: '1 / -1' }}><Momentum m={m} oppName={opp.name} />{D.plan && <p className="muted" style={{ marginTop: '.6rem' }}>Your plans: {D.plan.my.map(t => TAC[t as Tactic].short).join(' → ')} · Theirs: {D.plan.opp.map(t => TAC[t as Tactic].short).join(' → ')}</p>}</section></div>}

      <div className="dock live-dock">
        {P && <button className="btn ghost" onClick={() => decide({ auto: true, tac: P.kind === 'slide' ? undefined : chosen ?? undefined })}>Let the coach finish it</button>}
        <span className="grow" />
        {P?.kind === 'start' && <button className="cta" onClick={() => decide({ tac: chosen!, drill })}>Start the match</button>}
        {P?.kind === 'set' && <button className="cta" onClick={() => decide({ tac: chosen! })}>Play the next set</button>}
        {P?.kind === 'slide' && <>
          <button className="btn" onClick={() => decide({})}>Ride it out</button>
          <button className="btn" disabled={P.resetsLeft <= 0} onClick={() => decide({ reset: true, tac: tac ?? undefined })}>Reset · {P.resetsLeft} left</button>
          {tac && <button className="cta" onClick={() => decide({ tac })}>Switch to {TAC[tac].short}</button>}
        </>}
        {D && <button className="cta" onClick={cont}>Continue</button>}
      </div>
      </div>
    </div>
  );
}
const roundLabelLong = (r: string) => ({ F: 'Final', SF: 'Semi-final', QF: 'Quarter-final', R16: 'Round of 16', R32: 'Round of 32', R64: 'Round of 64', R128: 'Round of 128' } as Record<string, string>)[r] ?? r;

function TacticGrid({ S, read, chosen, setTac, coachTac, oppTac, used }: { S: State; read: import('../core/types').Abil; chosen: Tactic | null; setTac: (t: Tactic) => void; coachTac: Tactic; oppTac?: Tactic; used?: Tactic[] }) {
  const L = S.live!, ed = S.cal.find(e => e.id === L.ed)!, me = S.players[S.userId], E = allEff(me.ab, read, ed.surface);
  return (
    <div className="tacs" role="radiogroup" aria-label="Game plan">{TACTICS.map(t => {
      const v = E[t].sv + E[t].rt + (oppTac && COUNTER[oppTac] === t ? 0.012 : 0), rep = used ? used.slice().reverse().findIndex(x => x !== t) : 0, same = used && used.length && used[used.length - 1] === t ? (rep < 0 ? used.length : rep) : 0;
      return (
        <button key={t} role="radio" aria-checked={chosen === t} className={`tac ${chosen === t ? 'on' : ''}`} onClick={() => setTac(t)}>
          <span className="row between" style={{ margin: 0 }}><b>{TAC[t].name}</b>{t === coachTac && <span className="pill ok">Coach's pick</span>}</span>
          <small>{TAC[t].text}</small>
          <span className={`fit f-${fitWord(v).split(' ')[0].toLowerCase()}`}>{fitWord(v)}{oppTac && COUNTER[oppTac] === t ? ' · counters their plan' : ''}{same >= 2 ? ' · they are reading it now' : ''}</span>
          <small className="why">{whyText(t, me.ab, read, ed.surface)}</small>
        </button>);
    })}</div>
  );
}

function StartPanel({ S, read, film, scoutedOpp, coachTac, chosen, setTac, drill, setDrill, oppId, m }: { S: State; read: import('../core/types').Abil; film: boolean; scoutedOpp: Tactic; coachTac: Tactic; chosen: Tactic; setTac: (t: Tactic) => void; drill: boolean; setDrill: (b: boolean) => void; oppId: string; m: UMatch }) {
  const opp = S.players[oppId], pr = profileOf(read), rec = h2h(S).find(r => r.opp === oppId), tier = S.u.coach.tier;
  return (
    <div className="reveal-grid live-grid">
      <section className="glass">
        <div className="sec-head"><h3>Scouting report</h3><small>{film ? 'film studied: exact' : tier === 'legend' || tier === 'master' ? 'sharp read' : tier === 'elite' ? 'good read' : 'rough read'}</small></div>
        <ul className="plain scout">
          <li><span>Strengths</span><b>{cap(pr.strengths.join(', '))}</b></li>
          <li><span>Weaknesses</span><b>{cap(pr.weaknesses.join(', '))}</b></li>
          <li><span>Likely plan</span><b>{TAC[scoutedOpp].name}</b></li>
          <li><span>Head to head</span><b>{rec ? `${rec.w}–${rec.l}` : 'first meeting'}</b></li>
          <li><span>Your chances</span><b>{Math.round(m.p * 100)}%</b></li>
        </ul>
        {!film && <button className="btn small" onClick={() => dispatch({ type: 'LiveDecide', film: true }, '')}>Study film · sharpen the read</button>}
        <p className="help">The read comes from your coach. Better coaches read opponents more accurately; film study makes it exact.</p>
      </section>
      <section className="glass span2">
        <div className="sec-head"><h3>Game plan</h3><small>{opp.name.split(' ').slice(-1)[0]} is likely to {TAC[scoutedOpp].name.toLowerCase()}</small></div>
        <TacticGrid S={S} read={read} chosen={chosen} setTac={setTac} coachTac={coachTac} oppTac={scoutedOpp} />
        <label className="check" style={{ marginTop: '.8rem' }}><input type="checkbox" checked={drill} onChange={e => setDrill(e.target.checked)} /> Extra practice session on this plan: stronger for the first two sets, a little more tired afterwards</label>
      </section>
    </div>
  );
}

function SetPanel({ S, P, u, read, coachTac, chosen, setTac, lastOpp, m }: { S: State; P: NonNullable<State['live']>['pause'] & {}; u: number; read: import('../core/types').Abil; coachTac: Tactic; chosen: Tactic; setTac: (t: Tactic) => void; lastOpp?: Tactic; m: UMatch }) {
  const n = numbers(P.stats, u), last = P.sets[P.sets.length - 1], wonLast = last && (u === 0 ? last[0] > last[1] : last[1] > last[0]), myLast = P.myTacs[P.myTacs.length - 1] as Tactic;
  const opp = S.players[m.opp].name.split(' ').slice(-1)[0], same = P.myTacs.filter((t, i, a) => i >= a.length - 2 && t === myLast).length;
  const advice = coachTac === myLast && wonLast ? `Keep doing what you are doing. ${TAC[coachTac].name} is working.`
    : lastOpp && COUNTER[lastOpp] === coachTac ? `${opp} went with ${TAC[lastOpp].name.toLowerCase()}. ${TAC[coachTac].name} takes the sting out of it.`
    : same >= 2 && coachTac !== myLast ? `They are reading the ${TAC[myLast].short.toLowerCase()} pattern now. Change it up: ${TAC[coachTac].name.toLowerCase()}.`
    : `${TAC[coachTac].name}. ${whyText(coachTac, S.players[S.userId].ab, read, S.cal.find(e => e.id === S.live!.ed)!.surface)}`;
  return (
    <div className="reveal-grid live-grid">
      <section className="glass">
        <div className="sec-head"><h3>So far</h3></div>
        <div className="facts">
          <div className="fact"><b>{n.serve}%</b><span>Serve points won</span><b /></div>
          <div className="fact"><b>{n.ret}%</b><span>Return points won</span><b /></div>
          <div className="fact"><b>{n.bp}</b><span>Your break points</span><b>{n.obp}</b></div>
          <div className="fact"><b>{n.pts[0]}</b><span>Points won</span><b>{n.pts[1]}</b></div>
        </div>
        <Momentum m={m} oppName={S.players[m.opp].name} upto={P.flow.length} />
      </section>
      <section className="glass span2">
        <div className="coach-say"><span className="eyebrow">Your coach</span><p>“{advice}”</p>{lastOpp && <small className="muted">Their plan last set: {TAC[lastOpp].name}</small>}</div>
        <TacticGrid S={S} read={read} chosen={chosen} setTac={setTac} coachTac={coachTac} oppTac={lastOpp} used={P.myTacs as Tactic[]} />
      </section>
    </div>
  );
}

function SlidePanel({ S, P, u, chosen, setTac, read, m, lastOpp }: { S: State; P: NonNullable<State['live']>['pause'] & {}; u: number; chosen: Tactic | null; setTac: (t: Tactic) => void; read: import('../core/types').Abil; m: UMatch; lastOpp?: Tactic }) {
  const g = u === 0 ? P.g : [P.g[1], P.g[0]];
  return (
    <div className="reveal-grid live-grid">
      <section className="glass">
        <div className="sec-head"><h3>Three games in a row gone</h3></div>
        <p>It is {g[0]}-{g[1]} in this set. Momentum is with {S.players[m.opp].name.split(' ').slice(-1)[0]}.</p>
        <ul className="plain scout">
          <li><span>Reset</span><b>Slow down, routines, towel, breathe. A lift for the next four games.</b></li>
          <li><span>Change the plan</span><b>Pick a different pattern from now on.</b></li>
          <li><span>Ride it out</span><b>Trust the plan. Streaks end.</b></li>
        </ul>
        <Momentum m={m} oppName={S.players[m.opp].name} upto={P.flow.length} />
      </section>
      <section className="glass span2">
        <div className="sec-head"><h3>Change the plan?</h3><small>optional · pick one, then Switch</small></div>
        <TacticGrid S={S} read={read} chosen={chosen} setTac={setTac} coachTac={coachPick(S.players[S.userId].ab, read, S.cal.find(e => e.id === S.live!.ed)!.surface, lastOpp ?? (P.opp as Tactic))} oppTac={P.opp as Tactic} used={P.myTacs as Tactic[]} />
      </section>
    </div>
  );
}
