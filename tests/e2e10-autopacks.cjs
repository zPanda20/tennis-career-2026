const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(500);
  await p.waitForFunction(() => !document.querySelector('.packnote'), null, { timeout: 120000 });
  await p.click('text=Start a new career'); await p.click('text=Skip ahead with a random identity'); await p.click('button:has-text("Create career")');
  await p.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  await p.click('.navpill button:has-text("Rankings")'); await p.waitForTimeout(1500);
  await p.click('button:has-text("Jump to me")'); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const rows = [...document.querySelectorAll('.rk tbody tr')]; const fict = rows.filter(x => x.querySelector('.tag')); const top = rows.slice(0, 40); return { topWithPhoto: top.filter(x => x.querySelector('img.avatar')).length, fictional: fict.length, fictionalWithFace: fict.filter(x => x.querySelector('img.avatar')).length }; });
  console.log(JSON.stringify({ errs, ...r }));
  await b.close();
})();
