// Asset pack: load in Settings with the face pack; check photos, logos and brand names show.
const { chromium } = require('playwright');
(async () => {
  const [out, assets, faces] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = {};
  await p.goto('http://localhost:4173/'); await p.click('text=Start a new career'); await p.click('.choice:has-text("Age 19")'); await p.click('text=Skip ahead with a random identity');
  await p.click('button:has-text("Create career")'); await idle();
  await p.click('.hud button[aria-label*="enu"]').catch(() => {}); await p.click('text=Settings').catch(() => {}); await p.waitForTimeout(300);
  await p.setInputFiles('input[accept=".tcassets"]', assets); await p.waitForSelector('text=/player photos/', { timeout: 60000 });
  R.assetMsg = await p.locator('text=/player photos/').first().innerText();
  await p.setInputFiles('input[accept=".tcfaces"]', faces); await p.waitForSelector('text=/faces loaded/', { timeout: 600000 });
  await p.click('.navpill button:has-text("Rankings")'); await p.waitForTimeout(1500); await shot('a1-rankings');
  R.realImgs = await p.evaluate(() => [...document.querySelectorAll('.rk tbody tr')].slice(0, 40).filter(r => r.querySelector('img.avatar')).length);
  await p.click('.navpill button:has-text("Calendar")'); await p.waitForTimeout(800); await shot('a2-calendar', true); R.logos = await p.locator('img.evlogo').count();
  await p.click('button:has-text("Simulate to season\'s end")').catch(async () => { await p.click('.navpill button:has-text("Career")'); await p.click('button:has-text("Simulate to season\'s end")'); });
  await idle(); await p.waitForSelector('.screen[aria-label="Block results"]', { timeout: 300000 });
  await p.selectOption('.pace select', 'event'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600); await shot('a3-watch');
  await p.keyboard.press('s'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600); await shot('a4-yearend', true);
  R.brands = await p.locator('.spoffer .brand b').allInnerTexts();
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})().catch(e => { console.error('E2E9 FAILED', e); process.exit(1); });
