const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');

(async () => {
  const vite = spawn('npx.cmd', ['vite', '--port', '7100'], { cwd: __dirname });
  await new Promise(r => setTimeout(r, 5000));

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const logs = [];
  page.on('console', m => logs.push('[console.' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[PAGEERROR] ' + e.message));
  page.on('requestfailed', r => logs.push('[REQFAIL] ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

  await page.goto('http://localhost:7100/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const state1 = await page.evaluate(() => ({
    hasCanvas: !!document.querySelector('#stage canvas'),
    overlayHidden: document.getElementById('overlay-intro').classList.contains('hidden'),
  }));

  await page.click('#btn-start').catch(e => logs.push('[CLICKFAIL] ' + e.message));
  await new Promise(r => setTimeout(r, 4000));

  const state2 = await page.evaluate(() => ({
    overlayHidden: document.getElementById('overlay-intro').classList.contains('hidden'),
    dockCards: document.querySelectorAll('.b-card').length,
    godBtns: document.querySelectorAll('.god-btn').length,
    eraName: document.getElementById('era-name').textContent,
    food: document.getElementById('r-food').textContent,
    pop: document.getElementById('r-pop').textContent,
  }));

  await page.screenshot({ path: '_debug.png' });

  console.log('STATE_BEFORE_CLICK: ' + JSON.stringify(state1));
  console.log('STATE_AFTER_CLICK:  ' + JSON.stringify(state2));
  console.log('LOGS:\n' + logs.slice(0, 40).join('\n'));

  await browser.close();
  vite.kill();
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
