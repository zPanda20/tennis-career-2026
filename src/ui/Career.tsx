import { useMemo, useState } from 'react';
import { BAND_NAME, BLOCK_NAMES, ECON } from '../core/balance';
import { Option, Route, blockWeeks, coachReport, eventsInWeek, featuredEvent, fillText, optionFor, routes } from '../core/agent';
import { fmtShort, wkDate } from '../core/content';
import { roundName, totals } from '../core/selectors';
import { weeklyGuaranteed } from '../core/tour';
import { ABILITIES, ABILITY_NAMES, Focus, Intensity, Policies, Priority, State } from '../core/types';
import { Bar, BrandMark, EventLogo, Modal, Pill, Section, Stat, SurfaceTag, money, rankTxt } from './bits';
import { dispatch, set, useApp } from './store';

const chance = (p: number) => (p < 0.2 ? 'heavy underdog' : p < 0.4 ? 'underdog' : p <= 0.6 ? 'evenly matched' : p <= 0.8 ? 'favourite' : 'strong favourite');
const STATUS_TONE: Record<string, string> = { accepted: 'ok', 'likely qualifying': '', alternate: 'warn', unlikely: 'crit' };
const PRIORITIES: [Priority, string, string][] = [['prep', 'Focused preparation', 'More useful training; morale can dip under sustained pressure'], ['recovery', 'Recovery', 'Faster fatigue recovery on free weeks; less skill training'], ['social', 'Social life', 'Morale rises across the block; a little sharpness lost to late nights'], ['relationship', 'Relationship time', 'Support and morale; relationships deepen'], ['professional', 'Professional commitments', 'Reputation and sponsor relations; some training time and energy']];
const INTENS: [Intensity, string][] = [['relaxed', 'Relaxed: maintenance, kind to the body'], ['normal', 'Normal: the sustainable default'], ['intense', 'Intense: more growth, more overload risk']];

export function Home({ S }: { S: State }) {
  const { save } = useApp(), u = S.u, me = S.players[S.userId], rep = useMemo(() => coachReport(S), [S]), sum = S.lastSummary, ro = save === 'readonly';
  const inj = me.injuredUntil > S.wk ? u.injuries[u.injuries.length - 1] : null;
  const nextBig = S.cal.find(e => e.startWk >= S.wk && (e.band === 'GS' || e.band === 'T1000'));
  return (
    <div className="grid-home">
      <div className="col">
        <div className="card situation">
          {S.phase === 'plan' && <>
            <p className="eyebrow">{S.year} season · {u.finalSeasonWarned ? 'your final eligible season' : `season ${u.seasons.length + 1}`}</p>
            <h2 className="display">{BLOCK_NAMES[S.block]}</h2>
            <p>{inj ? `You are recovering from a ${inj.loc === 'general illness' ? 'illness' : inj.loc + ' injury'}; expected back around ${fmtShort(wkDate(me.injuredUntil))}.` : rep.advice} {nextBig ? `The next big event is ${nextBig.name} (${nextBig.dates}).` : ''}</p>
            <div className="row"><button className="btn primary big" disabled={ro} onClick={() => set({ overlay: { kind: 'planner' } })}>{u.finalSeasonWarned && S.block === 0 ? 'Begin final season' : 'Plan next block'}</button></div>
          </>}
          {S.phase === 'interrupt' && <Interrupt S={S} />}
          {S.phase === 'yearEnd' && <YearEnd S={S} />}
          {S.phase === 'retired' && <><h2 className="display">Career complete</h2><p>{me.name} has retired. The full review and exports are in Records.</p><button className="btn primary" onClick={() => set({ tab: 'records' })}>Open career review</button></>}
        </div>
        {sum && S.phase !== 'yearEnd' && <BlockSummaryCard S={S} />}
      </div>
      <div className="col">
        <Section title="Condition">
          {inj && <p className="crit-box">Unavailable: {inj.sev} {inj.loc === 'general illness' ? 'illness' : `${inj.loc} injury`}. Likely absence {inj.estMin} to {inj.estMax} weeks from {inj.date}.</p>}
          <Bar label="Fatigue" value={me.fatigue} tone="cond" invert note="lower is better" /><Bar label="Strain" value={me.strain} tone="cond" invert note="accumulated overload" />
          <Bar label="Sharpness" value={me.sharp} tone="cond" /><Bar label="Confidence" value={me.conf} tone="cond" /><Bar label="Morale" value={me.morale} tone="cond" />
        </Section>
        <Section title="Coach's view" aside={<small>{u.coach.name.split(' (')[0]}</small>}><p>{rep.potential} {rep.room}</p><p className="muted">{rep.strengths}</p></Section>
        <Section title="Money" aside={<small>career dollars</small>}>
          <div className="stats"><Stat k="Cash" v={money(u.cash)} /><Stat k="Status" v={u.cash < 1 ? 'Basic support' : u.cash < ECON.reserve ? 'Tight' : u.cash < 6000 ? 'Careful' : 'Comfortable'} sub={u.cash < 1 ? 'Essentials and short trips are covered; long-haul trips are not' : u.pol.detail === 'quick' ? 'Agent-managed' : `${money(weeklyGuaranteed(S) * 52 / 12)} / month before events`} /></div>
          {u.sponsors.length > 0 && <div className="brands">{u.sponsors.map(s => <BrandMark key={s.id} sp={s} />)}</div>}
        </Section>
        {u.ach.length > 0 && <Section title="Recent milestones"><ul className="plain">{u.ach.slice(-4).reverse().map(a => <li key={a.id}><b>{a.name}</b> <small>{a.date.slice(0, 4)}</small></li>)}</ul></Section>}
        {S.phase === 'plan' && !ro && <button className="btn ghost small" onClick={() => { if (confirm('Retire now? Your career will be closed and frozen. This cannot be undone.')) dispatch({ type: 'Retire' }, 'Closing your career…').then(ok => ok && set({ tab: 'records' })); }}>Retire from professional tennis</button>}
      </div>
    </div>
  );
}

export function BlockSummaryCard({ S }: { S: State }) {
  const sum = S.lastSummary!, u = S.u, ts = sum.tourneys.map(id => u.tourneys.find(t => t.ed === id)!).filter(Boolean), moved = sum.rankFrom - sum.rankTo;
  const dev = ABILITIES.filter(a => (sum.dev[a] ?? 0) >= 0.05);
  return (
    <div className="card">
      <p className="eyebrow">What happened · {BLOCK_NAMES[sum.block].split(' · ')[0]} {sum.year}</p>
      <div className="stats"><Stat k="Ranking" v={rankTxt(sum.rankTo)} sub={moved === 0 ? 'unchanged' : `${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)} from ${sum.rankFrom}`} /><Stat k="Points" v={sum.ptsTo} sub={`${sum.ptsTo - sum.ptsFrom >= 0 ? '+' : ''}${sum.ptsTo - sum.ptsFrom}`} /><Stat k="Cash" v={money(sum.cashTo)} sub={`${sum.cashTo - sum.cashFrom >= 0 ? '+' : '−'}${money(Math.abs(sum.cashTo - sum.cashFrom)).replace('−', '')}`} /></div>
      {ts.length > 0 ? <ul className="list results">{ts.map(t => (
        <li key={t.ed}><button className="rowbtn" onClick={() => set({ overlay: { kind: 'tourney', ed: t.ed } })}>
          <span className="grow"><b>{t.name}</b><small>{t.cat} · {t.dates}</small></span>
          <span className="res">{t.status === 'ALT' || t.status === 'REJ' ? <Pill tone="warn">Not accepted</Pill> : t.status === 'WD' ? <Pill>Withdrew</Pill> : t.title ? <Pill tone="ok">Champion</Pill> : <span>{roundName(t.reached)}</span>}<small>{t.pts ? `${t.pts} pts · ` : ''}{t.prize ? money(t.prize) : ''}</small></span>
        </button></li>))}</ul> : <p className="muted">No tournaments were played in this block.</p>}
      {dev.length > 0 && <p><b>Development:</b> {dev.map(a => `${ABILITY_NAMES[a]} +${sum.dev[a]!.toFixed(1)}`).join(', ')}.</p>}
      {sum.notes.map((n, i) => <p key={i} className="note">{n}</p>)}
      {sum.follow.map((n, i) => <p key={i} className="note story">{fillText(S, n)}</p>)}
      {sum.newAch.length > 0 && <p className="ok-box">Milestones: {sum.newAch.join(' · ')}</p>}
      {sum.world.length > 0 && <p className="muted">Around the tour: {sum.world.join('; ')}.</p>}
    </div>
  );
}

function Interrupt({ S }: { S: State }) {
  const u = S.u, pend = S.pending!, inj = u.injuries.find(i => i.id === pend.injury), { save } = useApp(), ro = save === 'readonly';
  if (pend.type === 'forcedRetire') return <><p className="eyebrow">Medical assessment</p><h2 className="display">Your career ends here</h2><p>{pend.text}</p><button className="btn primary" disabled={ro} onClick={() => dispatch({ type: 'ResolveInjury', rehab: 'conservative' }, 'Closing your career…').then(ok => ok && set({ tab: 'records' }))}>See the career review</button></>;
  if (!inj) return null;
  const cost = inj.sev === 'moderate' ? 1500 : inj.sev === 'major' ? 6000 : 15000;
  return (
    <>
      <p className="eyebrow">Injury review · {inj.date}</p>
      <h2 className="display">{inj.sev[0].toUpperCase() + inj.sev.slice(1)} {inj.loc === 'general illness' ? 'illness' : `${inj.loc} injury`}</h2>
      <p>{inj.desc} The first assessment suggests <b>{inj.estMin} to {inj.estMax} weeks</b> away; the range will narrow as you recover. Entries during the absence have been cancelled.{inj.perm ? ' The scan also shows damage that will not fully heal.' : ''}</p>
      <div className="choice-grid one">
        <button className="choice" disabled={ro} onClick={() => dispatch({ type: 'ResolveInjury', rehab: 'conservative' })}><b>Conservative rehabilitation</b><span>The safe default, covered by your basic support. No added risk.</span></button>
        <button className="choice" disabled={ro || u.cash < cost} onClick={() => dispatch({ type: 'ResolveInjury', rehab: 'specialist' })}><b>Specialist care ({money(cost)})</b><span>{u.cash < cost ? 'Not affordable right now.' : 'Likely a somewhat shorter absence. It buys support, not a guaranteed recovery.'}</span></button>
        <button className="choice" disabled={ro} onClick={() => dispatch({ type: 'ResolveInjury', rehab: 'early' })}><b>Push for an earlier return</b><span>Back sooner, with a clearly higher chance of a setback over the following three months.</span></button>
      </div>
    </>
  );
}

function YearEnd({ S }: { S: State }) {
  const u = S.u, pend = S.pending!, s = u.seasons[u.seasons.length - 1], { save } = useApp(), ro = save === 'readonly';
  const [coach, setCoach] = useState('keep'), [sp, setSp] = useState<Record<string, string>>({}), [ret, setRet] = useState(false);
  if (pend.type === 'forcedRetire') return <><p className="eyebrow">End of the {s.year} season</p><h2 className="display">Time to say goodbye</h2><p>{pend.text}</p><button className="btn primary" disabled={ro} onClick={() => dispatch({ type: 'YearEnd', coach: 'keep', sponsors: [], retire: false }, 'Closing your career…').then(ok => ok && set({ tab: 'records' }))}>See the career review</button></>;
  const slots = ['apparel', 'racket', 'partner'].filter(sl => pend.sponsorOffers?.some(o => o.slot === sl));
  return (
    <>
      <p className="eyebrow">Year-end review</p>
      <h2 className="display">{s.year}: year-end {rankTxt(s.rank)}</h2>
      <div className="stats"><Stat k="Record" v={`${s.w}–${s.l}`} sub={`${s.events} events`} /><Stat k="Titles" v={s.titles} sub={`${s.finals} finals`} /><Stat k="Best major" v={roundName(s.majorsBest)} /><Stat k="Prize money" v={money(s.prize)} /><Stat k="Development" v={`+${s.dev.toFixed(1)}`} sub={`${Math.round((s.devComp / (s.dev || 1)) * 100)}% from competition`} /><Stat k="Weeks injured" v={s.injWeeks} /></div>
      {u.finalSeasonWarned && <p className="warn-box">Next season is your final eligible season: the game's age ceiling closes a career at the end of the season in which a player turns 40.</p>}
      <h3>Coaching</h3>
      <div className="choice-grid one" role="radiogroup" aria-label="Coach for next season">
        <button className={`choice ${coach === 'keep' ? 'on' : ''}`} role="radio" aria-checked={coach === 'keep'} onClick={() => setCoach('keep')}><b>Stay with {u.coach.name}</b><span>{u.coach.tier} tier · {money(u.coach.cost)} a month · continuity and trust ({Math.round(u.rel.coach)}/100)</span></button>
        {pend.coachOffers?.map(c => <button key={c.id} className={`choice ${coach === c.id ? 'on' : ''}`} role="radio" aria-checked={coach === c.id} onClick={() => setCoach(c.id)}><b>{c.name}</b><span>{c.tier} tier · {money(c.cost)} a month · {c.dev >= 1.15 ? 'outstanding' : c.dev >= 1.08 ? 'strong' : c.dev >= 1.02 ? 'solid' : 'modest'} development record · {c.recovery > 0.66 ? 'careful with workloads' : c.recovery > 0.4 ? 'average on recovery' : 'pushes hard'} · {c.fit > 0.02 ? 'suits your game' : c.fit < -0.02 ? 'different philosophy' : 'neutral fit'}. Switching costs one month's fee and a short adjustment.</span></button>)}
      </div>
      {slots.length > 0 && <><h3>Sponsorship offers</h3>{slots.map(sl => (
        <div key={sl} className="choice-grid one" role="radiogroup" aria-label={`${sl} sponsor`}>
          <p className="muted cap">{sl === 'partner' ? 'Commercial partner' : sl}</p>
          <button className={`choice slim ${!sp[sl] ? 'on' : ''}`} role="radio" aria-checked={!sp[sl]} onClick={() => setSp({ ...sp, [sl]: '' })}><b>No deal</b></button>
          {pend.sponsorOffers!.filter(o => o.slot === sl).map(o => <button key={o.id} className={`choice slim ${sp[sl] === o.id ? 'on' : ''}`} role="radio" aria-checked={sp[sl] === o.id} onClick={() => setSp({ ...sp, [sl]: o.id })}><BrandMark sp={o} /><span>{money(o.monthly)} a month guaranteed · {money(o.titleBonus)} per main-tour title · {o.appearances} appearance {o.appearances === 1 ? 'day' : 'days'} a year · through {o.until - 1}. No effect on ability.</span></button>)}
        </div>))}</>}
      <label className="check"><input type="checkbox" checked={ret} onChange={e => setRet(e.target.checked)} /><span>Retire now instead of playing {S.year} <small>Closes and freezes the career.</small></span></label>
      <div className="row"><button className="btn primary big" disabled={ro} onClick={() => { if (ret && !confirm('Retire now? This cannot be undone.')) return; dispatch({ type: 'YearEnd', coach, sponsors: Object.values(sp).filter(Boolean), retire: ret }, ret ? 'Closing your career…' : 'Starting the new season…').then(ok => ok && ret && set({ tab: 'records' })); }}>{ret ? 'Retire' : `Start the ${S.year} season`}</button></div>
    </>
  );
}

export function Planner({ S }: { S: State }) {
  const u = S.u, rs = useMemo(() => routes(S), [S]), ev = useMemo(() => featuredEvent(S), [S]), weeks = useMemo(() => blockWeeks(S), [S]);
  const rec = rs.find(r => r.recommended) ?? rs[0];
  const [key, setKey] = useState<string>(rec.key), [plan, setPlan] = useState<Record<number, string>>(rec.weeks), [pol, setPol] = useState<Policies>({ ...u.pol }), [life, setLife] = useState<number | null>(null), [edit, setEdit] = useState(false);
  const detailed = pol.detail === 'detailed';
  const optById = (id: string): Option | null => { const ed = S.cal.find(e => e.id === id); return ed ? optionFor(S, ed) : null; };
  const picks = Object.values(plan).map(optById).filter(Boolean) as Option[], cost = picks.reduce((t, o) => t + o.cost, 0), income = Math.max(0, weeklyGuaranteed(S)) * weeks.length;
  const busy = (w: number, skip?: string): string | null => { // why a week is unavailable
    for (const [k, id] of Object.entries(plan)) { if (id === skip) continue; const ed = S.cal.find(e => e.id === id)!, o = optionFor(S, ed); if (ed.weeks === 2 && +k + 1 === w) return `second week of ${ed.name}`; if (ed.band === 'GS' && o.status !== 'accepted' && +k - 1 === w) return `qualifying week for ${ed.name}`; }
    return null;
  };
  const choose = (r: Route) => { setKey(r.key); setPlan({ ...r.weeks }); };
  const setWeek = (w: number, id: string) => { const next = { ...plan }; if (id) { next[w] = id; const ed = S.cal.find(e => e.id === id)!; if (ed.weeks === 2) delete next[w + 1]; if (ed.band === 'GS' && optionFor(S, ed).status !== 'accepted') delete next[w - 1]; } else delete next[w]; setPlan(next); setKey('custom'); };
  const needLife = ev && life === null;
  const commit = () => dispatch({ type: 'CommitBlock', plan: { weeks: plan, route: key, lifeEv: ev?.id, lifeChoice: life ?? undefined }, pol }, `Playing ${BLOCK_NAMES[S.block].split(' · ')[1].toLowerCase()}…`).then(ok => ok && set({ overlay: null }));
  return (
    <Modal title={`${BLOCK_NAMES[S.block]} ${S.year}`} onClose={() => set({ overlay: null })} wide>
      <div className="planner">
        <h3>Choose a route</h3>
        <div className="routes" role="radiogroup" aria-label="Competition route">
          {rs.map(r => (
            <button key={r.key} role="radio" aria-checked={key === r.key} className={`route ${key === r.key ? 'on' : ''}`} onClick={() => choose(r)}>
              <span className="route-head"><b>{r.label}</b>{r.recommended && <Pill tone="ok">Coach recommends</Pill>}</span>
              <span className="muted">{r.intent}</span>
              <ul>{r.picks.map(o => <li key={o.ed.id}><span>{o.ed.name}</span><small>{o.ed.cat} · {o.status}</small></li>)}{!r.picks.length && <li><small>No events</small></li>}</ul>
              <span className="why">{r.why.join(' · ')}</span>
              <span className="muted">Travel and entry about {money(r.cost)}</span>
            </button>))}
        </div>
        {detailed && <button className="btn small" aria-expanded={edit} onClick={() => setEdit(!edit)}>{edit ? 'Hide' : 'Edit'} individual events</button>}
        {(edit || key === 'custom') && detailed && (
          <div className="weeks">
            {weeks.map(w => {
              const why = busy(w), evs = eventsInWeek(S, w).map(e => optionFor(S, e)).sort((a, b) => ({ accepted: 0, 'likely qualifying': 1, alternate: 2, unlikely: 3 }[a.status] - { accepted: 0, 'likely qualifying': 1, alternate: 2, unlikely: 3 }[b.status]) || b.ed.draw - a.ed.draw), cur = plan[w] ? optById(plan[w]) : null;
              return (
                <div key={w} className="week">
                  <label htmlFor={`wk${w}`}><b>{fmtShort(wkDate(w))}</b></label>
                  {why ? <span className="muted">Occupied: {why}</span> : (
                    <select id={`wk${w}`} value={plan[w] ?? ''} onChange={e => setWeek(w, e.target.value)}>
                      <option value="">Training week</option>
                      {evs.map(o => <option key={o.ed.id} value={o.ed.id}>{o.ed.name} · {o.ed.cat} · {o.ed.surface} · {o.status} · {money(o.cost)}</option>)}
                    </select>)}
                  {cur && !why && <small>{BAND_NAME[cur.ed.band]} in {cur.ed.city}; you would be {chance(cur.p)} against a typical opponent{cur.ed.prov ? '; provisional calendar entry' : ''}{cur.ed.weeks === 2 ? '; runs two weeks' : ''}.</small>}
                </div>);
            })}
          </div>)}
        {detailed && <div className="budget"><Stat k="Cash" v={money(u.cash)} /><Stat k="Planned trips" v={money(-cost)} /><Stat k="Guaranteed net income" v={money(income)} sub="support and sponsors, minus living and coaching" /><Stat k="Forecast before winnings" v={money(u.cash - cost + income)} sub={u.cash - cost + income < ECON.reserve ? 'below your reserve' : 'reserve intact'} /></div>}
        {detailed && u.cash - cost + income < 0 && <p className="warn-box">These trips cost more than you can cover. Events you cannot fund when they come round will be withdrawn.</p>}

        <h3>Training and time off court</h3>
        <div className="form cols">
          <fieldset><legend>Training intensity</legend>{INTENS.map(([k, t]) => <label key={k} className="radio"><input type="radio" name="int" checked={pol.intensity === k} onChange={() => setPol({ ...pol, intensity: k })} /><span>{t}</span></label>)}</fieldset>
          <fieldset><legend>Activity priority</legend>{PRIORITIES.map(([k, t, d]) => <label key={k} className="radio"><input type="radio" name="pri" checked={pol.priority === k} onChange={() => setPol({ ...pol, priority: k })} /><span>{t}<small>{d}</small></span></label>)}</fieldset>
          <div>
            <label>Training focus<select value={pol.focus} onChange={e => setPol({ ...pol, focus: e.target.value as Focus })}><option value="balanced">Balanced development</option><option value="physical">Physical maintenance</option><option value="surface">Surface preparation</option>{ABILITIES.map(a => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}</select></label>
            {pol.focus === 'surface' && <label>Prepare for<select value={pol.surfacePrep ?? 'clay'} onChange={e => setPol({ ...pol, surfacePrep: e.target.value as any })}><option value="hard">Hard</option><option value="clay">Clay</option><option value="grass">Grass</option></select></label>}
            <label>If an entry is rejected<select value={pol.fallback} onChange={e => setPol({ ...pol, fallback: e.target.value as any })}><option value="nearest">Nearest suitable affordable event</option><option value="rest">Rest and train</option></select></label>
            <label>Detail<select value={pol.detail} onChange={e => setPol({ ...pol, detail: e.target.value as any })}><option value="quick">Quick play</option><option value="detailed">Detailed play</option></select></label>
          </div>
        </div>

        {ev && <>
          <h3>{ev.title}</h3>
          <p className="story">{fillText(S, ev.text)}</p>
          <div className="choice-grid one" role="radiogroup" aria-label="Your decision">
            {ev.choices.map((c, i) => <button key={i} role="radio" aria-checked={life === i} className={`choice ${life === i ? 'on' : ''}`} onClick={() => setLife(i)}><b>{fillText(S, c.label)}</b><span>{c.hint}</span></button>)}
          </div>
        </>}
        <div className="commit">
          <p className="muted">Confirming commits this block. About {weeks.length} weeks will be played: entries, travel, training and matches. Results cannot be re-rolled or rewound. A route is not a promise of entry.</p>
          <button className="btn primary big" disabled={!!needLife} onClick={commit}>{needLife ? 'Make your decision above first' : `Confirm and play (${picks.length} ${picks.length === 1 ? 'event' : 'events'})`}</button>
        </div>
      </div>
    </Modal>
  );
}
export function careerHeader(S: State) { const t = totals(S); return `${t.w}–${t.l}`; }
export { EventLogo, SurfaceTag };
