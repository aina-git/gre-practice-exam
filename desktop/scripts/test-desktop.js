// Launches the real Electron app and checks the desktop-specific behaviour:
// the page loads from disk, a practice runs, closing mid-practice pauses it
// (keeping place and clock) instead of losing it, and the next launch offers
// to resume. Run with: npm test   (on Linux without a display: xvfb-run npm test)
const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');

let passed = 0, failed = 0;
const ok = (label, cond, detail) => { if (cond) { passed++; console.log('  ok   ' + label); } else { failed++; console.log('  FAIL ' + label + (detail ? ' — ' + detail : '')); } };
const appDir = path.join(__dirname, '..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'gre-ready-test-'));
const launch = () => electron.launch({
  args: [appDir, '--no-sandbox'],
  env: { ...process.env, GRE_DESKTOP_TEST: '1', GRE_DESKTOP_USERDATA: userData },
});

(async () => {
  console.log('\nFirst launch');
  let app = await launch();
  let win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForSelector('#page-home.active');
  ok('window title', /GRE Ready/.test(await win.title()), await win.title());
  ok('page is served from disk', (await win.url()).startsWith('file:'), await win.url());
  ok('desktop flag is exposed to the page', await win.evaluate(() => !!(window.greDesktop && window.greDesktop.platform)));
  const bank = await win.evaluate(() => Object.values(VBANK).reduce((a, v) => a + v.length, 0));
  ok('question bank loaded offline', bank > 200, String(bank));
  await win.evaluate(() => { S.profile.name = 'Tester'; S.profile.namePrompted = true; save(); });
  await win.click('text=Quant Set');
  await win.click('text=Begin →');
  await win.waitForSelector('#page-exam.active');
  const c = win.locator('#q-host .choice').first(); if (await c.count()) await c.click();
  await win.click('#btn-next');
  const before = await win.evaluate(() => ({ qi: exam.sec.qi, t: exam.sec.timeLeft }));
  ok('a practice is running', before.qi === 1 && before.t > 1500, JSON.stringify(before));

  console.log('\nClose the window mid-practice (test mode answers "Pause and quit")');
  const exited = new Promise((r) => app.process().once('exit', r));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await Promise.race([exited, new Promise((_, rej) => setTimeout(() => rej(new Error('app did not exit')), 15000))]);
  ok('the app quits instead of being blocked by the page\'s unload guard', true);

  console.log('\nSecond launch');
  app = await launch();
  win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForSelector('#page-home.active');
  await win.waitForTimeout(300);
  const snap = await win.evaluate(() => JSON.parse(localStorage.getItem('greReady_active') || 'null'));
  ok('the paused practice survived the restart', !!snap && snap.qi === 1 && snap.timeLeft > 1400, JSON.stringify(snap && { qi: snap.qi, t: snap.timeLeft }));
  const offered = (await win.locator('.resume-card').count()) === 1 || (await win.locator('text=Unfinished practice').count()) === 1;
  ok('the home screen offers to resume it', offered);
  ok('scores are kept in the app\'s own data folder', fs.existsSync(path.join(userData, 'Local Storage')) || fs.existsSync(path.join(userData, 'window.json')));
  await app.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(2); });
