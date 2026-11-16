// Junior start: create a 16-year-old, check the junior ring, planner, rankings and Life tab, then simulate to the path decision at 18.
const { chromium } = require('playwright');
(async () => {
  const [out] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = {};
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => !document.querySelector('.packnote'), null, { timeout: 120000 }).catch(() => {});
  await p.click('text=Start a new career'); await shot('j0-tour', true);
  await p.click('text=Skip ahead with a random identity');
  // step back to the profile step to pick a speed and academy
  for (let i = 0; i < 4 && !(await p.locator('legend:has-text("Development speed")').count()); i++) await p.click('.row.end .btn:has-text("Back")');
  R.speedStep = await p.locator('legend:has-text("Development speed")').count();
  await p.click('.choice:has-text("Late developer")'); await p.click('.choice:has-text("Elite international academy")'); await shot('j1-profile', true);
  await p.click('.cta:has-text("Next")'); await shot('j2-confirm');
  await p.click('button:has-text("Create career")'); await idle(); await shot('j3-home');
  R.ring = await p.locator('.medal .lbl').first().innerText();
  await p.click('button:has-text("Plan the swing")'); await p.waitForTimeout(400); await shot('j4-planner', true);
  R.plannerJunior = await p.locator('text=/ITF J\\d+|Junior/').count();
  await p.click('button[aria-label="Back to career"]'); await p.waitForTimeout(300);
  await p.click('nav >> text=Rankings').catch(() => p.click('text=Rankings'));
  await p.click('button:has-text("Juniors")'); await p.waitForTimeout(300); await shot('j5-jrank');
  R.jrankTitle = await p.locator('h1').first().innerText();
  await p.click('nav >> text=Life').catch(() => p.click('text=Life'));
  await p.waitForTimeout(300); R.road = await p.locator('h3:has-text("Junior years")').count(); await shot('j6-life', true);
  await p.click('nav >> text=Career'); await p.waitForTimeout(300);
  // simulate two seasons to the decision at 18
  for (let i = 0; i < 30; i++) {
    if (await p.locator('.screen[aria-label="Block results"]').count()) { const sk = p.locator('.screen button:has-text("Skip to summary")'); if (await sk.count()) await sk.click(); await p.waitForTimeout(200); await p.locator('.screen .cta:has-text("Season review"), .screen .cta:has-text("Back to career")').first().click(); await p.waitForTimeout(300); continue; }
    if (await p.locator('h2:has-text("Your next four years")').count()) break;
    const ye = p.locator('.cta:has-text("Start 20")'); if (await ye.count()) { await ye.click(); await idle(); continue; }
    const inj = p.locator('.choice:has-text("Conservative rehab")'); if (await inj.count()) { await inj.click(); await idle(); continue; }
    const sim = p.locator('button:has-text("Simulate to season")'); if (await sim.count()) { await sim.click(); await idle(); await p.waitForTimeout(300); continue; }
    const plan = p.locator('button:has-text("Plan the swing")'); if (await plan.count()) { await plan.click(); await p.waitForTimeout(300); await p.locator('.dock .cta').click(); await p.waitForTimeout(200); if (await p.locator('[aria-label="Your decision"]').count()) { await p.locator('[aria-label="Your decision"] .choice').first().click(); await p.locator('.dock .cta').click(); } await p.click('.dock .cta:has-text("Play the swing")'); await idle(); continue; }
    await p.waitForTimeout(500);
  }
  R.decision = await p.locator('h2:has-text("Your next four years")').count();
  await shot('j7-decision', true);
  R.startDisabled = await p.locator('.cta:has-text("Choose your path first")').isDisabled().catch(() => null);
  await p.click('.choice:has-text("University tennis")'); await p.click('.cta:has-text("Start 2028")'); await idle(); await p.waitForTimeout(400);
  await shot('j8-college');
  R.after = await p.locator('.medal .target b').allInnerTexts();
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})();
