// Browser test 2: image pack, retirement, exports, reload/resume, backup import. Usage: node tests/e2e2.cjs <shots> <packDir> <downloadDir>
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, pack, dl] = process.argv.slice(2);
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }), p = await ctx.newPage();
  await p.addInitScript(() => { delete window.showSaveFilePicker; });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('dialog', d => d.accept());
  const idle = () => p.waitForSelector('.busy', { state: 'detached', timeout: 120000 });
  await p.goto('http://localhost:4173/'); await p.click('text=Start a new career'); await p.click('text=Skip ahead with a random identity'); await p.click('button:has-text("Create career")'); await p.waitForSelector('text=Plan the swing', { timeout: 60000 });
  // image pack
  await p.click('button[aria-label="Menu"]'); await p.click('text=Settings and backup'); await p.locator('input[type=file][webkitdirectory]').setInputFiles(pack); await p.waitForSelector('text=/Loaded \\d+ images/', { timeout: 20000 });
  const packMsg = await p.locator('text=/Loaded \\d+ images/').first().innerText();
  await p.click('.navpill button:has-text("Tour")'); await p.waitForTimeout(400); const imgs = await p.locator('img.avatar').count(); await p.screenshot({ path: `${out}/20-world-pack.png` });
  // play two blocks, then reload mid-career and check the save survives
  for (let i = 0; i < 2; i++) {
    await p.click('.navpill button:has-text("Career")'); await idle();
    if (await p.locator('text=Conservative rehab').count()) { await p.click('text=Conservative rehab'); await idle(); }
    if (await p.locator('.screen[aria-label="Block results"]').count()) { await p.click('text=Skip to summary'); await p.click('.dock button:has-text("Back to career")'); }
    await p.click('button:has-text("Plan the swing")'); await p.waitForSelector('.routes'); await p.locator('.dock .cta').click();
    if (await p.locator('[aria-label="Your decision"]').count()) { await p.locator('[aria-label="Your decision"] .choice').nth(1).click(); await p.locator('.dock .cta').click(); }
    await p.locator('.dock .cta:has-text("Play the swing")').click(); await idle();
    if (await p.locator('.screen[aria-label="Block results"]').count()) { await p.click('text=Skip to summary'); await p.click('.dock button:has-text("Back to career")'); }
  }
  const before = await p.locator('.crest small').innerText();
  await p.reload(); await p.waitForSelector('text=Continue'); await p.locator('button:has-text("Continue")').first().click(); await p.waitForSelector('.crest'); const after = await p.locator('.crest small').innerText();
  // backup export
  await p.click('button[aria-label="Menu"]'); await p.click('text=Settings and backup'); const [bk] = await Promise.all([p.waitForEvent('download'), p.click('text=Export a backup of this career')]); await bk.saveAs(`${dl}/backup.json`);
  // retire and export
  await p.click('.navpill button:has-text("Career")'); await p.click('text=Retire from professional tennis'); await idle(); await p.waitForSelector('text=Save your career');
  await p.screenshot({ path: `${out}/21-review.png`, fullPage: true });
  const [pdf] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('text=Save review as PDF')]); await pdf.saveAs(`${dl}/${pdf.suggestedFilename()}`);
  await p.waitForSelector('button:has-text("Save career archive (JSON)"):not([disabled])');
  const [js] = await Promise.all([p.waitForEvent('download'), p.click('text=Save career archive (JSON)')]); await js.saveAs(`${dl}/${js.suggestedFilename()}`);
  const ro = await p.locator('button:has-text("Plan the swing")').count();
  // library: retired career is listed read-only; import the backup (active copy replaces it after confirm)
  await p.click('button[aria-label="Menu"]'); await p.click('text=Career library'); await p.waitForSelector('text=Completed careers'); await p.locator('input[type=file][accept*="json"]').setInputFiles(`${dl}/backup.json`); await p.waitForSelector('text=/Backup restored/');
  const archiveImport = `${dl}/${js.suggestedFilename()}`; await p.locator('.banner .icon').click(); await p.locator('input[type=file][accept*="json"]').setInputFiles(archiveImport); await p.waitForSelector('.banner.crit'); const rejectMsg = await p.locator('.banner.crit span').innerText();
  await p.screenshot({ path: `${out}/22-library.png` });
  console.log(JSON.stringify({ errs, packMsg, imgs, before, after, sameAfterReload: before === after, pdf: pdf.suggestedFilename(), pdfBytes: fs.statSync(`${dl}/${pdf.suggestedFilename()}`).size, json: js.suggestedFilename(), planButtonsAfterRetire: ro, rejectMsg }));
  await b.close();
})().catch(e => { console.error('E2E2 FAILED', e); process.exit(1); });
