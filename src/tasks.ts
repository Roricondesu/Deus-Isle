import { S, countType } from './state';
import { IC, icon } from './icon';
import { toast } from './hud';
import { sfx } from './audio';

/* ================= 任务清单系统 ================= */

export interface TaskDef {
  id: string;
  icon: string;
  text: string;
  check: () => boolean;
  /** 纯描述，不修改状态 */
  rewardText: () => string;
  /** 实际发放奖励，修改状态 */
  grant: () => void;
}

const TASK_DEFS: TaskDef[] = [
  {
    id: 'have2farms',
    icon: IC.farm,
    text: '拥有 2 座农田',
    check: () => countType('farm') >= 2,
    rewardText: () => icon(IC.food) + '+50 食物',
    grant: () => { S.food += 50; },
  },
  {
    id: 'have2woods',
    icon: IC.woodcutter,
    text: '拥有 2 座伐木场',
    check: () => countType('wood') >= 2,
    rewardText: () => icon(IC.wood) + '+45 木材',
    grant: () => { S.wood += 45; },
  },
  {
    id: 'have3houses',
    icon: IC.house,
    text: '拥有 3 座住房',
    check: () => countType('house') >= 3,
    rewardText: () => icon(IC.happy) + '+10 幸福',
    grant: () => { S.happy = Math.min(98, S.happy + 10); },
  },
  {
    id: 'buildMarket',
    icon: IC.market,
    text: '建造 1 座市场',
    check: () => countType('market') >= 1,
    rewardText: () => icon(IC.gold) + '+60 金币',
    grant: () => { S.gold += 60; },
  },
  {
    id: 'buildTemple',
    icon: IC.temple,
    text: '建造 1 座神庙',
    check: () => countType('temple') >= 1,
    rewardText: () => icon(IC.faith) + '+35 信仰',
    grant: () => { S.faith += 35; },
  },
  {
    id: 'buildPark',
    icon: IC.park,
    text: '建造 1 座公园',
    check: () => countType('park') >= 1,
    rewardText: () => icon(IC.happy) + '+12 幸福 · ' + icon(IC.faith) + '+15 信仰',
    grant: () => { S.happy = Math.min(98, S.happy + 12); S.faith += 15; },
  },
  {
    id: 'buildWonder',
    icon: IC.wonder,
    text: '建造时代奇观',
    check: () => !!S.wonders[S.era],
    rewardText: () => icon(IC.faith) + '+80 信仰 · ' + icon(IC.happy) + '+15 幸福',
    grant: () => { S.faith += 80; S.happy = Math.min(98, S.happy + 15); },
  },
  {
    id: 'expandOnce',
    icon: IC.island,
    text: '填海扩岛 1 次',
    check: () => S.expand >= 1,
    rewardText: () => icon(IC.wood) + '+60 木材 · ' + icon(IC.gold) + '+50 金币',
    grant: () => { S.wood += 60; S.gold += 50; },
  },
  {
    id: 'pop10',
    icon: IC.pop,
    text: '人口达到 10',
    check: () => S.pop >= 10,
    rewardText: () => icon(IC.food) + '+80 食物 · ' + icon(IC.happy) + '+8 幸福',
    grant: () => { S.food += 80; S.happy = Math.min(98, S.happy + 8); },
  },
  {
    id: 'pop20',
    icon: IC.pop,
    text: '人口达到 20',
    check: () => S.pop >= 20,
    rewardText: () => icon(IC.gold) + '+120 金币 · ' + icon(IC.faith) + '+30 信仰',
    grant: () => { S.gold += 120; S.faith += 30; },
  },
  {
    id: 'food200',
    icon: IC.food,
    text: '食物储备达到 200',
    check: () => S.food >= 200,
    rewardText: () => icon(IC.wood) + '+55 木材 · ' + icon(IC.gold) + '+40 金币',
    grant: () => { S.wood += 55; S.gold += 40; },
  },
  {
    id: 'gold200',
    icon: IC.gold,
    text: '金币达到 200',
    check: () => S.gold >= 200,
    rewardText: () => icon(IC.faith) + '+45 信仰 · ' + icon(IC.food) + '+50 食物',
    grant: () => { S.faith += 45; S.food += 50; },
  },
  {
    id: 'happy70',
    icon: IC.happy,
    text: '幸福度达到 70',
    check: () => S.happy >= 70,
    rewardText: () => icon(IC.food) + '+50 食物 · ' + icon(IC.gold) + '+50 金币',
    grant: () => { S.food += 50; S.gold += 50; },
  },
  {
    id: 'surviveCrisis',
    icon: IC.calm,
    text: '平息任意危机',
    check: () => false, // 动态判定见下方
    rewardText: () => icon(IC.faith) + '+55 信仰 · ' + icon(IC.happy) + '+10 幸福',
    grant: () => { S.faith += 55; S.happy = Math.min(98, S.happy + 10); },
  },
  {
    id: 'eraUpOnce',
    icon: IC.arrowUp,
    text: '完成一次时代跃迁',
    check: () => S.era >= 1,
    rewardText: () => icon(IC.gold) + '+100 金币 · ' + icon(IC.faith) + '+40 信仰',
    grant: () => { S.gold += 100; S.faith += 40; },
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
    alive.push({ id: d.id, text: d.text, icon: d.icon, reward: d.rewardText(), done: false });
  }
  S.tasks.list = alive.slice(0, 3);
  S.tasks.lastRefresh = now;
}

let taskAcc = 0;
let lastCrisisState = false;

/** 完成单个任务：发放奖励 + 通知 */
function completeTask(t: { id: string; text: string; reward: string; done: boolean }, def: TaskDef): void {
  t.done = true;
  def.grant();
  sfx.faith();
  toast('任务完成 · ' + t.text + ' · ' + t.reward, IC.gift);
}

export function updateTasks(dt: number): void {
  taskAcc += dt;
  if (taskAcc < 1) return;
  taskAcc -= 1;
  refreshTasks();

  // 危机任务特殊判定
  if (crisisSurvived || (lastCrisisState && !S.crisis)) {
    const crisisTask = S.tasks.list.find((t) => t.id === 'surviveCrisis');
    if (crisisTask && !crisisTask.done) {
      const def = TASK_DEFS.find((d) => d.id === 'surviveCrisis')!;
      completeTask(crisisTask, def);
    }
    crisisSurvived = false;
  }
  lastCrisisState = !!S.crisis;

  for (const t of S.tasks.list) {
    if (t.done) continue;
    const def = TASK_DEFS.find((d) => d.id === t.id);
    if (!def) continue;
    if (def.check()) {
      completeTask(t, def);
    }
  }
}

/** 渲染任务面板 HTML */
export function renderTasksHTML(): string {
  const list = S.tasks.list;
  if (!list.length) {
    return `<div class="task-empty">No active quests</div>`;
  }
  return list
    .map(
      (t) => `
    <div class="task-item${t.done ? ' done' : ''}">
      <span class="task-icon">${icon(t.icon)}</span>
      <span class="task-body">
        <span class="task-text">${t.text}</span>
        <span class="task-reward">${icon(IC.gift)}${t.reward || ''}</span>
      </span>
      ${t.done ? `<span class="task-check">${icon(IC.check)}</span>` : ''}
    </div>
  `,
    )
    .join('');
}
