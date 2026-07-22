import * as THREE from 'three';
import { $, clamp } from './utils';
import {
  S,
  popCap,
  eraReady,
  canAfford,
  costOf,
  costText,
  expandCost,
  totalBuildings,
} from './state';
import {
  CATALOG,
  CATMAP,
  ERAS,
  ERA_TITLE_SUB,
  GODS,
  eraReq,
  SKILLMAP,
  type BuildingDef,
  type SkillDef,
} from './constants';
import { sfx } from './audio';
import { camera } from './environment';
import { castGod } from './game';
import { startLaunch } from './game';
import { iconify, icon, IC } from './icon';
import { renderTasksHTML, refreshTasks } from './tasks';
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
  el.innerHTML = txt;
  el.style.color = color;
  el.style.left = s.x + 'px';
  el.style.top = s.y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1450);
}

export function toast(txt: string, ico: string = IC.bullhorn): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = icon(ico) + ' ' + iconify(txt);
  $('toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, 4600);
  while ($('toasts').children.length > 5) $('toasts').firstChild?.remove();
}

export function updateCrisisBanner(): void {
  const el = $('crisis-banner');
  if (!S.crisis) {
    el.classList.add('hidden');
    return;
  }
  const names: Record<NonNullable<typeof S.crisis>['type'], string> = {
    drought: '大旱',
    tsunami: '海啸',
    plague: '瘟疫',
    meteor: '陨石',
  };
  const icons: Record<NonNullable<typeof S.crisis>['type'], string> = {
    drought: IC.drought,
    tsunami: IC.tsunami,
    plague: IC.plague,
    meteor: IC.meteor,
  };
  el.innerHTML = icon(icons[S.crisis.type]) + ' ' + names[S.crisis.type] + ' 正在肆虐 · 剩余 ' + Math.ceil(S.crisis.t) + ' 秒';
  el.classList.remove('hidden');
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
      icon(IC.arrowUp) + '时代跃迁<small>' +
      S.pop + '/' + r.pop + ' · ' + Math.floor(S.gold) + '/' + r.gold +
      ' · ' + (S.wonders[S.era] ? '已建奇观' : '未建奇观') +
      '</small>';
    const ok = eraReady();
    btn.disabled = !ok;
    btn.classList.toggle('ready', ok);
  } else if (S.wonders[6]) {
    btn.innerHTML = icon(IC.eraRocket) + '发射方舟<small>终极一跃 · 文明起航</small>';
    btn.disabled = false;
    btn.classList.add('btn-launch');
    btn.onclick = startLaunch;
  } else {
    btn.innerHTML = icon(IC.arrowUp) + '最终纪元<small>建造方舟发射台以通关</small>';
    btn.disabled = true;
  }

  const eb = $('btn-expand') as HTMLButtonElement;
  if (S.expandMode) {
    eb.innerHTML = icon(IC.target) + '取消选择<small>点击海面 / Esc</small>';
    eb.disabled = false;
    eb.classList.add('sel');
  } else if (S.expand >= 10) {
    eb.innerHTML = icon(IC.island) + '岛屿已达最大';
    eb.disabled = true;
    eb.classList.remove('sel');
  } else {
    const c = expandCost(S.expand);
    eb.innerHTML = icon(IC.island) + '填海扩岛<small>' + costText([c[0], c[1], 0]) + '</small>';
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
      icon(def.icon) +
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
      icon(g.icon) +
      '</b><span>' +
      g.name +
      '</span><span>' + icon(IC.faith) +
      g.cost +
      '</span>';
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
  $('era-anim-sub').textContent = 'ERA ' + String(S.era + 1).padStart(2, '0') + ' · ' + ERA_TITLE_SUB[S.era];
  $('overlay-era').classList.remove('hidden');
  const anim = $('era-anim');
  anim.classList.remove('show');
  void anim.offsetWidth;
  anim.classList.add('show');
  $('era-icon').innerHTML = icon(ERAS[S.era].icon);
  $('era-name').textContent = ERAS[S.era].name;
  $('era-sub').textContent = 'ERA ' + String(S.era + 1).padStart(2, '0');
}

export function hideEraTransition(): void {
  $('overlay-era').classList.add('hidden');
}

export function updateEraBadge(): void {
  $('era-icon').innerHTML = icon(ERAS[S.era].icon);
  $('era-name').textContent = ERAS[S.era].name;
  $('era-sub').textContent = 'ERA ' + String(S.era + 1).padStart(2, '0');
}

/* ================= 时代技能选择覆盖层 ================= */
export function showSkillChoices(choices: SkillDef[], onPick: (k: string) => void): void {
  const ov = $('overlay-skill');
  const grid = $('skill-grid');
  grid.innerHTML = '';
  choices.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    card.innerHTML =
      '<div class="skill-icon">' + icon(s.icon) + '</div>' +
      '<div class="skill-name">' + iconify(s.name) + '</div>' +
      '<div class="skill-desc">' + iconify(s.desc) + '</div>';
    card.onclick = () => {
      sfx.click();
      onPick(s.k);
    };
    grid.appendChild(card);
  });
  ov.classList.remove('hidden');
}

export function hideSkillChoices(): void {
  $('overlay-skill').classList.add('hidden');
}

/* ================= 任务清单面板 ================= */
export function renderTaskPanel(): void {
  refreshTasks();
  const el = $('task-panel');
  if (!el) return;
  const collapsed = el.classList.contains('collapsed');
  el.innerHTML =
    '<div class="task-head">' + icon(IC.target) + 'Quests' +
    '<span class="task-toggle">' + icon(IC.chevronDown) + '</span></div>' +
    '<div class="task-list">' + renderTasksHTML() + '</div>';
  if (collapsed) el.classList.add('collapsed');
  const head = el.querySelector('.task-head');
  if (head) head.addEventListener('click', () => el.classList.toggle('collapsed'));
}

export function renderSkillBar(): void {
  const el = $('skill-bar');
  if (!el) return;
  if (!S.skills.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = S.skills
    .map((k) => {
      const s = SKILLMAP[k];
      if (!s) return '';
      return '<span class="skill-chip">' + icon(s.icon) + iconify(s.name) + '</span>';
    })
    .join('');
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
