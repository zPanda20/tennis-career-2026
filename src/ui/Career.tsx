import { useEffect, useMemo, useState } from 'react';
import { BAND_NAME, ECON, POINTS } from '../core/balance';
import { Option, Route, WcOffer, blockWeeks, coachReport, eventsInWeek, featuredEvent, fillText, optionFor, routes, wildcardOffers } from '../core/agent';
import { CoachCard, SponsorOffer, WildcardOffers } from './LifePlus';
import { absOf, fmtDate, fmtShort, wkDate } from '../core/content';
import { roundName } from '../core/selectors';
import { weeklyGuaranteed } from '../core/tour';
import { ABILITIES, ABILITY_NAMES, Band, Focus, Intensity, Policies, Priority, State, UMatch, UTourney } from '../core/types';
import { Avatar, BrandMark, EvName, Flag, Stat, money, rankTxt , EventLogo } from './bits';
import { Arrow, Ball, BallRun, Momentum, Ring, SWING_ENDS, SWING_SHORT, SURF_COLOR, seasonOf, tintOf } from './fx';
import { dispatch, get, set, useApp } from './store';
import { getSetting, setSetting } from '../persist/db';
import { MATCH_MODES, MatchModePicker } from './Live';
import { GoalsCard, NewsCard, NewsList, NewsTicker, RivalAlert, RivalTag, nextMeeting, useWatchControls } from './Extras';
import { newsSince } from '../core/news';

const PRIORITIES: [Priority, string, string][] = [['prep', 'Focused preparation', 'More useful training; morale can dip under sustained pressure'], ['recovery', 'Recovery', 'Faster recovery on free weeks; less skill training'], ['social', 'Social life', 'Morale rises; a little sharpness lost to late nights'], ['relationship', 'Relationship time', 'Support and morale; relationships deepen'], ['professional', 'Professional commitments', 'Reputation and sponsor relations; some training time']];
const INTENS: [Intensity, string, string][] = [['relaxed', 'Relaxed', 'Maintenance, kind to the body'], ['normal', 'Normal', 'The sustainable default'], ['intense', 'Intense', 'More growth, more overload risk']];
const FOCUS_NAME = (f: Focus) => (f === 'balanced' ? 'Balanced' : f === 'physical' ? 'Physical' : f === 'surface' ? 'Surface prep' : ABILITY_NAMES[f]);
const PRIO_NAME = (p: Priority) => PRIORITIES.find(x => x[0] === p)![1];
const ROUND_ORDER = ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128', 'RR', 'Q3', 'Q2', 'Q1'];
const HEADLINE: Record<string, string> = { W: 'Champion', F: 'Finalist', SF: 'Semifinalist', QF: 'Quarterfinalist', R16: 'Round of 16', R32: 'Round of 32', R64: 'Round of 64', R128: 'Round of 128', RR: 'Group stage' };
const headline = (r: string) => HEADLINE[r] ?? (r.startsWith('Q') ? 'Qualifying' : roundName(r));
const STATUS: Record<string, [string, string]> = { accepted: ['In', ''], 'likely qualifying': ['Qualifying', 'q'], alternate: ['Alternate', 'warn'], unlikely: ['Long shot', 'crit'] };
const surname = (n: string) => n.split(' ').slice(1).join(' ') || n;

// ---------- shared derived values ----------
const TARGETS = [1000, 750, 500, 400, 300, 250, 200, 150, 100, 75, 50, 30, 20, 10, 5, 3, 2, 1];
function nextTarget(S: State) {
  const r = S.rank[S.userId] ?? 9999, my = S.pts[S.userId] ?? 0, t = TARGETS.find(x => x < r);
  if (!t) return null;
  const need = (S.pts[S.order[t - 1]] ?? 0) + 1, gap = Math.max(1, need - my);
  const band: Band = r > 450 ? 'EP' : r > 220 ? 'SL' : r > 110 ? 'UL' : r > 45 ? 'T250' : r > 15 ? 'T500' : 'T1000';
  const keys = ['R16', 'QF', 'SF', 'F', 'W'], idx = keys.findIndex(k => POINTS[band][['W', 'F', 'SF', 'QF', 'R16'].indexOf(k)] >= gap);
  const hint = idx >= 0 ? `A ${headline(keys[idx]).toLowerCase().replace('champion', 'title').replace('finalist', 'final run').replace('semifinalist', 'semifinal').replace('quarterfinalist', 'quarterfinal')} at ${BAND_NAME[band].toLowerCase()} level would do it` : 'It will take more than one big week';
  return { t, need, my, gap, frac: Math.min(0.99, my / need), hint };
}
function condition(S: State) {
  const p = S.players[S.userId], body = 100 - (0.6 * p.fatigue + 0.4 * p.strain);
  const w = (v: number, words: [number, string][]) => words.find(([x]) => v >= x)?.[1] ?? words[words.length - 1][1];
  return [
    { k: 'Body', v: body, word: p.injuredUntil > S.wk ? 'Injured' : w(body, [[70, 'Fresh'], [45, 'Okay'], [25, 'Tired'], [0, 'Worn out']]), warn: body < 40 || p.injuredUntil > S.wk },
    { k: 'Sharpness', v: p.sharp, word: w(p.sharp, [[70, 'Sharp'], [50, 'Match-ready'], [35, 'Rusty'], [0, 'Very rusty']]), warn: p.sharp < 40 },
    { k: 'Confidence', v: p.conf, word: w(p.conf, [[70, 'High'], [45, 'Steady'], [30, 'Shaky'], [0, 'Low']]), warn: p.conf < 32 },
    { k: 'Morale', v: p.morale, word: w(p.morale, [[65, 'Good'], [45, 'Okay'], [30, 'Dipping'], [0, 'Low']]), warn: p.morale < 45 },
  ];
}
const winsIn = (S: State, t: UTourney) => t.matches.map(id => S.u.matches.find(m => m.id === id)!).filter(m => m && m.won).length;
const played = (t: UTourney) => !!t.reached && t.reached !== 'WD';
function rankAround(S: State, wk: number) { const h = S.u.rankHist; return h.find(x => x.wk >= wk)?.rank ?? S.rank[S.userId]; }
function bestBefore(S: State, t: UTourney) {
  const prev = S.u.tourneys.filter(x => x.wk < t.wk && played(x)).map(x => ROUND_ORDER.indexOf(x.reached)).filter(i => i >= 0);
  return prev.length ? Math.min(...prev) : -1; // no earlier event: nothing to beat yet
}

// ---------- season autopilot: plays each remaining swing on the coach's recommended route ----------
async function autoSeason(S0: State) {
  if (!confirm(`Simulate the rest of ${S0.year}? Each remaining swing uses your coach's recommended route and your current training settings. Optional life decisions are skipped and your coach plays every match. Injuries still stop the simulation so you can choose the rehab.`)) return;
  const from = S0.wk, year = S0.year, mode = S0.u.pol.match ?? 'auto';
  for (let n = 0; n < 4; n++) {
    const s = get().S; if (!s || s.phase !== 'plan' || s.year !== year) break;
    const rs = routes(s), r = rs.find(x => x.recommended) ?? rs[0];
    const ok = await dispatch({ type: 'CommitBlock', plan: { weeks: r.weeks, route: r.key }, pol: { ...s.u.pol, match: 'auto' } }, `Simulating ${SWING_SHORT[s.block].join(' ').toLowerCase()}`);
    if (!ok) return;
  }
  if (mode !== 'auto' && get().S && get().S!.phase !== 'retired') await dispatch({ type: 'SetMatchMode', mode }, 'Saving');
  const s = get().S;
  if (s && s.lastSummary && s.phase !== 'interrupt') set({ overlay: { kind: 'reveal', from } });
}

// ---------- career hub ----------
export function Home({ S }: { S: State }) {
  const { save } = useApp(), u = S.u, me = S.players[S.userId], rep = useMemo(() => coachReport(S), [S]), ro = save === 'readonly';
  const tgt = useMemo(() => nextTarget(S), [S]), cond = useMemo(() => condition(S), [S]);
  const prevRank = u.rankHist.length > 1 ? u.rankHist[Math.max(0, u.rankHist.length - 1 - (S.wk - (S.lastSummary?.fromWk ?? S.wk)))]?.rank : undefined;
  const moved = S.lastSummary ? S.lastSummary.rankFrom - (S.rank[me.id] ?? S.lastSummary.rankTo) : prevRank ? prevRank - S.rank[me.id] : 0;
  const weeks = S.phase === 'plan' ? blockWeeks(S) : [];
  return (
    <>
      <section className="hero">
        <div>
          {S.phase === 'plan' && <>
            <span className="kicker">Up next · {weeks.length ? `${fmtShort(wkDate(weeks[0]))} to ${fmtShort(wkDate(weeks[weeks.length - 1], 6))} · ${weeks.length} weeks` : 'next block'}</span>
            <h1 className="mega"><span>{SWING_SHORT[S.block][0]}</span><span className="ol">{SWING_SHORT[S.block][1]}</span></h1>
            <p className="lede">{u.finalSeasonWarned && S.block === 0 ? 'Your final eligible season. ' : ''}{SWING_ENDS[S.block]}.</p>
            <div className="row" style={{ gap: '1.2rem', marginTop: '1.4rem' }}>
              <button className="cta" disabled={ro} onClick={() => set({ overlay: { kind: 'planner' } })}>Plan the swing<span className="go"><Arrow /></span></button>
              {S.block < 3 && <button className="btn" disabled={ro} onClick={() => autoSeason(S)}>Simulate to season's end</button>}
              {!ro && <label className="mm-inline">Your matches<select value={S.u.pol.match ?? 'auto'} onChange={e => dispatch({ type: 'SetMatchMode', mode: e.target.value as 'auto' | 'big' | 'all' }, 'Saving')}>{MATCH_MODES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>}
            </div>
            <div className="coachline"><Avatar name={u.coach.name.split(' (')[0]} size={46} /><div className="bubble"><b>Coach:</b> "{me.injuredUntil > S.wk ? `Rehab first. You should be back around ${fmtShort(wkDate(me.injuredUntil))}.` : rep.advice}"</div></div>
          </>}
          {S.phase === 'interrupt' && <Interrupt S={S} />}
          {S.phase === 'yearEnd' && <YearEnd S={S} />}
          {S.phase === 'retired' && <><span className="kicker">Career complete</span><h1 className="mega"><span>Game,</span><span className="ol">set, match</span></h1><p className="lede">{me.name} has retired. The full review and exports are in Records.</p><button className="cta" onClick={() => set({ tab: 'records' })}>Career review<span className="go"><Arrow /></span></button></>}
        </div>
        <div className="medal">
          <Ring value={tgt ? tgt.frac : 1} size={300} stroke={16} label={`World ranking ${S.rank[me.id] ?? 'unranked'}${tgt ? `, ${Math.round(tgt.frac * 100)} percent of the way to the top ${tgt.t}` : ''}`}>
            <span className="lbl">World rank</span>
            <span className="big">{S.rank[me.id] ?? '–'}</span>
            {moved !== 0 && <span className={`delta ${moved < 0 ? 'down' : ''}`}>{moved > 0 ? '▲' : '▼'} {Math.abs(moved)} this block</span>}
          </Ring>
          {tgt && <div className="target"><b>{S.pts[me.id] ?? 0} / {tgt.need} pts to the top {tgt.t}</b><small>{tgt.hint}</small></div>}
          {!tgt && S.rank[me.id] === 1 && <div className="target"><b>World No. 1</b></div>}
        </div>
      </section>

      <NewsTicker S={S} />
      <div className="home-grid">
        <div className="col">
          {S.phase === 'plan' && <RivalAlert S={S} />}
          {S.lastSummary && S.phase !== 'yearEnd' && <LastBlock S={S} />}
          {S.lastSummary?.notes.map((n, i) => <p key={i} className="note">{n}</p>)}
          {S.lastSummary?.follow.map((n, i) => <p key={i} className="note story">{fillText(S, n)}</p>)}
          {!S.lastSummary && S.phase === 'plan' && <div className="glass"><p className="eyebrow">Welcome to the tour</p><p className="story">You start 2026 ranked {S.rank[me.id]}, on the lower tour. Plan your first swing, play the weeks, and watch the ring fill.</p></div>}
          <NewsCard S={S} />
        </div>
        <div className="col">
          {S.phase !== 'retired' && <GoalsCard S={S} title={S.phase === 'yearEnd' ? `Goals for ${S.year}` : undefined} />}
          <section className="glass">
            <div className="sec-head"><h3>Condition</h3></div>
            <div className="gauges">{cond.map(c => <div key={c.k} className={`gauge ${c.warn ? 'warn' : ''}`}><Ring value={c.v / 100} size={64} warn={c.warn} label={`${c.k}: ${c.word}`}>{Math.round(c.v)}</Ring><b>{c.k}</b>{c.warn ? <span className="flag">{c.word}</span> : <small>{c.word}</small>}</div>)}</div>
          </section>
          <section className="glass">
            <div className="sec-head"><h3>Coach's view</h3><small>{u.coach.name.split(' (')[0]}</small></div>
            <p>{rep.potential} {rep.room}</p><p className="muted">{rep.strengths}</p>
          </section>
          <section className="glass">
            <div className="sec-head"><h3>Money</h3><small>career dollars</small></div>
            <div className="stats"><Stat k="Cash" v={money(u.cash)} sub={u.cash < 1 ? 'Basic support covers short trips' : u.cash < ECON.reserve ? 'Tight' : u.cash < 6000 ? 'Careful' : 'Comfortable'} /><Stat k="Monthly before events" v={money(weeklyGuaranteed(S) * 52 / 12)} /></div>
            {u.sponsors.length > 0 && <div className="brands">{u.sponsors.map(s => <BrandMark key={s.id} sp={s} />)}</div>}
          </section>
          {u.ach.length > 0 && <section className="glass"><div className="sec-head"><h3>Milestones</h3></div><ul className="plain">{u.ach.slice(-4).reverse().map(a => <li key={a.id}><b>{a.name}</b> <small>{a.date.slice(0, 4)}</small></li>)}</ul></section>}
          {S.phase === 'plan' && !ro && <button className="btn ghost small" onClick={() => { if (confirm('Retire now? Your career will be closed and frozen. This cannot be undone.')) dispatch({ type: 'Retire' }, 'Closing your career').then(ok => ok && set({ tab: 'records' })); }}>Retire from professional tennis</button>}
        </div>
      </div>
    </>
  );
}
function LastBlock({ S }: { S: State }) {
  const sum = S.lastSummary!, ts = sum.tourneys.map(id => S.u.tourneys.find(t => t.ed === id)!).filter(Boolean);
  const best = ts.filter(played).sort((a, b) => b.pts - a.pts || ROUND_ORDER.indexOf(a.reached) - ROUND_ORDER.indexOf(b.reached))[0];
  return (
    <section className="glass">
      <div className="sec-head"><h3>Last block</h3></div>
      {ts.length ? <div className="strip">{ts.map(t => {
        const ok = played(t), w = ok ? winsIn(S, t) : 0;
        return (
          <button key={t.ed} className={`tcard ${t === best && ok ? 'best' : ''}`} onClick={() => set({ overlay: { kind: 'tourney', ed: t.ed } })}>
            <span className="meta"><span className="surf" style={{ textTransform: 'uppercase' }}><i style={{ background: SURF_COLOR[t.surface] }} />{t.surface} · {t.dates.split(' – ')[0]}</span>{t === best && ok && <span className="pill ok">Best</span>}</span>
            <span className="nm"><EventLogo slam={S.cal.find(e => e.series === t.series)?.slam} band={t.band} tour={S.tour} size={22} className="evlogo sm" /><EvName name={t.name} surface={t.surface} /></span>
            {ok ? <BallRun wins={w} lost={!t.title} label={`${w} wins${t.title ? ', title' : ', then a loss'}`} /> : <small>{t.note ?? (t.status === 'ALT' ? 'Ranking too low to get in' : 'Withdrew')}</small>}
            <span className="rd">{ok ? headline(t.reached) : t.status === 'ALT' ? 'Not accepted' : 'Withdrew'}</span>
            <span className="pz">{ok ? `${t.pts ? `+${t.pts} pts · ` : ''}${money(t.prize)}` : ''}</span>
          </button>);
      })}</div> : <p className="muted">A training block: no tournaments were played.</p>}
      {sum.newAch.length > 0 && <p className="ok-box">Milestones: {sum.newAch.join(' · ')}</p>}
    </section>
  );
}

// ---------- interruptions ----------
function Interrupt({ S }: { S: State }) {
  const u = S.u, pend = S.pending!, inj = u.injuries.find(i => i.id === pend.injury), { save } = useApp(), ro = save === 'readonly';
  if (pend.type === 'forcedRetire') return <><span className="kicker">Medical assessment</span><h1 className="mega"><span>Your career</span><span className="ol">ends here</span></h1><p className="lede">{pend.text}</p><button className="cta" disabled={ro} onClick={() => dispatch({ type: 'ResolveInjury', rehab: 'conservative' }, 'Closing your career').then(ok => ok && set({ tab: 'records' }))}>Career review<span className="go"><Arrow /></span></button></>;
  if (!inj) return null;
  const cost = inj.sev === 'moderate' ? 1500 : inj.sev === 'major' ? 6000 : 15000;
  const go = (rehab: 'conservative' | 'specialist' | 'early') => dispatch({ type: 'ResolveInjury', rehab }, 'Back to the season').then(ok => { const s = get().S; if (ok && s?.lastSummary && (s.phase === 'plan' || s.phase === 'yearEnd')) set({ overlay: { kind: 'reveal' } }); });
  return (
    <>
      <span className="kicker">Injury review · {inj.date}</span>
      <h1 className="mega"><span>{inj.sev}</span><span className="ol">{inj.loc === 'general illness' ? 'illness' : inj.loc}</span></h1>
      <p className="lede">{inj.desc} Expected absence: <b>{inj.estMin} to {inj.estMax} weeks</b>. Entries during the absence have been cancelled.{inj.perm ? ' The scan shows damage that will not fully heal.' : ''}</p>
      <div className="choice-grid">
        <button className="choice" disabled={ro} onClick={() => go('conservative')}><b>Conservative rehab</b><span>The safe default, covered by basic support. No added risk.</span></button>
        <button className="choice" disabled={ro || u.cash < cost} onClick={() => go('specialist')}><b>Specialist care · {money(cost)}</b><span>{u.cash < cost ? 'Not affordable right now.' : 'Likely a shorter absence. Support, not a guaranteed recovery.'}</span></button>
        <button className="choice" disabled={ro} onClick={() => go('early')}><b>Push for an early return</b><span>Back sooner, with a clearly higher chance of a setback over the next three months.</span></button>
      </div>
    </>
  );
}
function YearEnd({ S }: { S: State }) {
  const u = S.u, pend = S.pending!, s = u.seasons[u.seasons.length - 1], { save } = useApp(), ro = save === 'readonly';
  const [coach, setCoach] = useState('keep'), [sp, setSp] = useState<Record<string, string>>({}), [ret, setRet] = useState(false);
  if (pend.type === 'forcedRetire') return <><span className="kicker">End of the {s.year} season</span><h1 className="mega"><span>Time to say</span><span className="ol">goodbye</span></h1><p className="lede">{pend.text}</p><button className="cta" disabled={ro} onClick={() => dispatch({ type: 'YearEnd', coach: 'keep', sponsors: [], retire: false }, 'Closing your career').then(ok => ok && set({ tab: 'records' }))}>Career review<span className="go"><Arrow /></span></button></>;
  const slots = ['apparel', 'racket', 'partner'].filter(sl => pend.sponsorOffers?.some(o => o.slot === sl));
  return (
    <>
      <span className="kicker">Season review</span>
      <h1 className="mega"><span>{s.year}</span><span className="ol">year-end {s.rank}</span></h1>
      <div className="stats"><Stat k="Record" v={`${s.w}–${s.l}`} sub={`${s.events} events`} /><Stat k="Titles" v={s.titles} sub={`${s.finals} finals`} /><Stat k="Best major" v={s.majorsBest === '–' ? '–' : headline(s.majorsBest)} /><Stat k="Prize" v={money(s.prize)} /><Stat k="Growth" v={`+${s.dev.toFixed(1)}`} sub={`${Math.round((s.devComp / (s.dev || 1)) * 100)}% from matches`} /><Stat k="Weeks injured" v={s.injWeeks} /></div>
      {(u.goals ?? []).some(g => g.year === s.year) && <div style={{ marginTop: '1rem' }}><GoalsCard S={S} year={s.year} title={`${s.year} season goals`} /></div>}
      {u.finalSeasonWarned && <p className="warn-box">Next season is your final eligible season: the age ceiling closes a career at the end of the season in which a player turns 40.</p>}
      <h2 style={{ marginTop: '1.2rem' }}>Coaching</h2>
      <div className="choice-grid coachgrid" role="radiogroup" aria-label="Coach for next season">
        <button className={`choice coachpick ${coach === 'keep' ? 'on' : ''}`} role="radio" aria-checked={coach === 'keep'} onClick={() => setCoach('keep')}><small className="eyebrow" style={{ margin: 0 }}>Stay with your coach</small><CoachCard c={u.coach} current trust={u.rel.coach} /></button>
        {pend.coachOffers?.map(c => <button key={c.id} className={`choice coachpick ${coach === c.id ? 'on' : ''}`} role="radio" aria-checked={coach === c.id} onClick={() => setCoach(c.id)}><small className="eyebrow" style={{ margin: 0 }}>Offer · contract through {c.until - 1}</small><CoachCard c={c} /></button>)}
      </div>
      {slots.length > 0 && <><h2 style={{ marginTop: '1.2rem' }}>Sponsor offers</h2>{slots.map(sl => (
        <div key={sl} className="choice-grid" role="radiogroup" aria-label={`${sl} sponsor`}>
          <p className="eyebrow cap">{sl === 'partner' ? 'Commercial partner' : sl}</p>
          <button className={`choice slim ${!sp[sl] ? 'on' : ''}`} role="radio" aria-checked={!sp[sl]} onClick={() => setSp({ ...sp, [sl]: '' })}><b>No deal</b></button>
          {pend.sponsorOffers!.filter(o => o.slot === sl).map(o => <button key={o.id} className={`choice slim ${sp[sl] === o.id ? 'on' : ''}`} role="radio" aria-checked={sp[sl] === o.id} onClick={() => setSp({ ...sp, [sl]: o.id })}><SponsorOffer o={o} /></button>)}
        </div>))}</>}
      <label className="check"><input type="checkbox" checked={ret} onChange={e => setRet(e.target.checked)} /><span>Retire now instead of playing {S.year}<small>Closes and freezes the career.</small></span></label>
      <div className="row"><button className="cta" disabled={ro} onClick={() => { if (ret && !confirm('Retire now? This cannot be undone.')) return; dispatch({ type: 'YearEnd', coach, sponsors: Object.values(sp).filter(Boolean), retire: ret }, ret ? 'Closing your career' : `Welcome to ${S.year}`).then(ok => ok && ret && set({ tab: 'records' })); }}>{ret ? 'Retire' : `Start ${S.year}`}<span className="go"><Arrow /></span></button></div>
    </>
  );
}

// ---------- planner: route, decision, play ----------
function meters(S: State, r: Route, budget: number) {
  const ps = r.picks, avg = ps.reduce((t, o) => t + o.p, 0) / (ps.length || 1), long = ps.filter(o => o.tc === 2).length, reg = ps.filter(o => o.tc === 1).length;
  const diff = !ps.length ? 0 : avg >= 0.7 ? 1 : avg >= 0.55 ? 2 : avg >= 0.4 ? 3 : avg >= 0.25 ? 4 : 5;
  const trav = !ps.length ? 0 : long >= 3 ? 5 : long === 2 ? 4 : long === 1 ? 3 : reg ? 2 : 1;
  const ratio = r.cost / Math.max(1, budget), cost = !ps.length ? 0 : ratio < 0.15 ? 1 : ratio < 0.3 ? 2 : ratio < 0.5 ? 3 : ratio < 0.8 ? 4 : 5;
  return [{ k: 'Difficulty', n: diff, w: ['none', 'easy', 'comfortable', 'even', 'tough', 'very tough'][diff] }, { k: 'Travel', n: trav, w: ['none', 'close to home', 'regional', 'one long trip', 'two long trips', 'lots of flying'][trav] }, { k: 'Cost', n: cost, w: money(r.cost) }];
}
function Pips({ n, label }: { n: number; label: string }) { return <span className="pips" role="img" aria-label={label}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? 'on' : ''} />)}</span>; }
function CourtCorner() { return <svg aria-hidden="true" viewBox="0 0 410 140" preserveAspectRatio="xMinYMax slice"><g fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="3"><path d="M24 128 H400 M64 128 V10 M104 128 V10 M104 54 H400 M300 54 V128" /></g></svg>; }

export function Planner({ S }: { S: State }) {
  const u = S.u, rs = useMemo(() => { const all = routes(S), some = all.filter(r => r.picks.length || r.key === 'recovery'); return some.length ? some : all.slice(0, 1); }, [S]), ev = useMemo(() => featuredEvent(S), [S]), weeks = useMemo(() => blockWeeks(S), [S]);
  const rec = rs.find(r => r.recommended) ?? rs[0];
  const [step, setStep] = useState(0), [key, setKey] = useState<string>(rec.key), [plan, setPlan] = useState<Record<number, string>>(rec.weeks);
  const wcOffers = useMemo(() => wildcardOffers(S), [S]), [wc, setWc] = useState<string[]>([]);
  const acceptWc = (o: WcOffer, yes: boolean) => { const next = { ...plan }; if (yes) { next[o.ed.startWk] = o.ed.id; setWc([...wc, o.ed.id]); } else { if (next[o.ed.startWk] === o.ed.id) delete next[o.ed.startWk]; setWc(wc.filter(x => x !== o.ed.id)); } setPlan(next); setKey('custom'); };
  const isWc = (id: string) => wc.includes(id) && Object.values(plan).includes(id);
  const [pol, setPol] = useState<Policies>({ ...u.pol }), [life, setLife] = useState<number | null>(null), [custom, setCustom] = useState(false), [train, setTrain] = useState(false);
  const income = Math.max(0, weeklyGuaranteed(S)) * weeks.length, budget = u.cash + income;
  const optById = (id: string): Option | null => { const ed = S.cal.find(e => e.id === id); return ed ? optionFor(S, ed) : null; };
  const picks = Object.values(plan).map(optById).filter(Boolean) as Option[], cost = picks.reduce((t, o) => t + o.cost, 0);
  const busy = (w: number, skip?: string): string | null => {
    for (const [k, id] of Object.entries(plan)) { if (id === skip) continue; const ed = S.cal.find(e => e.id === id)!, o = optionFor(S, ed); if (ed.weeks === 2 && +k + 1 === w) return `second week of ${ed.name}`; if (ed.band === 'GS' && o.status !== 'accepted' && +k - 1 === w) return `qualifying for ${ed.name}`; }
    return null;
  };
  const choose = (r: Route) => { setKey(r.key); setPlan({ ...r.weeks }); setCustom(false); };
  const setWeek = (w: number, id: string) => { const next = { ...plan }; if (id) { next[w] = id; const ed = S.cal.find(e => e.id === id)!; if (ed.weeks === 2) delete next[w + 1]; if (ed.band === 'GS' && optionFor(S, ed).status !== 'accepted') delete next[w - 1]; } else delete next[w]; setPlan(next); setKey('custom'); };
  const steps = ev ? ['Route', 'Decision', 'Play'] : ['Route', 'Play'], last = steps.length - 1;
  const commit = () => dispatch({ type: 'CommitBlock', plan: { weeks: plan, route: key, wc: wc.filter(isWc), lifeEv: ev?.id, lifeChoice: life ?? undefined }, pol }, 'Playing the swing').then(ok => { const s = get().S; set({ overlay: ok && (s?.phase === 'plan' || s?.phase === 'yearEnd') && s.lastSummary?.tourneys.some(id => played(s.u.tourneys.find(t => t.ed === id)!)) ? { kind: 'reveal' } : null }); });
  const playedWeeks = new Set<number>(); for (const o of picks) { playedWeeks.add(o.ed.startWk); if (o.ed.weeks === 2) playedWeeks.add(o.ed.startWk + 1); }
  const close = () => set({ overlay: null });
  return (
    <div className="screen" role="dialog" aria-modal="true" aria-label="Plan the swing">
      <div className="screen-in">
        <div className="screen-top">
          <button className="icon" aria-label="Back to career" onClick={step ? () => setStep(step - 1) : close}><Arrow back /></button>
          <div><div className="k">Plan · {fmtShort(wkDate(weeks[0]))} to {fmtShort(wkDate(weeks[weeks.length - 1], 6))} · {weeks.length} weeks</div><div className="t">{SWING_SHORT[S.block].join(' ')}</div></div>
          <ol className="stepper" aria-label="Planning steps">{steps.map((t, i) => <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{i > 0 && <span className="bar-s" aria-hidden="true" />}<span className="n">{i + 1}</span><span className="lbl">{t}</span></li>)}</ol>
        </div>

        {step === 0 && <>
          <h1>Choose your path</h1>
          <div className="routes" role="radiogroup" aria-label="Route">
            {rs.map((r, i) => {
              const wk = new Set<number>(); r.picks.forEach(o => { wk.add(o.ed.startWk); if (o.ed.weeks === 2) wk.add(o.ed.startWk + 1); });
              return (
                <button key={r.key} role="radio" aria-checked={key === r.key} className={`route ${key === r.key ? 'on' : ''}`} onClick={() => choose(r)}>
                  <span className="art"><CourtCorner /><span className="no" aria-hidden="true">0{i + 1}</span>{r.recommended && <span className="pick">Coach's pick</span>}</span>
                  <span className="body">
                    <span><span className="title">{r.label}</span><span className="muted" style={{ display: 'block', marginTop: '.25rem' }}>{r.intent}</span></span>
                    <span className="weekballs" role="img" aria-label={`Plays ${wk.size} of ${weeks.length} weeks`}>{weeks.map(w => <Ball key={w} size={22} empty={!wk.has(w)} />)}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>{r.picks.map(o => <span key={o.ed.id} className="ev"><span><b><EvName name={o.ed.name} surface={o.ed.surface} /></b> <small>{fmtShort(wkDate(o.ed.startWk))}</small> <RivalTag S={S} ed={o.ed} /></span><span className={`pill ${STATUS[o.status][1]}`}>{STATUS[o.status][0]}</span></span>)}{!r.picks.length && <span className="muted">No suitable events. A training block.</span>}</span>
                    <span className="meters">{meters(S, r, budget).map(m => <span key={m.k}><span className="k">{m.k}</span><Pips n={m.n} label={`${m.k}: ${m.w}`} /></span>)}</span>
                  </span>
                </button>);
            })}
          </div>
          <WildcardOffers S={S} offers={wcOffers} plan={plan} wc={wc} accept={acceptWc} />
          <div className="row"><button className="link" aria-expanded={custom} onClick={() => setCustom(!custom)}>{custom ? 'Hide week-by-week schedule' : 'Build my own schedule week by week'}</button></div>
          {custom && <div className="glass weeks">
            {weeks.map(w => {
              const why = busy(w), evs = eventsInWeek(S, w).map(e => optionFor(S, e)).sort((a, b) => ['accepted', 'likely qualifying', 'alternate', 'unlikely'].indexOf(a.status) - ['accepted', 'likely qualifying', 'alternate', 'unlikely'].indexOf(b.status) || b.ed.draw - a.ed.draw), cur = plan[w] ? optById(plan[w]) : null;
              return (
                <div key={w} className="week">
                  <label htmlFor={`wk${w}`}><b>{fmtShort(wkDate(w))}</b></label>
                  {why ? <span className="muted">Occupied: {why}</span> : <select id={`wk${w}`} value={plan[w] ?? ''} onChange={e => setWeek(w, e.target.value)}><option value="">Train this week</option>{evs.map(o => <option key={o.ed.id} value={o.ed.id}>{o.ed.name} · {o.ed.cat} · {o.ed.surface} · {STATUS[o.status][0]} · {money(o.cost)}</option>)}</select>}
                  {cur && !why && <small>{BAND_NAME[cur.ed.band]} in {cur.ed.city}. Against a typical opponent you'd be {cur.p < 0.35 ? 'the underdog' : cur.p > 0.65 ? 'the favourite' : 'evenly matched'}{cur.ed.prov ? '. Provisional calendar entry' : ''}{cur.ed.weeks === 2 ? '. Runs two weeks' : ''}.</small>}
                </div>);
            })}
          </div>}
          {train && <TrainingPanel pol={pol} setPol={setPol} />}
        </>}

        {ev && step === 1 && <div className="decision">
          <span className="kicker">One decision this block</span>
          <h1 style={{ marginTop: '.8rem' }}>{ev.title}</h1>
          <p className="story">{fillText(S, ev.text)}</p>
          <div className="choice-grid" role="radiogroup" aria-label="Your decision">{ev.choices.map((c, i) => <button key={i} role="radio" aria-checked={life === i} className={`choice ${life === i ? 'on' : ''}`} onClick={() => setLife(i)}><b>{fillText(S, c.label)}</b><span>{c.hint}</span></button>)}</div>
        </div>}

        {step === last && <>
          <h1>Ready to play</h1>
          {(() => { const nm = nextMeeting(S, weeks, plan); return nm ? <p className="rival-note">⚔ <b>Next meeting:</b> your rival {S.players[nm.id].name} is {nm.how === 'entered' ? 'entered at' : nm.how === 'likely' ? 'likely at' : 'a possible entry at'} <EvName name={nm.ed.name} surface={nm.ed.surface} />.</p> : null; })()}
          <section className="glass" style={{ marginTop: '1.2rem' }}>
            <div className="sec-head"><h3>Your matches</h3><small>change any time</small></div>
            <MatchModePicker value={pol.match ?? 'auto'} onChange={m => setPol({ ...pol, match: m })} />
          </section>
          <div className="panel2" style={{ marginTop: '1.2rem' }}>
            <section className="glass">
              <div className="sec-head"><h3>Your schedule</h3><small>{picks.length} {picks.length === 1 ? 'event' : 'events'}</small></div>
              <span className="weekballs" role="img" aria-label={`Plays ${playedWeeks.size} of ${weeks.length} weeks`}>{weeks.map(w => <Ball key={w} size={24} empty={!playedWeeks.has(w)} />)}</span>
              <ul className="list" style={{ marginTop: '.8rem' }}>{picks.sort((a, b) => a.ed.startWk - b.ed.startWk).map(o => <li key={o.ed.id} className="rowbtn static"><span className="grow"><b><EvName name={o.ed.name} surface={o.ed.surface} /></b> <RivalTag S={S} ed={o.ed} /><small>{fmtShort(wkDate(o.ed.startWk))} · {o.ed.cat} · {o.ed.surface}</small></span>{isWc(o.ed.id) ? <span className="pill ok">Wildcard</span> : <span className={`pill ${STATUS[o.status][1]}`}>{STATUS[o.status][0]}</span>}</li>)}</ul>
              {!picks.length && <p className="muted">A training block with no events.</p>}
            </section>
            <section className="glass">
              <div className="sec-head"><h3>Budget</h3><small>career dollars</small></div>
              <div className="stats"><Stat k="Cash now" v={money(u.cash)} /><Stat k="Trips" v={money(-cost)} /><Stat k="Guaranteed income" v={money(income)} /><Stat k="Before winnings" v={money(u.cash - cost + income)} sub={u.cash - cost + income < ECON.reserve ? 'below your reserve' : 'reserve intact'} /></div>
              {ev && life !== null && <p className="note"><b>{ev.title}:</b> {fillText(S, ev.choices[life].label)}</p>}
              <p className="muted">Results can't be re-rolled or rewound. A route isn't a promise of entry; your agent finds a replacement if one falls through.</p>
            </section>
          </div>
          {train && <TrainingPanel pol={pol} setPol={setPol} />}
        </>}
      </div>

      <div className="dock">
        <div className="grow"><span className="muted">Training:</span> <b>{INTENS.find(x => x[0] === pol.intensity)![1]} · {FOCUS_NAME(pol.focus)} · {PRIO_NAME(pol.priority)}</b> <button className="link" style={{ marginLeft: '.5rem' }} aria-expanded={train} onClick={() => setTrain(!train)}>{train ? 'Done' : 'Change'}</button></div>
        {step < last
          ? <button className="cta" disabled={step === 1 && life === null} onClick={() => setStep(step + 1)}>{step === 1 && life === null ? 'Choose above' : 'Continue'}<span className="go"><Arrow /></span></button>
          : <button className="cta" onClick={commit}>Play the swing<span className="go"><Arrow /></span></button>}
      </div>
    </div>
  );
}
function TrainingPanel({ pol, setPol }: { pol: Policies; setPol: (p: Policies) => void }) {
  return (
    <section className="glass" style={{ marginTop: '1rem' }}>
      <div className="sec-head"><h3>Training and time off court</h3><small>carries over to future blocks</small></div>
      <div className="form cols">
        <fieldset><legend>Intensity</legend>{INTENS.map(([k, t, d]) => <label key={k} className="radio"><input type="radio" name="int" checked={pol.intensity === k} onChange={() => setPol({ ...pol, intensity: k })} /><span>{t}<small>{d}</small></span></label>)}</fieldset>
        <fieldset><legend>Away from court</legend>{PRIORITIES.map(([k, t, d]) => <label key={k} className="radio"><input type="radio" name="pri" checked={pol.priority === k} onChange={() => setPol({ ...pol, priority: k })} /><span>{t}<small>{d}</small></span></label>)}</fieldset>
        <div className="form">
          <label>Training focus<select value={pol.focus} onChange={e => setPol({ ...pol, focus: e.target.value as Focus })}><option value="balanced">Balanced development</option><option value="physical">Physical maintenance</option><option value="surface">Surface preparation</option>{ABILITIES.map(a => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}</select></label>
          {pol.focus === 'surface' && <label>Prepare for<select value={pol.surfacePrep ?? 'clay'} onChange={e => setPol({ ...pol, surfacePrep: e.target.value as any })}><option value="hard">Hard</option><option value="clay">Clay</option><option value="grass">Grass</option></select></label>}
          <label>If an entry falls through<select value={pol.fallback} onChange={e => setPol({ ...pol, fallback: e.target.value as any })}><option value="nearest">Find the nearest suitable event</option><option value="rest">Rest and train</option></select></label>
        </div>
      </div>
    </section>
  );
}

// ---------- watch mode: game by game, set by set, match by match, highlights, event by event, or summary ----------
export type Pace = 'game' | 'set' | 'match' | 'top' | 'event' | 'summary';
const PACES: [Pace, string, string][] = [['game', 'Game by game', 'Every game of every match'], ['set', 'Set by set', 'Each set in turn'], ['match', 'Match by match', 'One result at a time'], ['top', 'Top player', 'Big matches game by game, the rest match by match'], ['event', 'Event by event', 'Tournament results only'], ['summary', 'Summary only', 'Straight to the totals']];
const DELAY: Record<string, number> = { game: 750, set: 1900, match: 2800, event: 4500 };
type Step = { k: 'match'; ti: number; mi: number; sets: number; g?: number } | { k: 'event'; ti: number } | { k: 'summary' };
const order = (s: Step) => (s.k === 'summary' ? 1e9 : s.k === 'event' ? s.ti * 1000 + 999 : s.ti * 1000 + s.mi * 10);
function parseSets(m: UMatch): [number, number, number?][] {
  if (m.sets) return m.sets;
  return m.score.replace(' ret.', '').split(' ').filter(x => /\d-\d/.test(x)).map(x => { const [a, b] = x.split('(')[0].split('-').map(Number); return m.won ? [a, b] : [b, a]; });
}
/** A big match: a final, a Tour Finals match, a rival, or one that went to a deciding set or a tiebreak. */
function isKey(S: State, t: UTourney, m: UMatch): boolean {
  if (m.cls === 'wo') return false;
  if (m.round === 'F' || t.band === 'F') return true;
  if (S.u.rivals.includes(m.opp) || S.u.matches.filter(x => x.opp === m.opp && x.wk < m.wk && x.cls !== 'wo').length >= 2) return true;
  const sets = parseSets(m), a = sets.filter(s => s[0] > s[1]).length, b = sets.length - a;
  return sets.length > Math.max(a, b) || sets.some(s => s[2] !== undefined);
}
function gameSteps(out: Step[], ti: number, mi: number, m: UMatch) {
  const L = parseSets(m).length;
  if (!m.flow || m.cls === 'wo') { out.push({ k: 'match', ti, mi, sets: L }); return; }
  for (let g = 1; g <= m.flow.length; g++) out.push({ k: 'match', ti, mi, sets: L, g });
}
function buildSteps(S: State, items: UTourney[], ms: UMatch[][], pace: Pace): Step[] {
  const out: Step[] = [];
  if (pace !== 'summary') ms.forEach((list, ti) => {
    if (pace !== 'event') list.forEach((m, mi) => {
      const L = m.cls === 'wo' ? 0 : parseSets(m).length;
      if (pace === 'game' || (pace === 'top' && isKey(S, items[ti], m))) gameSteps(out, ti, mi, m);
      else if (pace === 'set' && L > 1) for (let k = 1; k <= L; k++) out.push({ k: 'match', ti, mi, sets: k });
      else out.push({ k: 'match', ti, mi, sets: L });
    });
    out.push({ k: 'event', ti });
  });
  out.push({ k: 'summary' });
  return out;
}
/** Score state after `g` games: completed sets, the set in progress, and whether a set just ended. */
function scoreAt(m: UMatch, g: number) {
  const sets = parseSets(m), flow = (m.flow ?? '').split('').map(Number), done: [number, number, number?][] = [];
  let i = 0;
  for (const s of sets) {
    const len = s[0] + s[1];
    if (i + len <= g) { done.push(s); i += len; continue; }
    let a = 0, b = 0; for (let k = i; k < g; k++) flow[k] ? a++ : b++;
    return { done, live: a + b > 0 ? ([a, b] as [number, number]) : null, setNo: done.length + 1, boundary: a + b === 0 };
  }
  return { done, live: null, setNo: done.length, boundary: true };
}
/** Watch the swing (or several swings) just played. `from` is the first week to include. */
function KeysHint() {
  const [hide, setHide] = useState(() => getSetting('hideKeys', '0') === '1'), flip = (v: boolean) => { setSetting('hideKeys', v ? '1' : '0'); setHide(v); };
  if (hide) return <span className="grow keys-hint off"><button className="keys-show" onClick={() => flip(false)} aria-label="Show keyboard and controller shortcuts" title="Show shortcuts">⌨</button></span>;
  return (
    <span className="grow keys-hint"><span aria-hidden="true"><kbd>Space</kbd> play/pause <kbd>←</kbd><kbd>→</kbd> step <kbd>Shift</kbd>+<kbd>→</kbd> end of match <kbd>S</kbd> summary · 🎮 A next · B back · X pause</span>
      <button className="keys-x" onClick={() => flip(true)} aria-label="Hide shortcut hints" title="Hide">×</button></span>
  );
}

export function Reveal({ S, from }: { S: State; from?: number }) {
  const u = S.u, sum = S.lastSummary, start = from ?? sum?.fromWk ?? S.wk, end = sum?.toWk ?? S.wk;
  const items = useMemo(() => u.tourneys.filter(t => t.wk >= start && t.wk < end && played(t)).sort((a, b) => a.wk - b.wk), [S, start]);
  const ms = useMemo(() => items.map(t => t.matches.map(id => u.matches.find(m => m.id === id)!).filter(Boolean)), [items]);
  const [pace, setPaceRaw] = useState<Pace>(() => (getSetting('pace', 'top') as Pace));
  const steps = useMemo(() => buildSteps(S, items, ms, pace), [ms, pace]);
  const [i, setI] = useState(0), [playing, setPlaying] = useState(pace !== 'event' && pace !== 'summary');
  const step = steps[Math.min(i, steps.length - 1)];
  const setPace = (p: Pace) => { const base = order(step), ns = buildSteps(S, items, ms, p), j = ns.findIndex(s => order(s) >= base); setSetting('pace', p); setPaceRaw(p); setI(j < 0 ? ns.length - 1 : j); if (p === 'summary') setPlaying(false); };
  useEffect(() => {
    if (!playing || step.k === 'summary') return;
    const next = steps[i + 1], d = step.k === 'event' ? DELAY.event : step.g !== undefined ? (next?.k === 'match' && next.g !== undefined && next.mi === step.mi ? DELAY.game : DELAY.match) : pace === 'set' ? DELAY.set : DELAY.match;
    const id = setTimeout(() => setI(x => Math.min(x + 1, steps.length - 1)), d);
    return () => clearTimeout(id);
  }, [playing, i, pace, steps.length]);
  const close = () => set({ overlay: null }), cur = step.k === 'summary' ? items.length : step.ti;
  const toEnd = () => { if (step.k !== 'match') return; const j = steps.findIndex((s, k) => k > i && !(s.k === 'match' && s.ti === step.ti && s.mi === step.mi)); setI(j < 0 ? steps.length - 1 : j - 1); };
  useWatchControls({
    toggle: () => { if (step.k !== 'summary') setPlaying(p => !p); },
    next: () => { if (step.k === 'summary') close(); else setI(x => Math.min(x + 1, steps.length - 1)); },
    back: () => { setPlaying(false); setI(x => Math.max(0, x - 1)); },
    end: toEnd, summary: () => { setPlaying(false); setI(steps.length - 1); }, close,
  });
  const multi = from !== undefined && !!sum && from < sum.fromWk;
  const nextLabel = step.k === 'event' ? (steps[i + 1]?.k === 'summary' ? 'Summary' : 'Next event') : step.k === 'match' && step.g !== undefined && steps[i + 1]?.k === 'match' && (steps[i + 1] as any).mi === step.mi ? 'Next game' : step.k === 'match' && pace === 'set' && step.sets < parseSets(ms[step.ti][step.mi]).length ? 'Next set' : 'Next';
  return (
    <div className={`screen s-${step.k === 'summary' || !items[cur] ? tintOf(S) : seasonOf(items[cur].wk)}`} role="dialog" aria-modal="true" aria-label="Block results">
      <div className="screen-in">
        <div className="screen-top">
          <div><div className="k">{multi ? 'Season' : 'Swing'} results · {multi ? fmtDate(wkDate(start)) : fmtShort(wkDate(start))} to {multi ? fmtDate(wkDate(end - 1, 6)) : fmtShort(wkDate(end - 1, 6))}</div><div className="t">{step.k === 'summary' ? 'The summary' : items[cur] && <><EventLogo slam={S.cal.find(e => e.series === items[cur].series)?.slam} band={items[cur].band} tour={S.tour} size={34} className="evlogo top" /><EvName name={items[cur].name} surface={items[cur].surface} /></>}</div></div>
          <span className="dots" style={{ margin: '0 auto' }} role="img" aria-label={`Event ${Math.min(cur + 1, items.length)} of ${items.length}`}>{items.slice(Math.max(0, Math.min(cur - 6, items.length - 12)), Math.max(12, cur + 6)).map(t => { const k = items.indexOf(t); return <Ball key={k} size={k === cur ? 28 : 18} empty={k > cur} glow={k === cur} />; })}<b style={{ marginLeft: '.3rem' }}>{step.k !== 'summary' ? `${cur + 1} of ${items.length}` : 'Summary'}</b></span>
          {step.k !== 'summary' && <button className="btn" onClick={() => { setPlaying(false); setI(steps.length - 1); }}>Skip to summary</button>}
        </div>
        {step.k === 'match' && <MatchStage S={S} t={items[step.ti]} list={ms[step.ti]} mi={step.mi} sets={step.sets} g={step.g} />}
        {step.k === 'event' && <EventReveal S={S} t={items[step.ti]} />}
        {step.k === 'summary' && <RangeSummary S={S} from={start} multi={multi} items={items} />}
      </div>
      <div className="dock">
        <label className="pace">Watch<select value={pace} onChange={e => setPace(e.target.value as Pace)} aria-label="Watch pace">{PACES.map(([k, t, d]) => <option key={k} value={k}>{t} · {d}</option>)}</select></label>
        {step.k !== 'summary' && <button className="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>{playing ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg> : <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>}</button>}
        {step.k === 'match' && step.g !== undefined && <button className="btn small" onClick={toEnd}>To end of match</button>}
        <KeysHint />
        {i > 0 && <button className="btn" onClick={() => { setPlaying(false); setI(i - 1); }}>Back</button>}
        {step.k !== 'summary'
          ? <button className="cta" onClick={() => setI(i + 1)}>{nextLabel}<span className="go"><Arrow /></span></button>
          : <button className="cta" onClick={close}>{S.phase === 'yearEnd' ? 'Season review' : 'Back to career'}<span className="go"><Arrow /></span></button>}
      </div>
    </div>
  );
}
export function Plates({ S, m, done, children }: { S: State; m: UMatch; done: boolean; children: React.ReactNode }) {
  const me = S.players[S.userId], opp = S.players[m.opp];
  return (
    <div className="versus">
      <div className={`plate ${done && m.won ? 'win' : ''}`}><Avatar p={me} size={110} user={S.u.avatar} />{done && m.won && <span className="wtag">WINNER</span>}<span className="nm">{me.name}</span><small><Flag c={me.country} size={15} /> {me.country} · ranked {m.myRank}</small></div>
      {children}
      <div className={`plate ${done && !m.won ? 'win' : ''}`}>{opp ? <Avatar p={opp} size={110} /> : <Avatar name={m.oppName} size={110} />}{done && !m.won && <span className="wtag">WINNER</span>}<span className="nm">{m.oppName}</span><small><Flag c={m.oppCountry} size={15} /> {m.oppCountry} · ranked {m.oppRank}{m.oppReal ? '' : ' · fictional'}</small></div>
    </div>
  );
}
export type Col = { a: number; b: number; tb?: number; live?: boolean; pend?: boolean };
export function Board({ S, m, cols, done, note }: { S: State; m: UMatch; cols: Col[]; done: boolean; note?: string }) {
  const me = S.players[S.userId];
  if (m.cls === 'wo') return <div className="board"><p className="d" style={{ fontSize: '2rem', margin: 0 }}>Walkover</p><div className="foot">{m.won ? 'Your opponent withdrew' : 'You could not take the court'}</div></div>;
  const cell = (c: Col, mine: boolean, k: number) => c.pend ? <span key={k} className="sc pend">·</span> : <span key={k} className={`sc ${c.live ? 'live' : (mine ? c.a > c.b : c.b > c.a) ? 'w' : ''}`}>{mine ? c.a : c.b}{c.tb !== undefined && (mine ? c.a < c.b : c.b < c.a) && <sup>{c.tb}</sup>}</span>;
  return (
    <div className="board">
      <div className="grid" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(48px, 72px))` }}>
        <span />{cols.map((_, k) => <span key={k} className="h">SET {k + 1}</span>)}
        <span className="nm">{surname(me.name)}</span>{cols.map((c, k) => cell(c, true, k))}
        <span className="nm">{surname(m.oppName)}</span>{cols.map((c, k) => cell(c, false, k))}
      </div>
      <div className="foot">{roundName(m.round)}{m.qual ? ' · qualifying' : ''} · {done ? `${Math.floor(m.minutes / 60)}h ${String(m.minutes % 60).padStart(2, '0')}m` : note ?? 'in progress'} · {m.p < 0.4 ? 'you were the underdog' : m.p > 0.6 ? 'you were the favourite' : 'an even contest'}{done && m.cls === 'ret' ? ' · ended by retirement' : ''}</div>
    </div>
  );
}
/** The rounds still ahead after `round`, all the way to the final, so the run never gives away where it ends. */
function roundsAfter(S: State, t: UTourney, round: string): string[] {
  if (round === 'RR' || round === 'F' || t.band === 'F') return [];
  const ed = S.cal.find(e => e.id === t.ed), draw = ed?.draw ?? 32, bracket = draw > 64 ? 128 : draw > 32 ? 64 : 32;
  const main = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'].slice(['R128', 'R64', 'R32'].indexOf(`R${bracket}`));
  if (/^Q\d/.test(round)) return main;
  const i = main.indexOf(round); return i < 0 ? [] : main.slice(i + 1);
}
const fullCols = (m: UMatch): Col[] => parseSets(m).map(s => ({ a: s[0], b: s[1], tb: s[2] }));
function MatchStage({ S, t, list, mi, sets: shown, g }: { S: State; t: UTourney; list: UMatch[]; mi: number; sets: number; g?: number }) {
  const m = list[mi], all = parseSets(m), opp = surname(m.oppName), total = m.flow?.length ?? 0;
  let cols: Col[], done: boolean, head: string, note: string | undefined, games: number;
  if (g !== undefined && m.flow) {
    const sc = scoreAt(m, g); done = g >= total; games = g;
    cols = sc.done.map(s => ({ a: s[0], b: s[1], tb: s[2] }));
    if (!done) cols.push(sc.live ? { a: sc.live[0], b: sc.live[1], live: true } : { a: 0, b: 0, pend: true });
    const just = sc.boundary && sc.done.length > 0 ? sc.done[sc.done.length - 1] : null;
    head = done ? (m.won ? 'Match won' : 'Match lost')
      : just ? `Set ${sc.done.length} to ${just[0] > just[1] ? 'you' : opp} · ${Math.max(just[0], just[1])}-${Math.min(just[0], just[1])}`
      : sc.live ? (sc.live[0] === sc.live[1] ? `${sc.live[0]} all · set ${sc.setNo}` : sc.live[0] > sc.live[1] ? `You lead ${sc.live[0]}-${sc.live[1]}` : `${opp} leads ${sc.live[1]}-${sc.live[0]}`) : `Set ${sc.setNo}`;
    note = `set ${sc.setNo}, game ${(sc.live ? sc.live[0] + sc.live[1] : 0)}`;
  } else {
    done = m.cls === 'wo' || shown >= all.length; const cut = all.slice(0, shown);
    cols = cut.map(s => ({ a: s[0], b: s[1], tb: s[2] })); if (!done) cols.push({ a: 0, b: 0, pend: true });
    const a = cut.filter(s => s[0] > s[1]).length, b = cut.length - a;
    head = done ? (m.won ? (m.cls === 'wo' ? 'Through' : 'Match won') : 'Match lost') : a === b ? `${a} set${a === 1 ? '' : 's'} all` : a > b ? `You lead ${a}-${b}` : `${opp} leads ${b}-${a}`;
    games = cut.reduce((x, s) => x + s[0] + s[1], 0);
  }
  const st = m.stats, key = g !== undefined && isKey(S, t, m);
  return (
    <>
      <div className="reveal-head">
        <span className="kicker"><EvName name={t.name} surface={t.surface} /> · {t.surface} · {roundName(m.round)}{m.qual ? ' · qualifying' : ''}{key ? ' · big match' : ''}</span>
        <h1 className={`mega ${done ? '' : 'live'}`} key={`${m.id}-${shown}-${g ?? ''}`}>{head}</h1>
      </div>
      <Plates S={S} m={m} done={done}><Board S={S} m={m} cols={cols} done={done} note={note} /></Plates>
      <div className="reveal-grid">
        <section className="glass">
          <div className="sec-head"><h3>Through the draw</h3></div>
          <ol className="plain runpath">{list.slice(0, mi + 1).map((x, k) => <li key={x.id} className={k === mi ? (done ? (x.won ? 'now' : 'lost') : 'now live') : x.won ? '' : 'lost'}><span className="r">{roundName(x.round)}{k < mi || done ? (x.won ? ' · won' : ' · lost') : ' · on court'}</span><br /><b>{x.oppName}</b>{(k < mi || done) && <span className="muted"> {x.score}</span>}</li>)}
            {!(done && !m.won) && roundsAfter(S, t, m.round).map(r => <li key={r} className="future"><span className="r">{roundName(r)}</span><br /><b>To be decided</b></li>)}</ol>
        </section>
        <section className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
          {m.flow && games > 0 ? <Momentum m={m} oppName={m.oppName} upto={done ? undefined : games} /> : <p className="muted">{m.cls === 'wo' ? 'No match was played.' : 'Momentum appears as the match is played.'}</p>}
          {done && m.cls !== 'wo' && <div><p className="eyebrow" style={{ color: 'var(--ball)' }}>Why it went this way</p><ul className="plain reasons">{m.reasons.map((r, k) => <li key={k}>{r}</li>)}</ul></div>}
        </section>
        <section className="glass">
          <div className="sec-head"><h3>Match facts</h3></div>
          {done && st ? <div className="facts">
            {([['Aces', st[0].aces, st[1].aces], ['Double faults', st[0].df, st[1].df], ['1st serve won', pc(st[0].fsWon, st[0].fsIn), pc(st[1].fsWon, st[1].fsIn)], ['Break points', `${st[0].bpWon}/${st[0].bpTot}`, `${st[1].bpWon}/${st[1].bpTot}`], ['Points won', st[0].pts, st[1].pts]] as [string, string | number, string | number][]).map(([k, x, y]) => <div key={k} className="fact"><b className="num">{x}</b><span>{k}</span><b className="num">{y}</b></div>)}
          </div> : <div className="facts"><div className="fact"><b>{m.myRank}</b><span>Ranking</span><b>{m.oppRank}</b></div><div className="fact"><b>{Math.round(m.p * 100)}%</b><span>Pre-match chance</span><b>{Math.round((1 - m.p) * 100)}%</b></div>{total > 0 && <div className="fact"><b>{(m.flow ?? '').slice(0, games).split('').filter(x => x === '1').length}</b><span>Games won</span><b>{(m.flow ?? '').slice(0, games).split('').filter(x => x === '0').length}</b></div>}</div>}
        </section>
      </div>
    </>
  );
}
const pc = (x: number, y: number) => (y ? `${Math.round((x / y) * 100)}%` : '–');
function EventReveal({ S, t }: { S: State; t: UTourney }) {
  const u = S.u, ms = t.matches.map(id => u.matches.find(m => m.id === id)!).filter(Boolean), m = ms[ms.length - 1];
  const { assets } = useApp(), slam = S.cal.find(e => e.series === t.series)?.slam, trophy = t.title && slam ? assets[`trophy:${slam}:${S.tour}`] : null;
  const improved = ROUND_ORDER.indexOf(t.reached) >= 0 && ROUND_ORDER.indexOf(t.reached) < bestBefore(S, t);
  const before = rankAround(S, t.wk), after = rankAround(S, t.wk + (t.band === 'GS' ? 2 : 1));
  return (
    <>
      <div className="reveal-head">
        <span className="kicker"><EvName name={t.name} surface={t.surface} /> · {t.surface} · {t.cat} · final result</span>
        <h1 className="mega">{headline(t.reached)}{improved && !t.title && <span className="sticker">Best result yet</span>}</h1>
        {trophy && <img className="trophy" src={trophy} alt="" />}
      </div>
      {m && <Plates S={S} m={m} done><Board S={S} m={m} cols={fullCols(m)} done /></Plates>}
      <div className="reveal-grid">
        <section className="glass">
          <div className="sec-head"><h3>Your run</h3></div>
          <ol className="plain runpath">{ms.map(x => <li key={x.id} className={x.won ? '' : 'lost'}><span className="r">{roundName(x.round)} · {x.won ? 'won' : 'lost'}</span><br /><button className="link" style={{ color: '#fff', textDecoration: 'none' }} onClick={() => set({ overlay: { kind: 'match', id: x.id } })}><b>{x.oppName}</b></button> <span className="muted">{x.score}</span></li>)}</ol>
        </section>
        <section className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
          {m && <Momentum m={m} oppName={m.oppName} />}
          {m && <div><p className="eyebrow" style={{ color: 'var(--ball)' }}>Why it went this way</p><ul className="plain reasons">{m.reasons.map((r, k) => <li key={k}>{r}</li>)}</ul></div>}
        </section>
        <section className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
          <div className="sec-head" style={{ margin: 0 }}><h3>Rewards</h3></div>
          <div className="reward"><span className="from">{before}</span><span style={{ color: 'var(--ball)' }}><Arrow /></span><span className="to">{after}</span><small>world rank</small></div>
          <div className="chips"><span className="c">+{t.pts} pts</span><span className="c">{money(t.prize)} prize</span><span className="c">−{money(t.cost)} trip</span></div>
          <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => set({ overlay: { kind: 'tourney', ed: t.ed } })}>Full draw and details</button>
        </section>
      </div>
    </>
  );
}
function RangeSummary({ S, from, multi, items }: { S: State; from: number; multi: boolean; items: UTourney[] }) {
  const sum = S.lastSummary!, u = S.u, end = sum.toWk;
  const rankFrom = multi ? (u.rankHist.find(h => h.wk >= from)?.rank ?? sum.rankFrom) : sum.rankFrom, rankTo = sum.rankTo, moved = rankFrom - rankTo;
  const ptsFrom = multi ? (u.rankHist.find(h => h.wk >= from)?.pts ?? sum.ptsFrom) : sum.ptsFrom;
  const cashDelta = multi ? u.ledger.filter(l => l.wk >= from && l.wk < end).reduce((t, l) => t + l.amt, 0) : sum.cashTo - sum.cashFrom;
  const dev: Partial<Record<string, number>> = multi ? {} : sum.dev;
  if (multi) for (const a of u.attr) if (a.wk >= from && a.wk <= end && (a.cause === 'competition' || a.cause === 'training')) dev[a.ab] = (dev[a.ab] ?? 0) + (a.to - a.from);
  const devs = ABILITIES.filter(a => (dev[a] ?? 0) >= 0.05);
  const all = u.tourneys.filter(t => t.wk >= from && t.wk < end), w = items.reduce((n, t) => n + t.matches.filter(id => u.matches.find(m => m.id === id)?.won).length, 0), l = items.reduce((n, t) => n + t.matches.length, 0) - w;
  const ach = multi ? u.ach.filter(a => a.wk >= from && a.wk <= end).map(a => a.name) : sum.newAch;
  return (
    <>
      <div className="reveal-head"><span className="kicker">{multi ? 'Season played' : 'Swing complete'} · {w}–{l}</span><h1 className="mega">{moved > 0 ? `Up ${moved}` : moved < 0 ? `Down ${-moved}` : 'Holding steady'}</h1></div>
      <div className="reveal-grid" style={{ marginTop: '1.4rem' }}>
        <section className="glass">
          <div className="sec-head"><h3>Ranking</h3></div>
          <div className="reward"><span className="from">{rankFrom}</span><span style={{ color: 'var(--ball)' }}><Arrow /></span><span className="to">{rankTo}</span></div>
          <div className="chips" style={{ marginTop: '.8rem' }}><span className="c">{sum.ptsTo} pts</span><span className="c">{sum.ptsTo - ptsFrom >= 0 ? '+' : ''}{sum.ptsTo - ptsFrom}</span></div>
          <div className="chips" style={{ marginTop: '.8rem' }}><span className="c">Cash {money(sum.cashTo)}</span><span className="c">{cashDelta >= 0 ? '+' : '−'}{money(Math.abs(cashDelta))}</span></div>
        </section>
        <section className="glass">
          <div className="sec-head"><h3>Events</h3><small>{all.length}</small></div>
          <ul className="plain">{all.map(t => <li key={t.ed} style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem' }}><button className="link" style={{ color: '#fff', textDecoration: 'none', textAlign: 'left' }} onClick={() => set({ overlay: { kind: 'tourney', ed: t.ed } })}><b><EvName name={t.name} surface={t.surface} /></b></button><span>{played(t) ? headline(t.reached) : <span className="pill warn">{t.status === 'ALT' ? 'Not accepted' : 'Withdrew'}</span>}</span></li>)}</ul>
          {!multi && sum.notes.map((n, k) => <p key={k} className="note">{n}</p>)}
          {sum.follow.map((n, k) => <p key={k} className="note story">{fillText(S, n)}</p>)}
        </section>
        <section className="glass">
          <div className="sec-head"><h3>Skills up</h3></div>
          {devs.length ? <div className="chips">{devs.map(a => <span key={a} className="skillup"><i>▲</i>{ABILITY_NAMES[a]} +{dev[a]!.toFixed(1)}</span>)}</div> : <p className="muted">No measurable growth.</p>}
          {ach.length > 0 && <p className="ok-box" style={{ marginTop: '1rem' }}>Milestones: {ach.join(' · ')}</p>}
        </section>
      </div>
      {(() => { const ns = newsSince(S, from).filter(n => n.wk < end + 1 && n.kind !== 'you').slice(-8).reverse(); return ns.length ? <section className="glass" style={{ marginTop: '1.2rem' }}><div className="sec-head"><h3>Around the tour</h3><small>while you were playing</small></div><NewsList S={S} items={ns} /></section> : null; })()}
    </>
  );
}
export { rankTxt };
