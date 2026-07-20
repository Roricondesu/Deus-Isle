import * as THREE from 'three';
import { $, clamp } from './utils';
import {
  S,
  popCap,
  eraReady,
  canAfford,
  costOf,
  costText,
  totalBuildings,
} from './state';
import {
  CATALOG,
  CATMAP,
  ERAS,
  ERA_TITLE_SUB,
  EXPAND_COST,
  GODS,
  eraReq,
  type BuildingDef,
} from './constants';
import { sfx } from './audio';
import { camera } from './environment';
import { castGod } from './game';
import { startLaunch } from './game';

/* ================= 屏幕坐标投影 / 飘字 / Toast ================= */
export function toScreen(v: THREE.Vector3): { x: number; y: number } {
  v.project(camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
}

export function floatText(pos: THREE.Vector3, txt: string, color: string = '#fff'): void {
  const s = toScreen(pos.clone().add(new THREE.Vector3(0, 1.8, 0)));
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = txt;
  el.style.color = color;
  el.style.left = s.x + 'px';
  el.style.top = s.y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1450);
}

export function toast(txt: string, icon: string = '📢'): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = icon + ' ' + txt;
  $('toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, 4600);
  while ($('toasts').children.length > 5) $('toasts').firstChild?.remove();
}

/* ================= HUD 刷新 ================= */
export function refreshHUD(): void {
  $('r-food').textContent = String(Math.floor(S.food));
  $('r-wood').textContent = String(Math.floor(S.wood));
  $('r-gold').textContent = String(Math.floor(S.gold));
  $('r-faith').textContent = String(Math.floor(S.faith));
  $('r-pop').textContent = S.pop + '/' + popCap();
  $('r-happy').textContent = String(Math.round(S.happy));

  const btn = $('btn-eraup') as HTMLButtonElement;
  if (S.era < 6) {
    const r = eraReq(S.era);
    btn.innerHTML =
      '⏫ 时代跃迁<small>🧑' +
      S.pop +
      '/' +
      r.pop +
      ' · 🪙' +
      Math.floor(S.gold) +
      '/' +
      r.gold +
      ' · 🏛️' +
      (S.wonders[S.era] ? '✓' : '未建') +
      '</small>';
    const ok = eraReady();
    btn.disabled = !ok;
    btn.classList.toggle('ready', ok);
  } else if (S.wonders[6]) {
    btn.innerHTML = '🚀 发射方舟<small>终极一跃 · 文明起航</small>';
    btn.disabled = false;
    btn.classList.add('btn-launch');
    btn.onclick = startLaunch;
  } else {
    btn.innerHTML = '⏫ 最终纪元<small>建造「方舟发射台」以通关</small>';
    btn.disabled = true;
  }

  const eb = $('btn-expand') as HTMLButtonElement;
  if (S.expand >= 3) {
    eb.textContent = '🏝️ 岛屿已达最大';
    eb.disabled = true;
  } else {
    const c = EXPAND_COST[S.expand];
    eb.innerHTML =
      '🏝️ 填海扩岛<small style="display:block;font-size:9px;opacity:.75">' +
      costText([c[0], c[1], 0]) +
      '</small>';
    eb.disabled = !canAfford([c[0], c[1], 0]);
  }

  document.querySelectorAll('.b-card').forEach((el, i) => {
    const def = CATALOG[i];
    el.classList.toggle('poor', !canAfford(costOf(def)));
  });
}

/* ================= 建造栏 & 神迹栏渲染 ================= */
export function renderDock(): void {
  const dock = $('build-dock');
  dock.innerHTML = '';
  CATALOG.forEach((def: BuildingDef) => {
    const el = document.createElement('div');
    el.className = 'b-card' + (S.sel === def.t ? ' sel' : '');
    const built = def.t === 'wonder' && S.wonders[S.era];
    el.innerHTML =
      '<div class="b-icon">' +
      def.icon +
      '</div><div class="b-name">' +
      def.names[S.era] +
      '</div><div class="b-cost">' +
      (built ? '已建成' : costText(costOf(def))) +
      '</div>';
    el.title = def.tip + '（' + CATMAP[def.t] + '）';
    el.onclick = () => {
      sfx.click();
      S.sel = S.sel === def.t ? null : def.t;
      renderDock();
    };
    dock.appendChild(el);
  });

  const gd = $('god-dock');
  gd.innerHTML = '';
  GODS.forEach((g) => {
    const el = document.createElement('div');
    el.className = 'god-btn';
    el.id = 'god-' + g.k;
    el.innerHTML =
      '<div class="cdmask" style="transform:scaleY(0)"></div><b>' +
      g.icon +
      '</b>' +
      g.name +
      '<br>✨' +
      g.cost;
    el.title = g.tip;
    el.onclick = () => castGod(g.k);
    gd.appendChild(el);
  });
}

export function updateGodDock(): void {
  GODS.forEach((g) => {
    const el = $('god-' + g.k);
    if (!el) return;
    const cd = S.cds[g.k] || 0;
    el.classList.toggle('poor', S.faith < g.cost);
    el.classList.toggle('cd', cd > 0);
    const mask = el.querySelector('.cdmask') as HTMLElement;
    if (mask) mask.style.transform = 'scaleY(' + clamp(cd / g.cd, 0, 1) + ')';
  });
}

/* ================= 时代介绍 / 胜利覆盖层控制 ================= */
export function showEraTransition(): void {
  $('era-anim-title').textContent = ERAS[S.era].name;
  $('era-anim-sub').textContent = '第 ' + (S.era + 1) + ' 纪元 · ' + ERA_TITLE_SUB[S.era];
  $('overlay-era').classList.remove('hidden');
  const anim = $('era-anim');
  anim.classList.remove('show');
  void anim.offsetWidth;
  anim.classList.add('show');
  $('era-icon').textContent = ERAS[S.era].icon;
  $('era-name').textContent = ERAS[S.era].name;
  $('era-sub').textContent = '第 ' + (S.era + 1) + ' 纪元';
}

export function hideEraTransition(): void {
  $('overlay-era').classList.add('hidden');
}

export function updateEraBadge(): void {
  $('era-icon').textContent = ERAS[S.era].icon;
  $('era-name').textContent = ERAS[S.era].name;
  $('era-sub').textContent = '第 ' + (S.era + 1) + ' 纪元';
}

export function showVictory(): void {
  const vStats = $('v-stats');
  vStats.innerHTML = [
    [S.pop, '最终人口'],
    [totalBuildings(), '建筑总数'],
    [Object.keys(S.wonders).length, '时代奇观'],
    [Math.floor(S.playTime / 60) + '分', '文明历程'],
  ]
    .map(
      (x) =>
        '<div class="v-stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>',
    )
    .join('');
  $('overlay-victory').classList.remove('hidden');
}
