// The junior years and the road to the tour: path decision at 18, the college record, academy choice and the junior ranking card.
import { ACADEMY, PART_TIME_EVENTS, PATHS, eventsUsed, pathKind } from '../core/path';
import { jLabel } from '../core/juniors';
import type { Academy, PathChoice, PathKind, State } from '../core/types';
import { Stat, money } from './bits';
import { dispatch, useApp } from './store';

const peakWord = (n: number) => (n <= 10 ? 'top 10' : n <= 20 ? 'top 20' : n <= 50 ? 'top 50' : n <= 100 ? 'top 100' : n <= 250 ? 'top 250' : n <= 500 ? 'top 500' : 'outside the top 500');

/** The choice at 18, the yearly check-in on the path, and the final call. Returns null when there is nothing to decide. */
export function PathDecisionSection({ S, value, onChange }: { S: State; value: PathChoice | undefined; onChange: (v: PathChoice) => void }) {
  const pd = S.pending?.path; if (!pd) return null;
  const rd = pd.read, opts: [PathChoice, string, string][] = pd.kind === 'choose'
    ? (Object.keys(PATHS) as PathKind[]).map(k => [k, PATHS[k].name, PATHS[k].text] as [PathChoice, string, string])
    : pd.kind === 'review'
      ? [['stay', `Continue: ${PATHS[pd.current!].name.toLowerCase()}`, `${pd.yearsLeft} more ${pd.yearsLeft === 1 ? 'season' : 'seasons'} on this path before the final decision.`],
         ...(pd.current !== 'pro' ? [['pro', 'Turn pro full time now', 'Leave the path early and give every week to the tour.'] as [PathChoice, string, string]] : []),
         ...(pd.current === 'college' ? [['academy', 'Leave university for the academy', 'Faster development and a part-time schedule, with academy fees.'] as [PathChoice, string, string]] : [])]
      : [['pro', 'Commit to the tour full time', 'The path years are over. From now on every week is yours to plan.']];
  opts.push(['quit', 'Stop playing', 'Retire from competitive tennis and close the career. Many players make this choice at this age.']);
  const title = pd.kind === 'choose' ? 'Your next four years' : pd.kind === 'review' ? 'Check-in on your path' : 'The path ends here';
  return (
    <section className="pathdec">
      <h2 style={{ marginTop: '1.2rem' }}>{title}</h2>
      <div className="glass">
        <p className="eyebrow">Your coach's honest read</p>
        <p className="story"><b>{rd.verdict}.</b> Projected peak around the {peakWord(rd.peak)}{rd.cur < 9999 && S.pts[S.userId] > 0 ? `, ranked ${rd.cur} now` : ''}. The read is only as good as your coach: better coaches are closer to the truth.</p>
        <div className="stats"><Stat k="Level now" v={rd.now.toFixed(1)} sub={`Top 100 needs about ${rd.levelTop100.toFixed(0)}`} /><Stat k="Best junior rank" v={rd.jbest < 9999 ? `No. ${rd.jbest}` : '–'} /><Stat k="Age" v={rd.age} /></div>
        {pd.record.length > 0 && <ul className="plain">{pd.record.map((r, i) => <li key={i}>{r}</li>)}</ul>}
        <p className="muted">From a study of 504 boys who reached the ITF junior top 50 between 2004 and 2016: about half of juniors ranked 1–3 reached the top 100 by 24, and around one in ten of those ranked 21–50. Most players peak between 23 and 27.</p>
      </div>
      <div className="choice-grid" role="radiogroup" aria-label={title}>
        {opts.map(([k, t, d]) => <button key={k} role="radio" aria-checked={value === k} className={`choice ${value === k ? 'on' : ''} ${k === 'quit' ? 'quit' : ''}`} onClick={() => onChange(k)}><b>{t}</b><span>{d}</span></button>)}
      </div>
    </section>
  );
}
export const defaultPath = (S: State): PathChoice | undefined => { const pd = S.pending?.path; return !pd ? undefined : pd.kind === 'review' ? 'stay' : pd.kind === 'final' ? 'pro' : undefined; };

/** Life tab: academy choice while a junior, the path status afterwards, and the college record. */
export function RoadCard({ S }: { S: State }) {
  const u = S.u, me = S.players[S.userId], { save } = useApp(), ro = save === 'readonly'; if (!u.jstart) return null;
  const jr = S.jrank?.[S.userId] ?? 9999, pk = pathKind(S);
  return (
    <section className="glass">
      <div className="sec-head"><h3>{u.stage === 'junior' ? 'Junior years' : u.stage === 'path' ? PATHS[pk!].name : 'The road here'}</h3><small>{u.stage === 'path' ? `through ${u.path!.until}` : ''}</small></div>
      {u.stage === 'junior' && <>
        <div className="stats"><Stat k="Junior rank" v={jr < 9999 ? `No. ${jr}` : '–'} sub={`${S.jpts?.[S.userId] ?? 0} pts`} /><Stat k="Best" v={me.jbest ? `No. ${me.jbest}` : '–'} /><Stat k="Junior titles" v={me.jtitles ?? 0} /></div>
        <p className="muted">Juniors play through the season they turn 18. The decision on the next four years comes at the end of {+me.born.slice(0, 4) + 18}.</p>
        <div className="choice-grid three" role="radiogroup" aria-label="Academy">
          {(Object.keys(ACADEMY) as Academy[]).map(k => <button key={k} role="radio" aria-checked={u.academy === k} disabled={ro || S.phase !== 'plan'} className={`choice ${u.academy === k ? 'on' : ''}`} onClick={() => u.academy !== k && dispatch({ type: 'SetAcademy', academy: k }, 'Changing academy')}><b>{ACADEMY[k].name}</b><span>{ACADEMY[k].text}</span><small>{money(ACADEMY[k].fee)} a month · development ×{ACADEMY[k].dev.toFixed(2)}</small></button>)}
        </div>
      </>}
      {u.stage === 'path' && <p className="story">{PATHS[pk!].text}{pk === 'academy' ? ` ${Math.max(0, PART_TIME_EVENTS - eventsUsed(S))} of ${PART_TIME_EVENTS} pro events left this season.` : ''}</p>}
      {u.stage === 'pro' && u.path && <p className="story">{PATHS[u.path.kind].name}, {u.path.from}–{Math.min(u.path.until, S.year)}. Full-time professional since then.</p>}
      {(u.college ?? []).length > 0 && <><p className="eyebrow">College record</p><ul className="plain">{u.college!.map(c => <li key={c.year}><b>{c.year}</b> {c.w}–{c.l}{c.ncaa ? ` · NCAA singles ${c.ncaa === 'W' ? 'champion' : c.ncaa}` : ''}</li>)}</ul></>}
    </section>
  );
}
export const juniorCat = (jl?: number) => (jl ? jLabel(jl) : 'Junior');
