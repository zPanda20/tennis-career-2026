// Hands-on matches: choose "every match", plan a swing, play through decisions, then check the draw tile hides the run.
const { chromium } = require('playwright');
(async () => {
  const [out] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = { kinds: [] }; global.__p = p;
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => !document.querySelector('.packnote'), null, { timeout: 120000 }).catch(() => {});
  await p.click('text=Start a new career'); await p.click('.choice:has-text("Age 19")'); await p.click('text=Skip ahead with a random identity'); await p.click('button:has-text("Create career")'); await idle();
  await p.selectOption('.mm-inline select', 'all'); await idle();
  await p.click('button:has-text("Plan the swing")'); await p.waitForTimeout(300);
  await p.locator('.dock .cta').click(); await p.waitForTimeout(200);
  if (await p.locator('[aria-label="Your decision"]').count()) { await p.locator('[aria-label="Your decision"] .choice').first().click(); await p.locator('.dock .cta').click(); await p.waitForTimeout(200); }
  await shot('l0-ready', true);
  await p.click('.dock .cta:has-text("Play the swing")'); await idle(); await p.waitForTimeout(500);
  let shots = 0, matches = 0;
  for (let n = 0; n < 200; n++) {
    const live = await p.locator('.live-screen').count(); if (!live) break;
    const title = await p.locator('.live-screen h1.mega').innerText(); R.kinds.push(title.split('·')[0].trim());
    if (/PREPARATION/i.test(title)) {
      if (shots < 1) { await shot('l1-start', true); }
      if (shots < 1) { await p.click('button:has-text("Study film")'); await idle(); await shot('l1b-film', true); }
      await p.locator('.tac').nth(n % 3).click(); await p.click('.live-dock .cta:has-text("Start the match")');
    } else if (/SET BREAK/i.test(title)) { if (shots < 2) await shot('l2-set', true); await p.click('.live-dock .cta:has-text("Play the next set")'); }
    else if (/MOMENTUM/i.test(title)) { if (shots < 3) await shot('l3-slide', true); const r = p.locator('.live-dock button:has-text("Reset")'); if (await r.isEnabled()) await r.click(); else await p.click('.live-dock button:has-text("Ride it out")'); }
    else { matches++; if (shots < 4) await shot('l4-done', true); await p.click('.live-dock .cta:has-text("Continue")'); }
    shots++; await idle(); await p.waitForTimeout(150);
    if (n > 3) await shot('l-last', true);
  }
  R.matches = matches;
  R.reveal = await p.locator('.screen[aria-label="Block results"]').count();
  if (R.reveal) {
    await p.selectOption('.pace select', 'match'); await p.waitForTimeout(200); await p.keyboard.press('Space');
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300); await shot('l5-reveal');
    R.runRows = await p.locator('.runpath li').allInnerTexts();
  }
  R.kinds = [...new Set(R.kinds)];
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})().catch(async e => { console.error('E2E11 FAILED', e.message.split('\n').slice(0, 12).join('\n')); process.exit(1); });
