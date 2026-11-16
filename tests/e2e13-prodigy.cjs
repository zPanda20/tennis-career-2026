// Prodigy coaching: a GOAT-profile early developer at 16 plays swing by swing until a top coach approaches; hire them.
const { chromium } = require('playwright');
(async () => {
  const [out] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = { swings: 0 };
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => !document.querySelector('.packnote'), null, { timeout: 120000 }).catch(() => {});
  await p.click('text=Start a new career'); await p.click('text=Skip ahead with a random identity');
  await p.click('.row.end .btn:has-text("Back")');
  await p.click('button:has-text("Show advanced profile selection")'); await p.click('.choice:has-text("GOAT Contention")');
  await p.click('.choice:has-text("Early developer")'); await p.click('.choice:has-text("Elite international academy")');
  await p.click('.cta:has-text("Next")'); await p.click('button:has-text("Create career")'); await idle();
  for (let i = 0; i < 40; i++) {
    if (await p.locator('.screen[aria-label="Block results"]').count()) { const sk = p.locator('.screen button:has-text("Skip to summary")'); if (await sk.count()) await sk.click(); await p.waitForTimeout(200); await p.locator('.screen .cta:has-text("Season review"), .screen .cta:has-text("Back to career")').first().click(); await p.waitForTimeout(300); continue; }
    if (await p.locator('.approach').count()) break;
    if (await p.locator('h2:has-text("Your next four years")').count()) { await p.click('.choice:has-text("Tour full time")'); }
    const ye = p.locator('.cta:has-text("Start 20")'); if (await ye.count()) { await ye.click(); await idle(); continue; }
    const inj = p.locator('.choice:has-text("Conservative rehab")'); if (await inj.count()) { await inj.click(); await idle(); continue; }
    const plan = p.locator('button:has-text("Plan the swing")'); if (await plan.count()) { R.swings++; await plan.click(); await p.waitForTimeout(300); await p.locator('.dock .cta').click(); await p.waitForTimeout(200); if (await p.locator('[aria-label="Your decision"]').count()) { await p.locator('[aria-label="Your decision"] .choice').first().click(); await p.locator('.dock .cta').click(); } await p.click('.dock .cta:has-text("Play the swing")'); await idle(); continue; }
    await p.waitForTimeout(500);
  }
  R.approach = await p.locator('.approach').count();
  if (R.approach) {
    await p.locator('.approach').scrollIntoViewIfNeeded(); await shot('p1-approach');
    R.title = await p.locator('.approach h3').innerText();
    await p.click('.approach .cta'); await idle(); await p.waitForTimeout(300);
    R.after = await p.locator('.approach').count();
    await p.click('nav >> text=Life'); await p.waitForTimeout(400);
    await p.locator('.cc-deal').first().scrollIntoViewIfNeeded(); await shot('p2-team');
    R.deal = await p.locator('.cc-deal').first().innerText(); R.patience = await p.locator('.patience').count();
  }
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})();
