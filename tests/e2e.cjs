// Browser smoke test for the Centre Court interface. Usage: node tests/e2e.cjs <outDir> [blocks]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2], blocks = +(process.argv[3] || 5);
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 120000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  await p.goto('http://localhost:4173/'); await p.waitForSelector('text=Start a new career'); await p.waitForTimeout(600); await shot('01-library');
  await p.click('text=Start a new career'); await shot('02-create');
  await p.click('.choice:has-text("Age 19")'); await p.click('text=Skip ahead with a random identity'); await p.click('button:has-text("Create career")'); await idle(); await p.waitForSelector('button:has-text("Plan the swing")');
  await p.waitForTimeout(400); await shot('03-home');
  let shots = 0;
  for (let i = 0; i < blocks; i++) {
    await idle();
    if (await p.locator('.screen[aria-label="Block results"]').count()) {
      if (!shots) { await p.waitForTimeout(700); await shot('06-reveal'); }
      while (!(await p.locator('.dock button:has-text("Back to career")').count())) await p.locator('.dock .cta').click();
      if (!shots++) await shot('07-summary');
      await p.locator('.dock button:has-text("Back to career")').click(); continue;
    }
    if (await p.locator('text=Conservative rehab').count()) { await p.click('text=Conservative rehab'); continue; }
    const ye = p.locator('.cta:has-text("Start 20")'); if (await ye.count()) { await shot('08-yearend', true); await ye.click(); continue; }
    await p.click('button:has-text("Plan the swing")'); await p.waitForSelector('.routes');
    if (i === 0) { await p.waitForTimeout(300); await shot('04-planner'); }
    await p.locator('.dock .cta').click();
    if (await p.locator('[aria-label="Your decision"]').count()) { if (i === 0) await shot('05-decision'); await p.locator('[aria-label="Your decision"] .choice').first().click(); await p.locator('.dock .cta').click(); }
    if (i === 0) await shot('05b-confirm');
    await p.locator('.dock .cta:has-text("Play the swing")').click();
  }
  await idle();
  if (await p.locator('.screen[aria-label="Block results"]').count()) { while (!(await p.locator('.dock button:has-text("Back to career")').count())) await p.locator('.dock .cta').click(); await p.locator('.dock button:has-text("Back to career")').click(); }
  await p.waitForTimeout(400); await shot('09-home-later');
  for (const [t, n] of [['Calendar', '10'], ['Player', '11'], ['Tour', '12'], ['Records', '13']]) { await p.click(`.navpill button:has-text("${t}")`); await p.waitForTimeout(300); await shot(`${n}-${t.toLowerCase()}`); }
  await p.click('.navpill button:has-text("Career")');
  const card = p.locator('.tcard').first(); if (await card.count()) { await card.click(); await p.waitForSelector('.modal'); await shot('14-tourney'); const mb = p.locator('.modal .rowbtn').first(); if (await mb.count()) { await mb.click(); await p.waitForTimeout(300); await shot('15-match'); } await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400); await shot('16-mobile-home'); await shot('16b-mobile-full', true);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await p.click('button:has-text("Plan the swing")').catch(() => {}); await p.waitForTimeout(400); await shot('17-mobile-planner');
  console.log(JSON.stringify({ errs, overflow }));
  await b.close();
})().catch(e => { console.error('E2E FAILED', e); process.exit(1); });
