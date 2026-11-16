// Face pack: load in Settings, fictional players show faces, real players do not, user can take a generated face; shortcut hints dismiss.
const { chromium } = require('playwright');
(async () => {
  const [out, pack] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = {};
  await p.goto('http://localhost:4173/'); await p.click('text=Start a new career'); await p.click('.choice:has-text("Age 19")'); await p.click('text=Skip ahead with a random identity');
  await p.click('button:has-text("Create career")'); await idle();
  await p.click('.hud button[aria-label*="enu"]').catch(() => {}); await p.click('text=Settings').catch(() => {}); await p.waitForTimeout(300);
  const t0 = Date.now(); await p.setInputFiles('input[accept=".tcfaces"]', pack);
  await p.waitForSelector('text=/faces loaded/', { timeout: 600000 }); R.loadSecs = Math.round((Date.now() - t0) / 1000);
  R.msg = await p.locator('section:has(h3:has-text("Face pack")) p.muted').innerText();
  await p.click('.navpill button:has-text("Rankings")'); await p.waitForTimeout(300); await p.click('button:has-text("Jump to me")'); await p.waitForTimeout(1500);
  R.imgs = await p.evaluate(() => { const rows = [...document.querySelectorAll('.rk tbody tr')]; let fict = 0, fictImg = 0, real = 0, realImg = 0; for (const r of rows) { const f = !!r.querySelector('.tag'), img = !!r.querySelector('img.avatar'); if (f) { fict++; if (img) fictImg++; } else if (!r.classList.contains('me')) { real++; if (img) realImg++; } } return { fict, fictImg, real, realImg }; });
  await shot('f1-rankings');
  await p.click('.navpill button:has-text("Player")'); await p.waitForTimeout(300);
  await p.click('button:has-text("Generated face")'); await idle(); await p.waitForTimeout(400); R.userImg = await p.locator('.portrait img.avatar').count();
  await p.click('button:has-text("Another face")'); await idle(); await p.waitForTimeout(400); await shot('f2-player');
  await p.click('.navpill button:has-text("Career")'); await p.waitForTimeout(200);
  await p.click('button:has-text("Simulate to season\'s end")'); await idle(); await p.waitForSelector('.screen[aria-label="Block results"]', { timeout: 300000 });
  await p.selectOption('.pace select', 'match'); await p.keyboard.press('Space'); await p.waitForTimeout(400); await shot('f3-watch');
  await p.click('.keys-x'); await p.waitForTimeout(200); R.hintHidden = await p.locator('.keys-show').count();
  await p.reload(); await idle().catch(() => {}); await p.waitForTimeout(1500);
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})().catch(e => { console.error('E2E8 FAILED', e); process.exit(1); });
