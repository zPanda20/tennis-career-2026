// Watch mode test: set-by-set playback, pace switching, season autopilot, and results after the final swing.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 180000 });
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  const R = {};
  await p.goto('http://localhost:4173/'); await p.click('text=Start a new career'); await p.click('text=Skip ahead with a random identity'); await p.click('button:has-text("Create career")'); await idle();
  // block A by hand, watched set by set
  await p.click('button:has-text("Plan the swing")'); await p.locator('.dock .cta').click();
  if (await p.locator('[aria-label="Your decision"]').count()) { await p.locator('[aria-label="Your decision"] .choice').first().click(); await p.locator('.dock .cta').click(); }
  await p.locator('.dock .cta:has-text("Play the swing")').click(); await idle();
  await p.waitForSelector('.screen[aria-label="Block results"]');
  await p.click('.dock .seg button:has-text("Set by set")'); await p.click('button[aria-label="Pause"]').catch(() => {});
  await p.waitForTimeout(500); await shot('w1-set1');
  R.firstHead = await p.locator('.reveal-head h1').innerText(); R.pending = await p.locator('.sc.pend').count();
  await p.locator('.dock .cta').click(); await p.waitForTimeout(500); await shot('w2-set2'); R.secondHead = await p.locator('.reveal-head h1').innerText();
  // autoplay advances by itself
  await p.click('button[aria-label="Play"]'); const h0 = await p.locator('.reveal-head h1').innerText(); await p.waitForTimeout(4200); R.autoAdvanced = (await p.locator('.reveal-head h1').innerText()) !== h0 || (await p.locator('.screen-top .t').innerText()) !== '';
  await p.click('button[aria-label="Pause"]').catch(() => {});
  await p.click('.dock .seg button:has-text("Event by event")'); await p.waitForTimeout(400); await shot('w3-event');
  await p.click('text=Skip to summary'); await p.waitForTimeout(300); await shot('w4-summary');
  await p.locator('.dock .cta:has-text("Back to career")').click();
  // autopilot through the rest of the season
  let guard = 0;
  while (guard++ < 8) {
    await idle();
    if (await p.locator('text=Conservative rehab').count()) { await p.click('text=Conservative rehab'); await idle(); if (await p.locator('.screen[aria-label="Block results"]').count()) { await p.click('text=Skip to summary').catch(() => {}); await p.locator('.dock .cta').last().click(); } continue; }
    if (await p.locator('.screen[aria-label="Block results"]').count()) break;
    if (await p.locator('button:has-text("Simulate to season")').count()) { await p.click('button:has-text("Simulate to season")'); continue; }
    if (await p.locator('button:has-text("Plan the swing")').count()) { await p.click('button:has-text("Plan the swing")'); await p.locator('.dock .cta').click(); if (await p.locator('[aria-label="Your decision"]').count()) { await p.locator('[aria-label="Your decision"] .choice').first().click(); await p.locator('.dock .cta').click(); } await p.locator('.dock .cta:has-text("Play the swing")').click(); continue; }
    break;
  }
  await idle();
  R.revealAfterSeason = await p.locator('.screen[aria-label="Block results"]').count();
  R.revealKicker = R.revealAfterSeason ? await p.locator('.screen-top .k').innerText() : null;
  await p.waitForTimeout(400); await shot('w5-season-reveal');
  if (R.revealAfterSeason) { await p.click('text=Skip to summary'); await p.waitForTimeout(300); await shot('w6-season-summary'); R.lastBtn = await p.locator('.dock .cta').innerText(); await p.locator('.dock .cta').click(); }
  R.yearEnd = await p.locator('text=Season review').count(); await shot('w7-yearend');
  R.watchSeasonBtn = await p.locator('button:has-text("Watch the whole season")').count();
  if (R.watchSeasonBtn) { await p.click('button:has-text("Watch the whole season")'); await p.waitForTimeout(400); R.seasonEvents = await p.locator('.screen-top .dots b').innerText(); await shot('w8-whole-season'); }
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})().catch(e => { console.error('E2E3 FAILED', e); process.exit(1); });
