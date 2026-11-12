// Browser smoke test: plays a career through the real interface. Usage: node tests/e2e.cjs <outDir> [blocks]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2], blocks = +(process.argv[3] || 6);
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:4173/'); await p.waitForSelector('text=Start a new career');
  await p.screenshot({ path: `${out}/01-library.png` });
  await p.click('text=Start a new career'); await p.click('text=Skip ahead with a random identity');
  await p.screenshot({ path: `${out}/02-confirm.png` });
  await p.click('button:has-text("Create career")'); await p.waitForSelector('text=Plan next block', { timeout: 60000 });
  await p.screenshot({ path: `${out}/03-home.png`, fullPage: true });
  const step = async (i) => {
    await p.waitForSelector('.busy', { state: 'detached', timeout: 120000 });
    if (await p.locator('button:has-text("Plan next block"), button:has-text("Begin final season")').count()) {
      await p.locator('button:has-text("Plan next block"), button:has-text("Begin final season")').first().click(); await p.waitForSelector('.planner');
      if (i === 0) await p.screenshot({ path: `${out}/04-planner.png`, fullPage: true });
      const life = p.locator('[aria-label="Your decision"] .choice'); if (await life.count()) await life.first().click();
      await p.click('.commit .btn.primary'); return 'block';
    }
    if (await p.locator('text=Conservative rehabilitation').count()) { await p.click('text=Conservative rehabilitation'); return 'injury'; }
    const ye = p.locator('button:has-text("Start the")'); if (await ye.count()) { if (!step.shot) { step.shot = 1; await p.screenshot({ path: `${out}/06-yearend.png`, fullPage: true }); } await ye.click(); return 'yearEnd'; }
    return 'none';
  };
  for (let i = 0; i < blocks; i++) { const r = await step(i); if (r === 'none') break; }
  await p.waitForSelector('.busy', { state: 'detached', timeout: 120000 });
  await p.screenshot({ path: `${out}/05-after.png`, fullPage: true });
  const res = p.locator('.results .rowbtn'); if (await res.count()) { await res.first().click(); await p.waitForSelector('.modal'); await p.screenshot({ path: `${out}/07-tourney.png` }); const m = p.locator('.modal .rowbtn'); if (await m.count()) { await m.first().click(); await p.waitForTimeout(200); await p.screenshot({ path: `${out}/08-match.png` }); } await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); }
  for (const [t, n] of [['Calendar', '09'], ['Player', '10'], ['World', '11'], ['Records', '12'], ['Settings', '13']]) { await p.click(`.nav.desk button:has-text("${t}")`); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${n}-${t.toLowerCase()}.png`, fullPage: t !== 'Calendar' && t !== 'World' }); }
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('.nav.bottom button:has-text("Career")'); await p.waitForTimeout(200); await p.screenshot({ path: `${out}/14-mobile-home.png` });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(JSON.stringify({ errs, overflow }));
  await b.close();
})().catch(e => { console.error('E2E FAILED', e); process.exit(1); });
