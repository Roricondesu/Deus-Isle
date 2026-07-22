import { S, countType, popCap } from './state';
import { IC, icon } from './icon';

/* ================= 任务清单系统 ================= */

export interface TaskDef {
  id: string;
  icon: string;
  text: string;
  check: () => boolean;
  reward: () => string;
}

const TASK_DEFS: TaskDef[] = [
  {
    id: 'have2farms',
    icon: IC.farm,
    text: '拥有 2 座农田',
    check: () => countType('farm') >= 2,
    reward: () => { S.food += 30; return '+30 食物'; },
  },
  {
    id: 'have2woods',
    icon: IC.woodcutter,
    text: '拥有 2 座伐木场',
    check: () => countType('wood') >= 2,
    reward: () => { S.wood += 25; return '+25 木材'; },
  },
  {
    id: 'have3houses',
    icon: IC.house,
    text: '拥有 3 座住房',
    check: () => countType('house') >= 3,
    reward: () => { S.happy = Math.min(98, S.happy + 5); return '幸福 +5'; },
  },
  {
    id: 'buildMarket',
    icon: IC.market,
    text: '建造 1 座市场',
    check: () => countType('market') >= 1,
    reward: () => { S.gold += 40; return '+40 金币'; },
  },
  {
    id: 'buildTemple',
    icon: IC.temple,
    text: '建造 1 座神庙',
    check: () => countType('temple') >= 1,
    reward: () => { S.faith += 25; return '+25 信仰'; },
  },
  {
    id: 'buildWonder',
    icon: IC.wonder,
    text: '建造时代奇观',
    check: () => !!S.wonders[S.era],
    reward: () => { S.faith += 50; S.happy = Math.min(98, S.happy + 8); return '+50 信仰 · 幸福 +8'; },
  },
  {
    id: 'expandOnce',
    icon: IC.island,
    text: '填海扩岛 1 次',
    check: () => S.expand >= 1,
    reward: () => { S.wood += 40; S.gold += 30; return '+40 木材 · +30 金币'; },
  },
  {
    id: 'pop10',
    icon: IC.pop,
    text: '人口达到 10',
    check: () => S.pop >= 10,
    reward: () => { S.food += 50; return '+50 食物'; },
  },
  {
    id: 'pop20',
    icon: IC.pop,
    text: '人口达到 20',
    check: () => S.pop >= 20,
    reward: () => { S.gold += 80; return '+80 金币'; },
  },
  {
    id: 'food200',
    icon: IC.food,
    text: '食物储备达到 200',
    check: () => S.food >= 200,
    reward: () => { S.wood += 35; return '+35 木材'; },
  },
  {
    id: 'gold200',
    icon: IC.gold,
    text: '金币达到 200',
    check: () => S.gold >= 200,
    reward: () => { S.faith += 30; return '+30 信仰'; },
  },
  {
    id: 'happy70',
    icon: IC.happy,
    text: '幸福度达到 70',
    check: () => S.happy >= 70,
    reward: () => { S.food += 30; S.gold += 30; return '+30 食物 · +30 金币'; },
  },
  {
    id: 'surviveCrisis',
    icon: IC.calm,
    text: '平息任意危机',
    check: () => false, // 动态判定见下方
    reward: () => { S.faith += 35; return '+35 信仰'; },
  },
  {
    id: 'eraUpOnce',
    icon: IC.arrowUp,
    text: '完成一次时代跃迁',
    check: () => S.era >= 1,
    reward: () => { S.gold += 60; S.faith += 20; return '+60 金币 · +20 信仰'; },
  },
];

let crisisSurvived = false;

/** 当危机被平息时调用 */
export function markCrisisSurvived(): void {
  crisisSurvived = true;
}

function pickTasks(n: number): TaskDef[] {
  const currentIds = new Set(S.tasks.list.map((t) => t.id));
  const pool = TASK_DEFS.filter((d) => !currentIds.has(d.id) && !d.check());
  const out: TaskDef[] = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function refreshTasks(force = false): void {
  const now = Date.now();
  const list = S.tasks.list;
  const allDone = list.length > 0 && list.every((t) => t.done);
  if (!force && list.length > 0 && !allDone && now - S.tasks.lastRefresh < 120000) return;

  // 保留未完成的任务，补充至 3 个
  const alive = list.filter((t) => !t.done);
  const needed = Math.max(0, 3 - alive.length);
  const defs = pickTasks(needed);
  for (const d of defs) {
    alive.push({ id: d.id, text: d.text, icon: d.icon, done: false });
  }
  S.tasks.list = alive.slice(0, 3);
  S.tasks.lastRefresh = now;
}

let taskAcc = 0;
let lastCrisisState = false;

export function updateTasks(dt: number): void {
  taskAcc += dt;
  if (taskAcc < 1) return;
  taskAcc -= 1;
  refreshTasks();

  // 危机任务特殊判定
  if (crisisSurvived || (lastCrisisState && !S.crisis)) {
    const crisisTask = S.tasks.list.find((t) => t.id === 'surviveCrisis');
    if (crisisTask && !crisisTask.done) {
      crisisTask.done = true;
      const def = TASK_DEFS.find((d) => d.id === 'surviveCrisis')!;
      const got = def.reward();
      // toast 由 hud.ts 的 renderTasks 触发动画时处理，这里仅标记
    }
    crisisSurvived = false;
  }
  lastCrisisState = !!S.crisis;

  for (const t of S.tasks.list) {
    if (t.done) continue;
    const def = TASK_DEFS.find((d) => d.id === t.id);
    if (!def) continue;
    if (def.check()) {
      t.done = true;
      def.reward();
    }
  }
}

export function taskRewardText(id: string): string {
  const def = TASK_DEFS.find((d) => d.id === id);
  return def ? def.reward() : '';
}

/** 渲染任务面板 HTML */
export function renderTasksHTML(): string {
  const list = S.tasks.list;
  if (!list.length) {
    return `<div class="task-empty">暂无任务</div>`;
  }
  return list
    .map(
      (t) => `
    <div class="task-item${t.done ? ' done' : ''}">
      <span class="task-icon">${icon(t.icon)}</span>
      <span class="task-text">${t.text}</span>
      ${t.done ? `<span class="task-check">${icon(IC.check)}</span>` : ''}
    </div>
  `,
    )
    .join('');
}
