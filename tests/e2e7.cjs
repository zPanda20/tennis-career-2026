// Visual check: Tour tab, Player page (rank chart, trophy sort), Life order, season tints in watch mode.
const { chromium } = require('playwright');
(async () => {
  const [out] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = {};
  await p.goto('http://localhost:4173/'); await p.click('text=Start a new career'); await p.click('text=Skip ahead with a random identity');
  await p.click('button:has-text("Create career")'); await idle();
  await p.click('button:has-text("Simulate to season\'s end")'); await idle(); await p.waitForSelector('.screen[aria-label="Block results"]', { timeout: 300000 });
  await p.selectOption('.pace select', 'event'); await p.waitForTimeout(200);
  const tints = new Set();
  for (let k = 0; k < 40; k++) { const c = await p.locator('.screen').getAttribute('class'); const t = c.match(/s-(\w+)/)?.[1]; if (!tints.has(t)) { tints.add(t); await shot('t-watch-' + t); } if (await p.locator('.screen-top .t').innerText() === 'THE SUMMARY') break; await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120); }
  R.tints = [...tints];
  await p.keyboard.press('s'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  await p.click('.cta:has-text("Start")'); await idle(); await p.waitForTimeout(300);
  await p.click('.navpill button:has-text("Tour")'); await p.waitForTimeout(300); await shot('t-tour-champs', true);
  await p.click('button:has-text("Head to head")'); await p.waitForTimeout(200); await shot('t-tour-h2h', true);
  await p.click('button:has-text("Find a player")'); await p.fill('.search input', 'al'); await p.waitForTimeout(200); await shot('t-tour-find', true);
  await p.click('.navpill button:has-text("Player")'); await p.waitForTimeout(300); await shot('t-player', true);
  await p.click('.navpill button:has-text("Life")'); await p.waitForTimeout(300); await shot('t-life', true);
  await p.setViewportSize({ width: 390, height: 844 }); await p.click('.navpill button:has-text("Tour")').catch(() => {});
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Tour'); b && b.click(); }); await p.waitForTimeout(300); await shot('t-tour-mobile', true);
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})().catch(e => { console.error('E2E7 FAILED', e); process.exit(1); });
