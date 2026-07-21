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
import { saveGame, loadGame, clearSave } from './save';
import { S } from './state';
import { setupAudioToggle, unlockAudio, sfx } from './audio';
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

  // 过场动画/起飞流程期间隐藏整个 GUI
  const ui = $('ui');
  const hideUI = S.transitioning || S.over;
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

  // 开始游戏
  $('btn-start').onclick = () => {
    unlockAudio();
    sfx.era();
    $('overlay-intro').classList.add('hidden');
    S.started = true;
    camera.position.set(85, 60, 90);
    tw(
      2.6,
      (k) => {
        camera.position.set(lerp(85, 30, k), lerp(60, 26, k), lerp(90, 34, k));
      },
      (t) => 1 - Math.pow(1 - t, 3),
    );
    setTimeout(() => toast('点击下方卡片，在岛上放置建筑', '👇'), 2800);
    setTimeout(() => toast('目标：发展人口，建造奇观，让文明跃迁！', '🎯'), 6600);
  };
}

/* ================= 初始化 ================= */
function init(): void {
  setupInteraction();
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
