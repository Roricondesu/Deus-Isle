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
import { iconify, icon, IC } from './icon';
import {
  listManualSaves,
  saveToSlot,
  loadFromSlot,
  deleteSlot,
  SAVE_SLOTS,
} from './save';

/* ================= 屏幕坐标投影 / 飘字 / Toast ================= */
export function toScreen(v: THREE.Vector3): { x: number; y: number } {
  v.project(camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
}

export function floatText(pos: THREE.Vector3, txt: string, color: string = '#fff'): void {
  const s = toScreen(pos.clone().add(new THREE.Vector3(0, 1.8, 0)));
  const el = document.createElement('div');
  el.className = 'floater';
  el.innerHTML = iconify(txt);
  el.style.color = color;
  el.style.left = s.x + 'px';
  el.style.top = s.y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1450);
}

export function toast(txt: string, ico: string = '📢'): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = iconify(ico + ' ' + txt);
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
      icon(IC.arrowUp) + ' 时代跃迁<small>' +
      icon(IC.pop) + S.pop +
      '/' +
      r.pop +
      ' · ' + icon(IC.gold) + Math.floor(S.gold) +
      '/' +
      r.gold +
      ' · ' + icon(IC.wonder) +
      (S.wonders[S.era] ? icon(IC.check) : '未建') +
      '</small>';
    const ok = eraReady();
    btn.disabled = !ok;
    btn.classList.toggle('ready', ok);
  } else if (S.wonders[6]) {
    btn.innerHTML = icon(IC.eraRocket) + ' 发射方舟<small>终极一跃 · 文明起航</small>';
    btn.disabled = false;
    btn.classList.add('btn-launch');
    btn.onclick = startLaunch;
  } else {
    btn.innerHTML = icon(IC.arrowUp) + ' 最终纪元<small>建造「方舟发射台」以通关</small>';
    btn.disabled = true;
  }

  const eb = $('btn-expand') as HTMLButtonElement;
  if (S.expandMode) {
    eb.innerHTML = icon(IC.target) + ' 取消选择<small style="display:block;font-size:9px;opacity:.75">点击海面任意位置 / Esc</small>';
    eb.disabled = false;
    eb.classList.add('sel');
  } else if (S.expand >= 10) {
    eb.innerHTML = icon(IC.island) + ' 岛屿已达最大';
    eb.disabled = true;
    eb.classList.remove('sel');
  } else {
    const c = EXPAND_COST[S.expand];
    eb.innerHTML =
      icon(IC.island) + ' 填海扩岛<small style="display:block;font-size:9px;opacity:.75">' +
      iconify(costText([c[0], c[1], 0])) +
      '</small>';
    eb.disabled = !canAfford([c[0], c[1], 0]);
    eb.classList.remove('sel');
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
      iconify(def.icon) +
      '</div><div class="b-name">' +
      def.names[S.era] +
      '</div><div class="b-cost">' +
      (built ? '已建成' : iconify(costText(costOf(def)))) +
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
      iconify(g.icon) +
      '</b>' +
      g.name +
      '<br>' + icon(IC.faith) +
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
  $('era-icon').innerHTML = iconify(ERAS[S.era].icon);
  $('era-name').textContent = ERAS[S.era].name;
  $('era-sub').textContent = '第 ' + (S.era + 1) + ' 纪元';
}

export function hideEraTransition(): void {
  $('overlay-era').classList.add('hidden');
}

export function updateEraBadge(): void {
  $('era-icon').innerHTML = iconify(ERAS[S.era].icon);
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

/* ================= 存档/读档面板 ================= */

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtPlayTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}小时${m % 60}分`;
  return `${m}分`;
}

export function renderSavePanel(): void {
  const slots = listManualSaves();
  const container = $('save-slots');
  container.innerHTML = '';
  for (let i = 0; i < SAVE_SLOTS; i++) {
    const data = slots[i];
    const el = document.createElement('div');
    el.className = 'save-slot' + (data ? '' : ' empty');
    if (data) {
      const eraName = ERAS[data.era]?.name || '未知';
      el.innerHTML = `
        <div class="save-slot-info">
          <div class="save-slot-name">槽位 ${i + 1} · ${eraName}</div>
          <div class="save-slot-meta">
            ${icon(IC.pop)} ${data.pop}人 ·
            ${icon(IC.gold)} ${Math.floor(data.gold)} ·
            ${icon(IC.wonder)} ${Object.keys(data.wonders || {}).length}奇观 ·
            ${fmtPlayTime(data.playTime || 0)} ·
            ${fmtTime(data.savedAt || 0)}
          </div>
        </div>
        <div class="save-slot-actions">
          <button class="save-slot-btn load" data-act="load" data-slot="${i}">读取</button>
          <button class="save-slot-btn save" data-act="save" data-slot="${i}">覆盖</button>
          <button class="save-slot-btn delete" data-act="delete" data-slot="${i}">删除</button>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="save-slot-info">
          <div class="save-slot-name">槽位 ${i + 1} · 空闲</div>
          <div class="save-slot-meta">尚未保存</div>
        </div>
        <div class="save-slot-actions">
          <button class="save-slot-btn save" data-act="save" data-slot="${i}">保存</button>
        </div>
      `;
    }
    container.appendChild(el);
  }
  // 绑定按钮事件
  container.querySelectorAll<HTMLElement>('[data-act]').forEach((btn) => {
    btn.onclick = () => {
      const act = btn.dataset.act;
      const slot = parseInt(btn.dataset.slot || '0', 10);
      if (act === 'save') {
        if (saveToSlot(slot)) {
          sfx.build();
          toast('已保存到槽位 ' + (slot + 1), IC.check);
          renderSavePanel();
        } else {
          sfx.error();
          toast('保存失败', IC.warning);
        }
      } else if (act === 'load') {
        if (loadFromSlot(slot)) {
          sfx.faith();
          toast('已读取槽位 ' + (slot + 1), IC.check);
          hideSavePanel();
          refreshHUD();
          renderDock();
          updateEraBadge();
        } else {
          sfx.error();
          toast('读取失败', IC.warning);
        }
      } else if (act === 'delete') {
        if (confirm('确定删除槽位 ' + (slot + 1) + ' 的存档？')) {
          deleteSlot(slot);
          sfx.click();
          renderSavePanel();
        }
      }
    };
  });
}

export function showSavePanel(): void {
  renderSavePanel();
  $('save-panel').classList.remove('hidden');
}

export function hideSavePanel(): void {
  $('save-panel').classList.add('hidden');
}
