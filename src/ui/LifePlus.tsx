import { useState } from 'react';
// Off-court management: coach cards, time with your people, home base, housing, staff, plus planner wildcard offers and sponsor offer cards.
import { WcOffer } from '../core/agent';
import { fmtShort, wkDate } from '../core/content';
import { BASES, HOMES, LIFE_ACTIONS, ROLES, STAFF, actionUsed, baseOf, hometown, homePrice, homeRent, homeUpkeep, livingMonthly, staffLevel } from '../core/lifestyle';
import { ABILITY_NAMES, Coach, Sponsor, STYLE_NAMES, State } from '../core/types';
import { COACH_TIER_NAME } from '../core/world';
import { BrandMark, EvName, Flag, money } from './bits';
import { dispatch, useApp } from './store';

const pctOf = (v: number, lo: number, hi: number) => Math.max(4, Math.min(100, ((v - lo) / (hi - lo)) * 100));
const specName = (s?: Coach['spec']) => (!s ? 'General' : s === 'physical' ? 'Physical conditioning' : ABILITY_NAMES[s]);
export function CoachMeters({ c }: { c: Coach }) {
  const rows: [string, number, string][] = [
    ['Development', pctOf(c.dev, 0.92, 1.26), c.dev >= 1.18 ? 'exceptional' : c.dev >= 1.12 ? 'outstanding' : c.dev >= 1.07 ? 'strong' : c.dev >= 1.02 ? 'solid' : 'modest'],
    ['Recovery care', pctOf(c.recovery, 0.15, 1), c.recovery > 0.75 ? 'very careful' : c.recovery > 0.5 ? 'careful' : c.recovery > 0.35 ? 'average' : 'pushes hard'],
    ['Fit with your game', pctOf(c.fit, -0.06, 0.06), c.fit > 0.02 ? 'suits your game' : c.fit < -0.02 ? 'different philosophy' : 'neutral'],
  ];
  return <div className="cmeters">{rows.map(([k, v, w]) => <div key={k} className="cm"><span className="k">{k}</span><span className="track"><i className="fill" style={{ width: `${v}%` }} /></span><small>{w}</small></div>)}</div>;
}
export function CoachCard({ c, current, trust }: { c: Coach; current?: boolean; trust?: number }) {
  const [name, persona] = [c.name.split(' (')[0], c.persona ?? c.name.split(' (')[1]?.replace(')', '')];
  return (
    <span className="coachcard">
      <span className="row between" style={{ margin: 0, gap: '.5rem' }}><span><b className="cc-name">{name}</b><small style={{ display: 'block' }}>{persona}</small></span><span className={`tier t-${c.tier}`}>{COACH_TIER_NAME[c.tier]}</span></span>
      <span className="cc-spec">Speciality: <b>{specName(c.spec)}</b> · prefers {STYLE_NAMES[c.style].toLowerCase()}s</span>
      <CoachMeters c={c} />
      <span className="cc-foot"><b>{money(c.cost)}</b> a month{current ? ` · contract through ${c.until}` : ''}{trust !== undefined ? ` · trust ${Math.round(trust)}/100` : c.tier === 'legend' ? ' · demanding: trust starts lower' : ''}</span>
    </span>
  );
}

// ---------- sponsor offer card ----------
const KIND: Record<string, [string, string]> = { retainer: ['Retainer', 'Steady money, small bonuses, many appearance days that eat into training'], performance: ['Performance', 'Little guaranteed, big bonuses for every title, main tour and lower tour'], loyalty: ['Loyalty', 'Signing payment and a long contract at a steady rate'] };
export function SponsorOffer({ o }: { o: Sponsor }) {
  const k = KIND[o.kind ?? 'retainer'];
  return (
    <span className="spoffer">
      <span className="row between" style={{ margin: 0 }}><BrandMark sp={o} /><span className={`tier k-${o.kind}`}>{k[0]}</span></span>
      <small>{k[1]}</small>
      <span className="sp-grid">
        <span><small>Monthly</small><b>{money(o.monthly)}</b></span>
        <span><small>Tour title</small><b>{money(o.titleBonus)}</b></span>
        <span><small>Lower-tour title</small><b>{money(o.lowerBonus ?? o.titleBonus * 0.2)}</b></span>
        <span><small>{o.signing ? 'Signing' : 'Appearance days'}</small><b>{o.signing ? money(o.signing) : `${o.appearances} a year`}</b></span>
      </span>
      <small>{o.signing ? `${o.appearances} appearance days a year · ` : ''}through {o.until - 1}</small>
    </span>
  );
}

// ---------- planner wildcard offers ----------
export function WildcardOffers({ S, offers, plan, wc, accept }: { S: State; offers: WcOffer[]; plan: Record<number, string>; wc: string[]; accept: (o: WcOffer, yes: boolean) => void }) {
  if (!offers.length) return null;
  return (
    <section className="glass wcoffers">
      <div className="sec-head"><h3>Wildcard offer{offers.length > 1 ? 's' : ''}</h3><small>close to home</small></div>
      {offers.map(o => {
        const on = wc.includes(o.ed.id) && plan[o.ed.startWk] === o.ed.id;
        return (
          <div key={o.ed.id} className={`wco ${on ? 'on' : ''}`}>
            <div className="grow">
              <b><EvName name={o.ed.name} surface={o.ed.surface} /></b> <small>{o.ed.cat} · {fmtShort(wkDate(o.ed.startWk))} · <Flag c={o.ed.country} /> {o.ed.city}</small>
              <p style={{ margin: '.35rem 0 0' }}>With the stars at <b>{o.bigger.name}</b> the same week, the organisers offer you a main-draw wildcard. Your ranking alone would make this {o.status === 'unlikely' ? 'a long shot' : o.status === 'alternate' ? 'an alternate spot at best' : 'qualifying'}.</p>
              <small>Guaranteed main-draw points and prize money · a top seed in round one · home pressure and media: more fatigue</small>
            </div>
            <div className="wco-btns">{on ? <><span className="pill ok">Accepted</span><button className="btn small" onClick={() => accept(o, false)}>Decline</button></> : <button className="btn" onClick={() => accept(o, true)}>Accept wildcard</button>}</div>
          </div>);
      })}
    </section>
  );
}

// ---------- life tab sections ----------
export function PeopleTime({ S, ro }: { S: State; ro: boolean }) {
  const can = S.phase === 'plan' && !ro;
  return (
    <section className="glass">
      <div className="sec-head"><h3>Time with your people</h3><small>each once per swing</small></div>
      <div className="acts">{LIFE_ACTIONS.map(a => {
        const used = actionUsed(S, a.id), why = a.ok?.(S), cost = a.cost(S), poor = cost > S.u.cash;
        return (
          <div key={a.id} className={`act ${used ? 'used' : ''}`}>
            <span className={`who w-${a.who}`}>{a.who === 'coach' ? 'Coach' : a.who === 'friend' ? 'Friend' : 'Partner'}</span>
            <div className="grow"><b>{a.title}</b><small style={{ display: 'block' }}>{a.text}</small><small className="fx">{a.fx}</small></div>
            <button className="btn small" disabled={!can || used || !!why || poor} title={why ?? undefined} onClick={() => dispatch({ type: 'LifeAction', action: a.id }, 'Saving')}>{used ? 'Done' : why ? 'Not now' : cost ? money(cost) : 'Free'}</button>
          </div>);
      })}</div>
      <p className="help">Coach trust also grows when you follow the coach's pick for a swing. Higher trust makes training more effective.</p>
    </section>
  );
}
export function HomeBase({ S, ro }: { S: State; ro: boolean }) {
  const cur = baseOf(S), can = (S.phase === 'plan' || S.phase === 'yearEnd') && !ro, all = [hometown(S), ...BASES];
  const owned = S.u.home?.owned && S.u.home.tier, [pick, setPick] = useState(cur.id), target = all.find(b => b.id === pick), moveCost = target ? Math.round((2500 + 1500 * target.mult) / 10) * 10 : 0;
  return (
    <section className="glass">
      <div className="sec-head"><h3>Home base</h3><small>living costs {money(livingMonthly(S))} a month</small></div>
      <p><Flag c={cur.country} size={22} /> <b>{cur.city}</b> · {cur.note}</p>
      <p className="help">Your base decides trip costs and travel fatigue: events in the same country or region are cheaper and less tiring. Moving costs money and a little morale{owned ? ', and sells your property at 85% of its value' : ''}.</p>
      <div className="row" style={{ gap: '.6rem', alignItems: 'flex-end' }}>
        <label className="grow">Move to<select value={pick} onChange={e => setPick(e.target.value)}>{all.map(b => <option key={b.id} value={b.id}>{b.city} · cost of living ×{b.mult.toFixed(2)}{b.id === cur.id ? ' · current' : ''}</option>)}</select></label>
        <button className="btn" disabled={!can || !target || target.id === cur.id || S.u.cash < moveCost} onClick={() => { if (target && confirm(`Move your base to ${target.city}? It costs ${money(moveCost)}.`)) dispatch({ type: 'SetBase', base: target.id }, 'Moving'); }}>{target && target.id !== cur.id ? `Move · ${money(moveCost)}` : 'Move'}</button>
      </div>
      {target && target.id !== cur.id && <p className="help" style={{ marginTop: '.5rem' }}><Flag c={target.country} /> {target.note}</p>}
    </section>
  );
}
export function Housing({ S, ro }: { S: State; ro: boolean }) {
  const h = S.u.home ?? { base: 'home', tier: 0, owned: false }, can = (S.phase === 'plan' || S.phase === 'yearEnd') && !ro;
  return (
    <section className="glass">
      <div className="sec-head"><h3>Your home</h3><small>in {baseOf(S).city}</small></div>
      <div className="homes">{HOMES.map((x, i) => {
        const on = h.tier === i, price = homePrice(S, i), rent = homeRent(S, i), up = homeUpkeep(S, i);
        return (
          <div key={i} className={`home ${on ? 'on' : ''}`}>
            <div className="grow"><b>{x.name}</b>{on && <span className="pill ok">{i === 0 ? 'Current' : h.owned ? 'Owned' : 'Renting'}</span>}<small style={{ display: 'block' }}>{x.text}</small>
              {i > 0 && <small className="fx">Recovery +{x.recov} a free week · morale and relationship lift{x.court ? ' · private court keeps you sharp' : ''}</small>}</div>
            {i > 0 && <div className="home-btns">
              <button className="btn small" disabled={!can || (on && !h.owned)} onClick={() => dispatch({ type: 'SetHome', tier: i, buy: false }, 'Saving')}>Rent {money(rent)}/mo</button>
              <button className="btn small" disabled={!can || (on && h.owned) || S.u.cash < price} onClick={() => { if (confirm(`Buy the ${x.name.toLowerCase()} for ${money(price)}? Upkeep is ${money(up)} a month.`)) dispatch({ type: 'SetHome', tier: i, buy: true }, 'Saving'); }}>Buy {money(price)}</button>
            </div>}
            {i === 0 && !on && <button className="btn small" disabled={!can} onClick={() => dispatch({ type: 'SetHome', tier: 0, buy: false }, 'Saving')}>{h.owned ? 'Sell and rent a room' : 'Move out'}</button>}
          </div>);
      })}</div>
    </section>
  );
}
export function Team({ S, ro }: { S: State; ro: boolean }) {
  const u = S.u, can = (S.phase === 'plan' || S.phase === 'yearEnd') && !ro;
  return (
    <section className="glass">
      <div className="sec-head"><h3>Your team</h3><small>monthly costs</small></div>
      <CoachCard c={u.coach} current trust={u.rel.coach} />
      <div className="staff">{ROLES.map(r => {
        const d = STAFF[r], lv = staffLevel(S, r), who = u.staff?.find(x => x.role === r);
        return (
          <div key={r} className="role">
            <div className="row between" style={{ margin: 0 }}><span><b>{d.name}</b><small style={{ display: 'block' }}>{who ? `${who.name} · ${d.lv[lv - 1]}` : d.does}</small></span></div>
            <div className="seg wrap" role="radiogroup" aria-label={d.name}>
              <button role="radio" aria-checked={lv === 0} className={lv === 0 ? 'on' : ''} disabled={!can} onClick={() => lv && dispatch({ type: 'SetStaff', role: r, level: 0 }, 'Saving')}>None</button>
              {[1, 2].map(l => <button key={l} role="radio" aria-checked={lv === l} className={lv === l ? 'on' : ''} disabled={!can} onClick={() => lv !== l && dispatch({ type: 'SetStaff', role: r, level: l as 1 | 2 }, 'Hiring')}>{d.lv[l - 1]} · {money(d.cost[l - 1])}</button>)}
            </div>
            {who && <small className="fx">{d.does}</small>}
          </div>);
      })}</div>
    </section>
  );
}
export function useRo() { const { save } = useApp(); return save === 'readonly'; }
