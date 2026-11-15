// Features test: season goals, breaking news, trophy cabinet, rival cards, keyboard watch controls.
const { chromium } = require('playwright');
(async () => {
  const [out] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = {};
  await p.goto('http://localhost:4173/'); await p.click('text=Start a new career'); await p.click('text=Skip ahead with a random identity');
  await p.click('button:has-text("Create career")'); await idle(); await p.waitForTimeout(300);
  R.goalsAtStart = await p.locator('.goal').count(); await shot('g1-home-goals', true);
  await p.click('button:has-text("Simulate to season\'s end")'); await idle(); await p.waitForSelector('.screen[aria-label="Block results"]', { timeout: 300000 });
  await p.selectOption('.pace select', 'match'); await p.waitForTimeout(200);
  const lbl = () => p.locator('.dock button.icon').getAttribute('aria-label');
  R.before = await lbl(); await p.keyboard.press('Space'); R.afterSpace = await lbl();
  const t0 = await p.locator('.screen-top .t').innerText(), k0 = await p.locator('.dots b').innerText();
  for (let k = 0; k < 4; k++) await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
  R.stepped = (await p.locator('.dots b').innerText()) + ' / ' + (await p.locator('.dock .cta').innerText()); R.from = k0 + ' ' + t0;
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100); await shot('g2-watch-keys');
  R.hint = await p.locator('.keys-hint').count();
  await p.keyboard.press('s'); await p.waitForTimeout(300); R.summary = await p.locator('.screen-top .t').innerText(); R.summaryNews = await p.locator('.screen .news li').count(); await shot('g3-summary-news', true);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  R.yearEndGoals = await p.locator('.goal').count(); R.ticker = await p.locator('.ticker .tk').count(); await shot('g4-yearend', true);
  await p.click('.cta:has-text("Start")'); await idle(); await p.waitForTimeout(300);
  for (let y = 0; y < 2 && !(await p.locator('.rival-alert .rowbtn').count()); y++) {
    await p.click('button:has-text("Simulate to season\'s end")'); await idle(); await p.waitForSelector('.screen[aria-label="Block results"]', { timeout: 300000 });
    await p.keyboard.press('s'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300); await p.click('.cta:has-text("Start")'); await idle(); await p.waitForTimeout(300);
  }
  R.rivalAlert = await p.locator('.rival-alert .rowbtn').count(); R.newsCard = await p.locator('.glass .news li').count(); await shot('g5-home-year2', true);
  // rival card: from the alert or the Tour head-to-head list
  if (!R.rivalAlert) { await p.click('.navpill button:has-text("Tour")'); await p.click('button:has-text("Head to head")'); }
  const opener = R.rivalAlert ? p.locator('.rival-alert .rowbtn').last() : p.locator('button:has-text("Rival card")').first();
  R.cardAvailable = await opener.count();
  if (R.cardAvailable) {
    await opener.click(); await p.waitForTimeout(300); await shot('g6-rival-card');
    R.fit = await p.locator('.facts li').count(); R.verdict = await p.locator('.rival-grid b').first().innerText();
    await p.click('button:has-text("Confirm as rival")'); await idle(); await p.waitForTimeout(300); R.confirmed = await p.locator('text=Confirmed rival').count(); await shot('g7-rival-confirmed');
    await p.keyboard.press('Escape');
  }
  await p.click('.navpill button:has-text("Player")'); await p.waitForTimeout(300); R.trophies = await p.locator('.trophy-slot').count(); R.rivalsRows = await p.locator('.sec:has(h3:has-text("Rivals")) .rowbtn').count(); await shot('g8-player', true);
  await p.click('.navpill button:has-text("Career")'); await p.click('button:has-text("Plan the swing")'); await p.waitForTimeout(300); R.rivalTags = await p.locator('.tag.rival').count(); await shot('g9-planner');
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 390, height: 844 }); await p.click('.bottomnav button:has-text("Career")').catch(() => {}); await p.waitForTimeout(300); await shot('g10-mobile', true);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})().catch(e => { console.error('E2E5 FAILED', e); process.exit(1); });
