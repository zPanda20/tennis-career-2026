import { useRef, useState } from 'react';
import { COUNTRY_NAMES, fmtDate } from '../core/content';
import { genName } from '../core/names';
import { Rng } from '../core/rng';
import { ABILITIES, ABILITY_NAMES, Ability, Setup } from '../core/types';
import { Avatar, Pill, rankTxt } from './bits';
import { Arrow } from './fx';
import { importBackup, newCareer, openCareer, removeCareer, set, useApp } from './store';

export function Library() {
  const { careers, storageOk } = useApp(), file = useRef<HTMLInputElement>(null);
  const active = careers.filter(c => c.status === 'active'), retired = careers.filter(c => c.status === 'retired');
  return (
    <main className="page">
      <div className="landing" style={{ minHeight: active.length || retired.length ? '68vh' : '92vh' }}>
        <span className="kicker" style={{ alignSelf: 'flex-start' }}>From nineteen to retirement</span>
        <h1 className="mega"><span>Tennis</span><span>Career</span><span className="ol">2026</span></h1>
        <p className="lede">Create a player, step onto the 2026 tour among the real field, and find out what career you can build.</p>
        <div className="row" style={{ gap: '1.2rem', marginTop: '1.4rem' }}>
          {active[0] && <button className="cta" onClick={() => openCareer(active[0].id)}>Continue {active[0].name.split(' ')[0]}<span className="go"><Arrow /></span></button>}
          <button className={active[0] ? 'btn' : 'cta'} onClick={() => set({ view: 'create' })}>Start a new career{!active[0] && <span className="go"><Arrow /></span>}</button>
          <button className="btn ghost" onClick={() => file.current?.click()}>Import a backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }} />
        </div>
        {!storageOk && <p className="warn-box" role="alert">This browser cannot store careers right now (private browsing or blocked storage). You can still play, but export a backup before closing the tab.</p>}
      </div>
      {active.length > 0 && <section className="sec"><div className="sec-head"><h3>Active careers</h3></div><ul className="list">{active.map(c => <CareerRow key={c.id} c={c} />)}</ul></section>}
      {retired.length > 0 && <section className="sec"><div className="sec-head"><h3>Completed careers</h3><small>read-only archives</small></div><ul className="list">{retired.map(c => <CareerRow key={c.id} c={c} />)}</ul></section>}
      <p className="fine">A free private hobby game. Careers are saved in this browser only; export a backup from Settings to keep a durable copy. Results from 1 January 2026 onward are simulated and player ratings are game estimates.</p>
    </main>
  );
}
function CareerRow({ c }: { c: ReturnType<typeof useApp>['careers'][number] }) {
  return (
    <li className="career-row">
      <Avatar name={c.name} size={44} />
      <div className="grow"><b>{c.name}</b><small>{c.tour === 'atp' ? "Men's tour" : "Women's tour"} · {c.country} · {c.status === 'retired' ? `Retired after ${c.year}` : `${c.year} season, ${rankTxt(c.rank)}`}</small><small>Saved {fmtDate(c.savedUtc.slice(0, 10))}</small></div>
      {c.status === 'retired' ? <Pill>Read-only</Pill> : null}
      <button className="btn small" onClick={() => openCareer(c.id)}>{c.status === 'retired' ? 'Open review' : 'Continue'}</button>
      <button className="icon" aria-label={`Delete the career of ${c.name}`} onClick={() => { if (confirm(`Delete the career of ${c.name} from this browser? This cannot be undone.`)) removeCareer(c.id); }}>🗑</button>
    </li>
  );
}

const PROFILES: [Setup['profile'], string, string][] = [
  ['unknown', 'Unknown Prospect', 'The default. Your potential is drawn once and never revealed for certain. Most careers do not win a major.'],
  ['goat', 'GOAT Contention', 'The opportunity to challenge the greatest players. You start no stronger than anyone else, and a stronger generation of rivals emerges with you.'],
  ['contender', 'Contender', 'The tools to become a major challenger, with meaningful weaknesses to manage.'],
  ['grinder', 'Grinder', 'A fight toward the top 10 to 25, with rare trophy chances to seize.'],
];
const rnd = () => new Rng(String(Math.random()) + Date.now());
export function Create() {
  const [step, setStep] = useState(0), [adv, setAdv] = useState(false);
  const [s, setS] = useState<Setup>({ tour: 'atp', name: '', country: 'USA', pronouns: 'he/him', birthMonth: 6, birthDay: 15, hand: 'R', avatar: 0, focusSurface: 'all', skills: ['fh', 'serve'], profile: 'unknown', adult: false, detail: 'quick', seed: '' });
  const up = (p: Partial<Setup>) => setS(x => ({ ...x, ...p }));
  const randomise = () => {
    const r = rnd(), tour = s.tour, g = genName(r, tour, undefined, new Set()), a = r.shuffle([...ABILITIES]);
    up({ name: g.name, country: g.country, pronouns: tour === 'atp' ? 'he/him' : 'she/her', birthMonth: r.int(1, 12), birthDay: r.int(1, 28), hand: r.chance(0.12) ? 'L' : 'R', avatar: r.int(0, 7), focusSurface: r.pick(['all', 'hard', 'clay', 'grass'] as const), skills: [a[0], a[1]] });
  };
  const born = new Date(Date.UTC(s.birthMonth === 1 && s.birthDay === 1 ? 2007 : 2006, s.birthMonth - 1, s.birthDay));
  const valid = s.name.trim().length >= 2 && s.skills[0] !== s.skills[1];
  const steps = ['Tour', 'Identity', 'Sporting focus', 'Career profile', 'Confirm'];
  const countries = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <main className="page create">
      <div className="create-main">
        <button className="btn ghost small" onClick={() => set({ view: 'library' })}>← Back to careers</button>
        <ol className="steps" aria-label="Setup steps">{steps.map((t, i) => <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{t}</li>)}</ol>
        {step === 0 && <div className="card"><h1 style={{ fontSize: '3.4rem' }}>Choose your tour</h1><p className="muted">Both tours have their own players, calendar and competitive balance.</p>
          <div className="choice-grid two">{(['atp', 'wta'] as const).map(t => <button key={t} className={`choice ${s.tour === t ? 'on' : ''}`} aria-pressed={s.tour === t} onClick={() => up({ tour: t, pronouns: t === 'atp' ? 'he/him' : 'she/her' })}><b>{t === 'atp' ? "Men's tour" : "Women's tour"}</b><span>{t === 'atp' ? 'Best of five sets at the majors. Starts among Alcaraz, Sinner and the 2026 field.' : 'Best of three throughout. Starts among Sabalenka, Swiatek and the 2026 field.'}</span></button>)}</div>
          <button className="btn ghost" onClick={() => { randomise(); setStep(4); }}>Skip ahead with a random identity and suggested focus</button></div>}
        {step === 1 && <div className="card"><h2>Identity</h2>
          <div className="form">
            <label>Player name<input value={s.name} maxLength={40} onChange={e => up({ name: e.target.value })} placeholder="Full name" autoFocus /></label>
            <label>Nationality<select value={s.country} onChange={e => up({ country: e.target.value })}>{countries.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select><small>Affects presentation and travel recommendations only, never ability.</small></label>
            <label>Pronouns<select value={s.pronouns} onChange={e => up({ pronouns: e.target.value })}><option>he/him</option><option>she/her</option><option>they/them</option></select></label>
            <div className="row2"><label>Birth month<select value={s.birthMonth} onChange={e => up({ birthMonth: +e.target.value })}>{['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
              <label>Day<select value={s.birthDay} onChange={e => up({ birthDay: +e.target.value })}>{Array.from({ length: 28 }, (_, i) => <option key={i}>{i + 1}</option>)}</select></label></div>
            <p className="muted">Born {fmtDate(born)}: exactly 19 years old when the career starts on 1 January 2026.</p>
            <fieldset><legend>Dominant hand</legend><div className="seg">{(['R', 'L'] as const).map(h => <button key={h} className={s.hand === h ? 'on' : ''} aria-pressed={s.hand === h} onClick={() => up({ hand: h })}>{h === 'R' ? 'Right' : 'Left'}</button>)}</div></fieldset>
            <fieldset><legend>Avatar colour</legend><div className="swatches">{Array.from({ length: 8 }, (_, i) => <button key={i} className={s.avatar === i ? 'on' : ''} aria-label={`Avatar colour ${i + 1}`} aria-pressed={s.avatar === i} onClick={() => up({ avatar: i })}><Avatar name={s.name || 'New Player'} user={i} size={40} /></button>)}</div></fieldset>
            <button className="btn ghost small" onClick={randomise}>Suggest a random identity</button>
          </div></div>}
        {step === 2 && <div className="card"><h2>Sporting focus</h2><p className="muted">Preferences bias your starting strengths and how well training converts. They do not set or reveal your ceiling.</p>
          <fieldset><legend>Surface</legend><div className="choice-grid four">{([['all', 'All-round', 'Even familiarity everywhere'], ['hard', 'Hard', 'Most of the calendar'], ['clay', 'Clay', 'Spring swing, long rallies'], ['grass', 'Grass', 'Short season, quick points']] as const).map(([k, t, d]) => <button key={k} className={`choice ${s.focusSurface === k ? 'on' : ''}`} aria-pressed={s.focusSurface === k} onClick={() => up({ focusSurface: k })}><b>{t}</b><span>{d}</span></button>)}</div></fieldset>
          <fieldset><legend>Primary skill interest</legend><div className="chips">{ABILITIES.map(a => <button key={a} className={s.skills[0] === a ? 'on' : ''} aria-pressed={s.skills[0] === a} onClick={() => up({ skills: [a, s.skills[1] === a ? s.skills[0] : s.skills[1]] })}>{ABILITY_NAMES[a]}</button>)}</div></fieldset>
          <fieldset><legend>Secondary skill interest</legend><div className="chips">{ABILITIES.map(a => <button key={a} disabled={s.skills[0] === a} className={s.skills[1] === a ? 'on' : ''} aria-pressed={s.skills[1] === a} onClick={() => up({ skills: [s.skills[0], a as Ability] })}>{ABILITY_NAMES[a]}</button>)}</div></fieldset></div>}
        {step === 3 && <div className="card"><h2>Career profile</h2>
          <div className="choice-grid one"><button className={`choice ${s.profile === 'unknown' ? 'on' : ''}`} aria-pressed={s.profile === 'unknown'} onClick={() => up({ profile: 'unknown' })}><b>{PROFILES[0][1]}</b><span>{PROFILES[0][2]}</span></button></div>
          <button className="btn ghost small" aria-expanded={adv} onClick={() => setAdv(!adv)}>{adv ? 'Hide' : 'Show'} advanced profile selection</button>
          {adv && <div className="choice-grid one">{PROFILES.slice(1).map(([k, t, d]) => <button key={k} className={`choice ${s.profile === k ? 'on' : ''}`} aria-pressed={s.profile === k} onClick={() => up({ profile: k })}><b>{t}</b><span>{d}</span></button>)}<p className="muted">A selected profile is recorded in your career archive. It describes opportunity, not promised trophies.</p></div>}
          <fieldset><legend>How much detail do you want?</legend><div className="seg">{(['quick', 'detailed'] as const).map(d => <button key={d} className={s.detail === d ? 'on' : ''} aria-pressed={s.detail === d} onClick={() => up({ detail: d })}>{d === 'quick' ? 'Quick play' : 'Detailed play'}</button>)}</div><p className="muted">{s.detail === 'quick' ? 'One planning decision per block, with your agent handling routine matters.' : 'Edit individual events, see the budget and review each tournament round by round.'} You can switch at any time; it never changes results.</p></fieldset>
          <label className="check"><input type="checkbox" checked={s.adult} onChange={e => up({ adult: e.target.checked })} /><span>Include adult themes in life events <small>Stronger language and more direct personal storylines. Sporting opportunities are identical either way.</small></span></label></div>}
        {step === 4 && <div className="card"><h2>Confirm your career</h2>
          <dl className="dl">
            <dt>Tour</dt><dd>{s.tour === 'atp' ? "Men's singles" : "Women's singles"}</dd>
            <dt>Player</dt><dd>{s.name || <em>No name yet</em>} · {COUNTRY_NAMES[s.country]} · {s.pronouns} · {s.hand === 'R' ? 'Right-handed' : 'Left-handed'}</dd>
            <dt>Born</dt><dd>{fmtDate(born)} (age 19 at the start)</dd>
            <dt>Focus</dt><dd>{s.focusSurface === 'all' ? 'All-round' : s.focusSurface[0].toUpperCase() + s.focusSurface.slice(1)} · {ABILITY_NAMES[s.skills[0]]} first, {ABILITY_NAMES[s.skills[1]]} second</dd>
            <dt>Profile</dt><dd>{PROFILES.find(p => p[0] === s.profile)![1]}{s.profile !== 'unknown' ? ' (selected; a stronger emerging generation applies to GOAT Contention)' : ' (hidden potential, drawn once)'}</dd>
            <dt>Play style</dt><dd>{s.detail === 'quick' ? 'Quick play' : 'Detailed play'} · {s.adult ? 'Adult themes on' : 'Adult themes off'}</dd>
            <dt>Start</dt><dd>1 January 2026, as an established lower-tier professional ranked roughly 450 to 750, healthy, with a modest coach and a starter support agreement.</dd>
          </dl>
          <p className="muted">Creating the career builds the world once. It cannot be re-rolled.</p></div>}
        <div className="row end">
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 4 ? <button className="cta" disabled={step === 1 && s.name.trim().length < 2} onClick={() => setStep(step + 1)}>Next<span className="go"><Arrow /></span></button>
            : <button className="cta" disabled={!valid} onClick={() => newCareer({ ...s, name: s.name.trim(), seed: `${crypto.randomUUID?.() ?? Math.random()}` })}>Create career<span className="go"><Arrow /></span></button>}
        </div>
      </div>
      <aside className="card preview" aria-label="Player preview">
        <Avatar name={s.name || 'New Player'} user={s.avatar} size={120} />
        <h3>{s.name || 'New player'}</h3>
        <p className="muted">{COUNTRY_NAMES[s.country]} · {s.tour === 'atp' ? "Men's tour" : "Women's tour"}</p>
        <p>{s.hand === 'R' ? 'Right-handed' : 'Left-handed'} · age 19</p>
        <p>{s.focusSurface === 'all' ? 'All-round' : `${s.focusSurface[0].toUpperCase()}${s.focusSurface.slice(1)}-court`} focus</p>
        <p>{ABILITY_NAMES[s.skills[0]]} · {ABILITY_NAMES[s.skills[1]]}</p>
        <Pill>{PROFILES.find(p => p[0] === s.profile)![1]}</Pill>
      </aside>
    </main>
  );
}
