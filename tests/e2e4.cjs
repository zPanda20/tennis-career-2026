// Features test: flags, Rankings, Life, portrait upload, game-by-game and Top player watching, no after-the-fact replays.
const { chromium } = require('playwright');
(async () => {
  const [out, face] = process.argv.slice(2);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 180000 });
  const shot = (n, full) => p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full });
  const R = {};
  await p.goto('http://localhost:4173/'); await p.click('text=Start a new career'); await p.click('.choice:has-text("Age 19")'); await p.click('text=Skip ahead with a random identity');
  R.nations = await p.evaluate(() => 0); for (let k = 0; k < 3; k++) await p.click('.row.end button:has-text("Back")');
  R.nations = await p.locator('select >> nth=0').locator('option').count(); await p.selectOption('select >> nth=0', 'URU');
  await p.locator('input[type=file][accept="image/*"]').setInputFiles(face); await p.waitForTimeout(500); await shot('f0-create-portrait');
  R.createPortrait = await p.locator('.preview img.avatar').count();
  await p.click('.cta:has-text("Next")'); await p.click('.cta:has-text("Next")'); await p.click('.cta:has-text("Next")');
  await p.click('button:has-text("Create career")'); await idle();
  R.hudFlag = await p.locator('.crest .flag').count(); R.hudPortrait = await p.locator('.crest img.avatar').count();
  await p.waitForTimeout(400); await shot('f1-home');
  await p.click('.navpill button:has-text("Rankings")'); await p.waitForTimeout(400); await shot('f2-rankings'); R.rankRows = await p.locator('.rk tbody tr').count(); R.flagsOnRank = await p.locator('.rk .flag.fi').count(); R.neutral = await p.locator('.rk .flag.neutral').count();
  await p.click('button:has-text("Jump to me")'); await p.waitForTimeout(800); await shot('f3-rankings-me');
  await p.click('.navpill button:has-text("Life")'); await p.waitForTimeout(300); await shot('f4-life', true);
  await p.click('.navpill button:has-text("Calendar")'); await p.waitForTimeout(300); await shot('f5-calendar'); R.coloured = await p.locator('.evn.clay, .evn.hard, .evn.grass').count();
  // play one swing in game-by-game
  await p.click('.navpill button:has-text("Career")'); await p.click('button:has-text("Plan the swing")'); await p.locator('.dock .cta').click();
  if (await p.locator('[aria-label="Your decision"]').count()) { await p.locator('[aria-label="Your decision"] .choice').first().click(); await p.locator('.dock .cta').click(); }
  await p.locator('.dock .cta:has-text("Play the swing")').click(); await idle(); await p.waitForSelector('.screen[aria-label="Block results"]');
  await p.selectOption('.pace select', 'game'); await p.click('button[aria-label="Pause"]').catch(() => {});
  for (let k = 0; k < 7; k++) await p.locator('.dock .cta').click();
  await p.waitForTimeout(400); await shot('f6-game'); R.gameHead = await p.locator('.reveal-head h1').innerText(); R.liveCell = await p.locator('.sc.live').count(); R.nextLabel = await p.locator('.dock .cta').innerText();
  await p.click('button:has-text("To end of match")'); await p.locator('.dock .cta').click(); await p.waitForTimeout(300); R.afterEnd = await p.locator('.reveal-head h1').innerText();
  await p.selectOption('.pace select', 'top'); await p.waitForTimeout(300); await shot('f7-top');
  await p.click('text=Skip to summary'); await p.locator('.dock .cta').click();
  R.replayButtons = await p.locator('text=/Replay|Watch last|Watch the final|Watch the whole/').count();
  await p.click('.navpill button:has-text("Life")'); await p.waitForTimeout(300); R.lifeHistory = await p.locator('.stack-row').count(); await shot('f8-life-after', true);
  await p.click('.navpill button:has-text("Player")'); await p.waitForTimeout(300); await shot('f9-player'); R.playerPortrait = await p.locator('.portrait img.avatar').count();
  await p.setViewportSize({ width: 390, height: 844 }); await p.click('.bottomnav button:has-text("Rankings")'); await p.waitForTimeout(400); await shot('f10-mobile-rankings');
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(JSON.stringify({ errs, ...R }));
  await b.close();
})().catch(e => { console.error('E2E4 FAILED', e); process.exit(1); });
