const puppeteer = require('puppeteer-core');
const CHROME = '/opt/chrome-headless-shell-linux64/chrome-headless-shell';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push('[c.' + m.type() + '] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[PAGEERROR] ' + e.message + '\n' + e.stack));
  page.on('requestfailed', (r) => logs.push('[REQFAIL] ' + r.url()));

  // domcontentloaded = DOM parsed but sub-resources may still be loading
  await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 200));
  const s0 = await page.evaluate(() => ({
    readyState: document.readyState,
    hasLoading: !!document.getElementById('loading'),
    hasIntro: !!document.getElementById('overlay-intro'),
    bodyHasChildren: document.body ? document.body.children.length : -1,
  }));
  console.log('T+200ms:', JSON.stringify(s0));

  await new Promise((r) => setTimeout(r, 500));
  const s1 = await page.evaluate(() => ({
    readyState: document.readyState,
    loadingHidden: document.getElementById('loading')?.classList.contains('hidden'),
    loadingExists: !!document.getElementById('loading'),
    introHidden: document.getElementById('overlay-intro')?.classList.contains('hidden'),
    uiHidden: document.getElementById('ui')?.classList.contains('ui-hidden'),
    canvasCount: document.querySelectorAll('#stage canvas').length,
  }));
  console.log('T+700ms:', JSON.stringify(s1));

  await new Promise((r) => setTimeout(r, 2000));
  const s2 = await page.evaluate(() => ({
    readyState: document.readyState,
    loadingExists: !!document.getElementById('loading'),
    loadingHidden: document.getElementById('loading')?.classList.contains('hidden'),
    introHidden: document.getElementById('overlay-intro')?.classList.contains('hidden'),
    introVisible: document.getElementById('overlay-intro') && !document.getElementById('overlay-intro').classList.contains('hidden'),
    uiHidden: document.getElementById('ui')?.classList.contains('ui-hidden'),
    introContentHtml: document.getElementById('intro-content')?.innerHTML?.slice(0, 300),
  }));
  console.log('T+2700ms:', JSON.stringify(s2, null, 2));

  console.log('LOGS:\n' + logs.slice(0, 40).join('\n'));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
