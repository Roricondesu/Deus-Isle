import * as THREE from 'three';
import { $, V3, lerp, tw, updateTweens, tweens } from './utils';
import { ERAS } from './constants';
import {
  scene,
  camera,
  renderer,
  controls,
  dayNight,
  paletteLerp,
  waterWave,
  envMove,
  animUpdate,
  updateShake,
  updateTrees,
} from './environment';
import { updateParts, smokeUpdate, updateRain } from './particles';
import { updateCitizens } from './citizens';
import { setupInteraction, updateHover, placeBuilding } from './interaction';
import {
  econTick,
  popTick,
  spawnPrayer,
  updatePrayer,
  fireEvent,
  updateLaunch,
  eraUp,
  enterExpandMode,
  autoUpgradeTick,
} from './game';
import { refreshHUD, renderDock, updateGodDock, toast, updateEraBadge, showSavePanel, hideSavePanel } from './hud';
import {
  saveGame,
  loadGame,
  clearSave,
  listManualSaves,
  loadFromSlot,
  deleteSlot,
  SAVE_SLOTS,
} from './save';
import { S } from './state';
import { setupAudioToggle, unlockAudio, sfx, muted as audioMuted, setMuted } from './audio';
import { rebuildRoads } from './roads';

/* ================= 主循环 ================= */
const clock = new THREE.Clock();
let tickAcc = 0;
let popAcc = 0;
let saveAcc = 0;
let evtAcc = 20;
let prayAcc = 8;
let hudAcc = 0;

function loop(): void {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const spd = S.timeScale * (S.buffs.haste > 0 ? 3 : 1);
  const gdt = dt * spd;
  updateTweens(dt);
  if (S.started && !S.over) {
    S.playTime += gdt;
    S.dayTime = (S.dayTime + gdt / 130) % 1;
    for (const k in S.cds) S.cds[k] = Math.max(0, S.cds[k] - dt);
    if (S.buffs.rain > 0) {
      S.buffs.rain -= gdt;
      if (S.buffs.rain <= 0) {
        // 雨停了，由 particles 内部判断可见性
      }
    }
    if (S.buffs.haste > 0) S.buffs.haste -= dt;
    tickAcc += gdt;
    while (tickAcc >= 1) {
      tickAcc -= 1;
      econTick();
    }
    popAcc += gdt;
    if (popAcc >= 3) {
      popAcc = 0;
      popTick();
    }
    evtAcc += gdt;
    if (evtAcc > 38) {
      evtAcc = 0;
      fireEvent();
    }
    prayAcc += gdt;
    if (prayAcc > 13) {
      prayAcc = 0;
      spawnPrayer();
    }
    saveAcc += dt;
    if (saveAcc > 15) {
      saveAcc = 0;
      saveGame();
    }
    hudAcc += dt;
    if (hudAcc > 0.3) {
      hudAcc = 0;
      refreshHUD();
      updateGodDock();
    }
    updateCitizens(gdt, t);
    updatePrayer(dt);
    updateLaunch(dt);
    updateRain(dt);
    autoUpgradeTick(gdt);
    updateTrees(gdt);
  }
  dayNight();
  paletteLerp(dt);
  waterWave(t);
  envMove(dt, t);
  animUpdate(gdt, t);
  updateParts(dt);
  smokeUpdate(dt);
  updateHover();
  controls.update();
  updateShake(dt);
  renderer.render(scene, camera);

  // 过场动画/起飞流程/初始主界面期间隐藏整个 GUI
  const ui = $('ui');
  const hideUI = !S.started || S.transitioning || S.over;
  if (ui.classList.contains('ui-hidden') !== hideUI) {
    ui.classList.toggle('ui-hidden', hideUI);
  }
}

/* ================= 按钮绑定 ================= */
function bindButtons(): void {
  // 静音切换
  setupAudioToggle();

  // 重置存档
  $('btn-reset').onclick = () => {
    if (confirm('确定要重置文明、清空存档吗？')) {
      clearSave();
      location.reload();
    }
  };

  // 存档/读档面板
  $('btn-save').onclick = () => {
    showSavePanel();
  };
  $('save-panel-close').onclick = () => {
    hideSavePanel();
  };
  // 点击面板背景关闭
  $('save-panel').onclick = (e) => {
    if (e.target === $('save-panel')) hideSavePanel();
  };
  // Esc 关闭面板
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSavePanel();
  });

  // 时代跃迁
  ($('btn-eraup') as HTMLButtonElement).onclick = () => eraUp();

  // 填海扩岛
  ($('btn-expand') as HTMLButtonElement).onclick = () => enterExpandMode();

  // 再玩一次
  $('btn-again').onclick = () => {
    clearSave();
    location.reload();
  };

  // 主界面左侧按钮（事件委托，子视图切换会重新渲染）
  $('intro-content').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const act = t.dataset.act;
    if (!act) return;
    if (act === 'start') startGame();
    else if (act === 'load') renderIntroView('load');
    else if (act === 'settings') renderIntroView('settings');
    else if (act === 'about') renderIntroView('about');
    else if (act === 'back') renderIntroView('main');
    else if (act === 'load-slot') {
      const slot = parseInt(t.dataset.slot || '0', 10);
      if (loadFromSlot(slot)) {
        sfx.faith();
        $('overlay-intro').classList.add('hidden');
        S.started = true;
        refreshHUD();
        renderDock();
        updateEraBadge();
        toast('已读取存档', '✓');
      } else {
        sfx.error();
        toast('读取失败', '⚠');
      }
    } else if (act === 'delete-slot') {
      const slot = parseInt(t.dataset.slot || '0', 10);
      deleteSlot(slot);
      sfx.click();
      renderIntroView('load');
    } else if (act === 'toggle-sound') {
      setMuted(audioMuted ? false : true);
      saveSettings();
      renderIntroView('settings');
    } else if (act === 'toggle-rotate') {
      settings.autoRotate = !settings.autoRotate;
      controls.autoRotate = settings.autoRotate;
      saveSettings();
      renderIntroView('settings');
    } else if (act === 'toggle-lang') {
      setLang(lang === 'zh' ? 'en' : 'zh');
      saveSettings();
      applyI18n();
      renderIntroView('settings');
    }
  });

  // 初始渲染主菜单
  renderIntroView('main');
}

/* ================= 主界面子视图渲染 ================= */
type IntroView = 'main' | 'load' | 'settings' | 'about';

interface Settings {
  autoRotate: boolean;
}
const SETTINGS_KEY = 'deus-isle-settings';
const settings: Settings = { autoRotate: true };
function loadSettings(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  controls.autoRotate = settings.autoRotate;
}
function saveSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function fmtTs(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtPlay(sec: number): string {
  const m = Math.floor((sec || 0) / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${m % 60}m` : `${m}m`;
}

let currentIntroView: IntroView = 'main';
function renderIntroView(view: IntroView): void {
  const el = $('intro-content');
  // 切换时先淡出再淡入
  const isInit = el.children.length === 0;
  const doRender = () => {
    currentIntroView = view;
    el.innerHTML = renderIntroHTML(view);
    el.classList.remove('intro-fade-out');
    el.classList.add('intro-fade-in');
    setTimeout(() => el.classList.remove('intro-fade-in'), 320);
  };
  if (isInit) {
    doRender();
  } else {
    el.classList.remove('intro-fade-in');
    el.classList.add('intro-fade-out');
    setTimeout(doRender, 180);
  }
}

function renderIntroHTML(view: IntroView): string {
  if (view === 'main') {
    return `
      <nav class="intro-menu">
        <button class="intro-link" data-act="start">${t('start')}</button>
        <button class="intro-link" data-act="load">${t('loadSave')}</button>
        <button class="intro-link" data-act="settings">${t('settings')}</button>
        <button class="intro-link" data-act="about">${t('about')}</button>
      </nav>`;
  } else if (view === 'load') {
    const slots = listManualSaves();
    let html = `<div class="intro-section-title">${t('saveList')}</div>`;
    slots.forEach((d, i) => {
      if (d) {
        const eraName = ERAS[d.era]?.name || '—';
        html += `
          <div class="intro-slot">
            <div class="intro-slot-info">
              ${t('slot')} ${i + 1} · ${eraName} · ${d.pop}${t('people')}
              <small>${fmtPlay(d.playTime)} · ${fmtTs(d.savedAt)}</small>
            </div>
            <div class="intro-slot-actions">
              <button class="intro-mini" data-act="load-slot" data-slot="${i}">${t('load')}</button>
              <button class="intro-mini danger" data-act="delete-slot" data-slot="${i}">${t('delete')}</button>
            </div>
          </div>`;
      } else {
        html += `
          <div class="intro-slot">
            <div class="intro-slot-info">${t('slot')} ${i + 1} · ${t('empty')}<small>${t('notSaved')}</small></div>
          </div>`;
      }
    });
    html += `<div class="intro-back"><button class="intro-link" data-act="back">${t('back')}</button></div>`;
    return html;
  } else if (view === 'settings') {
    return `
      <div class="intro-section-title">${t('settings')}</div>
      <div class="intro-row">
        <span class="intro-row-label">${t('sound')}</span>
        <button class="intro-toggle ${audioMuted ? '' : 'on'}" data-act="toggle-sound">${audioMuted ? t('off') : t('on')}</button>
      </div>
      <div class="intro-row">
        <span class="intro-row-label">${t('autoRotate')}</span>
        <button class="intro-toggle ${settings.autoRotate ? 'on' : ''}" data-act="toggle-rotate">${settings.autoRotate ? t('on') : t('off')}</button>
      </div>
      <div class="intro-row">
        <span class="intro-row-label">${t('language')}</span>
        <button class="intro-toggle on" data-act="toggle-lang">${lang === 'zh' ? '中文' : 'EN'}</button>
      </div>
      <div class="intro-back"><button class="intro-link" data-act="back">${t('back')}</button></div>`;
  } else if (view === 'about') {
    return `
      <div class="intro-section-title">${t('about')}</div>
      <div class="intro-about">
        <p>${t('aboutP1')}</p>
        <p>${t('aboutP2')}</p>
        <div class="ver">DEUS ISLE · v1.0</div>
      </div>
      <div class="intro-back"><button class="intro-link" data-act="back">${t('back')}</button></div>`;
  }
  return '';
}

function startGame(): void {
  unlockAudio();
  sfx.era();
  $('overlay-intro').classList.add('hidden');
  S.started = true;
  // 相机从左移位置飞回正常视角
  tw(
      2.6,
      (k) => {
        camera.position.set(lerp(-40, 30, k), lerp(22, 26, k), lerp(34, 34, k));
      },
      (t) => 1 - Math.pow(1 - t, 3),
    );
  setTimeout(() => toast('点击下方卡片，在岛上放置建筑', '👇'), 2800);
  setTimeout(() => toast('目标：发展人口，建造奇观，让文明跃迁！', '🎯'), 6600);
}

/* ================= 初始化 ================= */
function init(): void {
  setupInteraction();
  loadSettings();
  bindButtons();

  const had = loadGame();
  if (!had) {
    // 新游戏：放置初始示范建筑
    placeBuilding('house', 0, -2, 1);
    placeBuilding('house', 0, 2, -1);
    placeBuilding('farm', 0, 1, 2);
    placeBuilding('temple', 0, -1, -2);
    S.cells.forEach((b) => b.g.scale.setScalar(1));
  } else {
    S.cells.forEach((b) => b.g.scale.setScalar(1));
    updateEraBadge();
    setTimeout(() => toast('已读取存档，文明继续…', '📜'), 800);
  }
  // 取消初始建筑的生长动画，直接成型
  tweens.length = 0;
  renderDock();
  refreshHUD();
  rebuildRoads();
  loop();
}

init();
