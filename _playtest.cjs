/* Deus Isle UI 重构验证脚本
 * 用 chrome-headless-shell + puppeteer-core 打开 http://localhost:5174/
 * 步骤：加载动画 → 主菜单 → 进入游戏 HUD → 折叠底栏 → 折叠资源 → 暂停 → 配色静态扫描
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/opt/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = 'http://localhost:5174/';
const OUT = '/workspace/_playtest_shots';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const logs = [];
  page.on('console', (m) => logs.push('[c.' + m.type() + '] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[PAGEERROR] ' + e.message + '\n' + e.stack));
  page.on('requestfailed', (r) => logs.push('[REQFAIL] ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

  const results = {};

  /* ============== 1. 加载动画 ==============
   * 页面很快完成加载，loader 在 page.goto 返回前就 hidden 了。
   * 通过 addInitScript 在 main.ts 之前注入 CSS：强制 #loading 始终可见，
   * 这样我们能截图并读取原始样式（颜色/字号仍由 .loader-* CSS 决定，不受影响）。
   */
  await page.evaluateOnNewDocument(() => {
    const style = document.createElement('style');
    style.id = '__loader_lock';
    style.textContent =
      '#loading.hidden { opacity:1 !important; pointer-events:auto !important; }' +
      '#loading { opacity:1 !important; pointer-events:auto !important; display:flex !important; }';
    (document.head || document.documentElement).appendChild(style);
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, '01-loading.png') });

  const loadingInfo = await page.evaluate(() => {
    const el = document.getElementById('loading');
    const title = document.querySelector('.loader-title');
    const bar = document.querySelector('.loader-bar');
    const barInner = document.querySelector('.loader-bar i');
    const cs = title ? getComputedStyle(title) : null;
    const csBar = bar ? getComputedStyle(bar) : null;
    const csInner = barInner ? getComputedStyle(barInner) : null;
    return {
      loadingVisible: el && getComputedStyle(el).opacity !== '0',
      titleText: title ? title.textContent.trim() : '',
      titleColor: cs ? cs.color : '',
      titleFontWeight: cs ? cs.fontWeight : '',
      titleLetterSpacing: cs ? cs.letterSpacing : '',
      titleFontSize: cs ? cs.fontSize : '',
      barBg: csBar ? csBar.backgroundColor : '',
      barBorder: csBar ? csBar.border : '',
      barWidth: csBar ? csBar.width : '',
      barHeight: csBar ? csBar.height : '',
      barInnerBg: csInner ? csInner.backgroundColor : '',
      barInnerWidth: csInner ? csInner.width : '',
      bodyBg: getComputedStyle(document.body).backgroundColor,
      onlyLoaderChildren: el ? Array.from(el.children).map((c) => c.className) : [],
    };
  });
  results.loading = loadingInfo;
  console.log('LOADING_STATE: ' + JSON.stringify(loadingInfo, null, 2));

  /* ============== 2. 取消 loader 锁定，正常进入主菜单 ============== */
  await page.evaluate(() => {
    document.getElementById('__loader_lock')?.remove();
    const loader = document.getElementById('loading');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 200);
    }
    document.getElementById('overlay-intro').classList.remove('hidden');
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, '02-mainmenu.png') });

  const menuInfo = await page.evaluate(() => {
    const intro = document.getElementById('overlay-intro');
    const introCs = intro ? getComputedStyle(intro) : null;
    const titleEn = document.querySelector('.intro-en');
    const titleZh = document.querySelector('.intro-zh');
    const enCs = titleEn ? getComputedStyle(titleEn) : null;
    const zhCs = titleZh ? getComputedStyle(titleZh) : null;
    const links = Array.from(document.querySelectorAll('.intro-link')).map((b) => {
      const cs = getComputedStyle(b);
      return {
        text: b.textContent.trim(),
        color: cs.color,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
        background: cs.background,
        border: cs.border,
      };
    });
    return {
      introVisible: intro && !intro.classList.contains('hidden'),
      introBg: introCs ? introCs.backgroundColor : '',
      introBackdrop: introCs ? introCs.backdropFilter : '',
      enText: titleEn ? titleEn.textContent.trim() : '',
      enColor: enCs ? enCs.color : '',
      enFontWeight: enCs ? enCs.fontWeight : '',
      zhText: titleZh ? titleZh.textContent.trim() : '',
      zhColor: zhCs ? zhCs.color : '',
      links,
    };
  });
  results.menu = menuInfo;
  console.log('MENU_STATE: ' + JSON.stringify(menuInfo, null, 2));

  /* ============== 3. 点击开始游戏 ============== */
  const startBtnInfo = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('.intro-link'));
    const start = links.find((b) => /start|开始/i.test(b.textContent));
    return { found: !!start, text: start ? start.textContent.trim() : '' };
  });
  console.log('START_BTN: ' + JSON.stringify(startBtnInfo));

  await page.evaluate(() => {
    const start = Array.from(document.querySelectorAll('.intro-link')).find((b) => /start|开始/i.test(b.textContent));
    if (start) start.click();
  });
  // 飞入动画 2.6s + 缓冲
  await new Promise((r) => setTimeout(r, 4500));
  await page.screenshot({ path: path.join(OUT, '03-game-hud.png') });

  const hudInfo = await page.evaluate(() => {
    const eraBadge = document.getElementById('era-badge');
    const eraBadgeCs = eraBadge ? getComputedStyle(eraBadge) : null;
    const eraName = document.getElementById('era-name');
    const eraNameCs = eraName ? getComputedStyle(eraName) : null;
    const resources = Array.from(document.querySelectorAll('.res')).map((el) => {
      const cs = getComputedStyle(el);
      return { label: el.getAttribute('title'), text: el.textContent.trim(), color: cs.color, bg: cs.backgroundColor, border: cs.border };
    });
    const taskPanel = document.getElementById('task-panel');
    const taskHead = document.querySelector('.task-head');
    const taskHeadCs = taskHead ? getComputedStyle(taskHead) : null;
    const skillBar = document.getElementById('skill-bar');
    const bCards = Array.from(document.querySelectorAll('.b-card')).map((el) => {
      const name = el.querySelector('.b-name');
      const cs = getComputedStyle(el);
      const nameCs = name ? getComputedStyle(name) : null;
      return {
        name: name ? name.textContent.trim() : '',
        sel: el.classList.contains('sel'),
        nameColor: nameCs ? nameCs.color : '',
        cardBg: cs.backgroundColor,
        cardBorder: cs.border,
      };
    });
    const godBtns = Array.from(document.querySelectorAll('.god-btn')).map((el) => {
      const span = el.querySelector('span');
      const cs = getComputedStyle(el);
      const spanCs = span ? getComputedStyle(span) : null;
      return {
        label: span ? span.textContent.trim() : '',
        color: spanCs ? spanCs.color : '',
        bg: cs.backgroundColor,
        border: cs.border,
      };
    });
    const actBtns = Array.from(document.querySelectorAll('.act-btn')).map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: el.textContent.trim().replace(/\s+/g, ' '),
        color: cs.color,
        bg: cs.backgroundColor,
        border: cs.border,
        disabled: el.disabled,
      };
    });
    const collapseResBtn = document.getElementById('btn-collapse-res');
    const pauseBtn = document.getElementById('btn-pause');
    const bottomToggle = document.getElementById('bottombar-toggle');
    const skillBarCs = skillBar ? getComputedStyle(skillBar) : null;
    const taskPanelCs = taskPanel ? getComputedStyle(taskPanel) : null;
    const ui = document.getElementById('ui');
    return {
      uiVisible: ui ? !ui.classList.contains('ui-hidden') : false,
      eraBadge: {
        bg: eraBadgeCs ? eraBadgeCs.backgroundColor : '',
        border: eraBadgeCs ? eraBadgeCs.border : '',
        name: eraName ? eraName.textContent.trim() : '',
        nameColor: eraNameCs ? eraNameCs.color : '',
        nameFontWeight: eraNameCs ? eraNameCs.fontWeight : '',
      },
      resources,
      taskPanel: {
        top: taskPanelCs ? taskPanelCs.top : '',
        left: taskPanelCs ? taskPanelCs.left : '',
        bg: taskPanelCs ? taskPanelCs.backgroundColor : '',
        border: taskPanelCs ? taskPanelCs.border : '',
        headText: taskHead ? taskHead.textContent.trim() : '',
        headColor: taskHeadCs ? taskHeadCs.color : '',
        headTextTransform: taskHeadCs ? taskHeadCs.textTransform : '',
        childCount: taskPanel ? taskPanel.querySelectorAll('.task-item').length : -1,
      },
      skillBar: {
        childCount: skillBar ? skillBar.children.length : -1,
        top: skillBarCs ? skillBarCs.top : '',
        right: skillBarCs ? skillBarCs.right : '',
      },
      bCards,
      godBtns,
      actBtns,
      buttonsExist: {
        collapseRes: !!collapseResBtn,
        pause: !!pauseBtn,
        bottomToggle: !!bottomToggle,
      },
    };
  });
  results.hud = hudInfo;
  console.log('HUD_STATE: ' + JSON.stringify(hudInfo, null, 2));

  /* ============== 4. 折叠底栏 ============== */
  await page.click('#bottombar-toggle');
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, '04-bottombar-collapsed.png') });
  const bottomCollapsed = await page.evaluate(() => document.getElementById('bottombar').classList.contains('collapsed'));
  results.bottomCollapse = { collapsed: bottomCollapsed };
  console.log('BOTTOM_COLLAPSE: ' + bottomCollapsed);
  // 还原
  await page.click('#bottombar-toggle');
  await new Promise((r) => setTimeout(r, 400));

  /* ============== 5. 折叠资源条 ============== */
  await page.click('#btn-collapse-res');
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, '05-res-collapsed.png') });
  const resCollapsed = await page.evaluate(() => document.getElementById('topbar-left').classList.contains('collapsed'));
  results.resCollapse = { collapsed: resCollapsed };
  console.log('RES_COLLAPSE: ' + resCollapsed);
  // 还原
  await page.click('#btn-collapse-res');
  await new Promise((r) => setTimeout(r, 300));

  /* ============== 6. 暂停 ============== */
  await page.click('#btn-pause');
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, '06-pause.png') });

  const pauseInfo = await page.evaluate(() => {
    const ov = document.getElementById('overlay-pause');
    const cs = ov ? getComputedStyle(ov) : null;
    const title = document.querySelector('.pause-title');
    const titleCs = title ? getComputedStyle(title) : null;
    const links = Array.from(document.querySelectorAll('.pause-link')).map((el) => {
      const cs = getComputedStyle(el);
      return { text: el.textContent.trim(), color: cs.color, background: cs.background, border: cs.border };
    });
    return {
      visible: ov && !ov.classList.contains('hidden'),
      overlayBg: cs ? cs.backgroundColor : '',
      overlayBackdrop: cs ? cs.backdropFilter : '',
      titleText: title ? title.textContent.trim() : '',
      titleColor: titleCs ? titleCs.color : '',
      titleTextTransform: titleCs ? titleCs.textTransform : '',
      titleLetterSpacing: titleCs ? titleCs.letterSpacing : '',
      links,
    };
  });
  results.pause = pauseInfo;
  console.log('PAUSE_STATE: ' + JSON.stringify(pauseInfo, null, 2));

  // 关闭暂停
  await page.click('.pause-link[data-pause="resume"]');
  await new Promise((r) => setTimeout(r, 400));

  /* ============== 7. 配色静态扫描：找金色/黄色/彩色渐变 ============== */
  const colorAudit = await page.evaluate(() => {
    const bad = [];
    const seen = new Set();
    const walk = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      const cs = getComputedStyle(el);
      const tagSel = el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '');
      const checks = [
        { name: 'color', val: cs.color },
        { name: 'background-color', val: cs.backgroundColor },
        { name: 'border-color', val: cs.borderTopColor },
      ];
      for (const c of checks) {
        const m = c.val && c.val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (!m) continue;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        const isGray = Math.max(r, g, b) - Math.min(r, g, b) <= 12;
        const isBlack = r < 12 && g < 12 && b < 12;
        const isWhite = r > 240 && g > 240 && b > 240;
        if (!isGray && !isBlack && !isWhite) {
          // 红色 toast danger hover、删除按钮 hover #ff8080 是允许的（交互态）
          const isDangerRed = r > 200 && g < 160 && b < 160;
          if (!isDangerRed) {
            bad.push({ sel: tagSel, prop: c.name, val: c.val });
          }
        }
      }
      const bi = cs.backgroundImage;
      if (bi && bi !== 'none' && !bi.includes('iconify') && !bi.includes('data:') && !bi.includes('chrome-extension')) {
        if (/gradient/i.test(bi)) {
          bad.push({ sel: tagSel, prop: 'background-image', val: bi.slice(0, 200) });
        }
      }
      for (const child of el.children) walk(child);
    };
    walk(document.body);
    return bad.slice(0, 60);
  });
  results.colorAudit = colorAudit;
  console.log('COLOR_AUDIT (' + colorAudit.length + ' entries):');
  console.log(JSON.stringify(colorAudit, null, 2));

  /* ============== 8. 测试建筑卡片点击 ============== */
  const dockClick = await page.evaluate(() => {
    const card = document.querySelector('.b-card');
    if (!card) return { ok: false };
    card.click();
    return { ok: true, sel: card.classList.contains('sel'), name: card.querySelector('.b-name')?.textContent?.trim() };
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '07-bcard-selected.png') });
  results.dockClick = dockClick;
  console.log('DOCK_CLICK: ' + JSON.stringify(dockClick));
  // 取消选中
  await page.evaluate(() => {
    const card = document.querySelector('.b-card.sel');
    if (card) card.click();
  });

  /* ============== 9. 输出 ============== */
  fs.writeFileSync(path.join(OUT, 'logs.txt'), logs.join('\n'));
  fs.writeFileSync(path.join(OUT, 'state.json'), JSON.stringify(results, null, 2));
  console.log('LOGS (' + logs.length + ' entries, first 30):');
  console.log(logs.slice(0, 30).join('\n'));

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
