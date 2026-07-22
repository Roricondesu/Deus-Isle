import { S, SEED, PATCHES, setSeed, setPatches, type Patch, type Crisis, type TaskState } from './state';
import { setPaletteSync } from './environment';
import { buildIsland } from './environment';
import { placeBuilding } from './interaction';
import { citizens, clearCitizens, loadCitizen, assignJobs, type SerializedCitizen } from './citizens';

/* ================= 本地存档（localStorage） ================= */

// 自动存档 key（保持向后兼容）
const AUTO_KEY = 'deus-isle-save';
// 手动存档 key 前缀（3 个槽位）
const MANUAL_PREFIX = 'deus-isle-manual-';
export const SAVE_SLOTS = 3;

interface SaveData {
  era: number;
  food: number;
  wood: number;
  gold: number;
  faith: number;
  pop: number;
  happy: number;
  expand: number;
  dayTime: number;
  playTime: number;
  wonders: Record<number, boolean>;
  cells: { x: number; z: number; t: string; e: number; r: 0 | 1; lv?: number }[];
  seed: number;
  patches: Patch[];
  crisis: Crisis | null;
  plagueShield: number;
  citizens: SerializedCitizen[];
  skills: string[];
  tasks: TaskState;
  upgrades?: number;
  // 手动存档额外字段
  savedAt?: number;     // 保存时间戳
  note?: string;        // 备注（自动生成）
}

/** 收集当前游戏状态为 SaveData */
function collectSave(): SaveData {
  const cells: SaveData['cells'] = [];
  S.cells.forEach((b, k) => {
    const [x, z] = k.split(',').map(Number);
    cells.push({ x, z, t: b.t, e: b.era, r: b.relic ? 1 : 0, lv: b.level });
  });
  const citizenData: SerializedCitizen[] = [];
  for (const c of citizens) {
    citizenData.push({
      id: c.id,
      name: c.name,
      age: c.age,
      state: c.state,
      job: c.job,
      jobKey: c.jobKey,
      homeKey: c.homeKey,
      x: c.g.position.x,
      z: c.g.position.z,
    });
  }
  return {
    era: S.era,
    food: S.food,
    wood: S.wood,
    gold: S.gold,
    faith: S.faith,
    pop: S.pop,
    happy: S.happy,
    expand: S.expand,
    dayTime: S.dayTime,
    playTime: S.playTime,
    wonders: S.wonders,
    cells,
    seed: SEED,
    patches: PATCHES.map((p) => ({ ...p })),
    crisis: S.crisis,
    plagueShield: S.plagueShield,
    citizens: citizenData,
    skills: S.skills,
    tasks: { list: S.tasks.list.map((t) => ({ ...t })), lastRefresh: S.tasks.lastRefresh },
    upgrades: S.upgrades,
    savedAt: Date.now(),
  };
}

/** 把 SaveData 还原到游戏状态（不清场，调用方需先 reset） */
function applySave(d: SaveData): void {
  Object.assign(S, {
    era: d.era,
    food: d.food,
    wood: d.wood,
    gold: d.gold,
    faith: d.faith,
    pop: d.pop,
    happy: d.happy,
    expand: d.expand,
    dayTime: d.dayTime,
    playTime: d.playTime || 0,
  });
  S.wonders = d.wonders || {};
  S.crisis = d.crisis ?? null;
  S.plagueShield = d.plagueShield ?? 0;
  S.skills = Array.isArray(d.skills) ? d.skills : [];
  S.skillChoices = null;
  S.tasks = d.tasks && Array.isArray(d.tasks.list)
    ? { list: d.tasks.list.map((t) => ({ ...t })), lastRefresh: d.tasks.lastRefresh || 0 }
    : { list: [], lastRefresh: 0 };
  S.upgrades = typeof d.upgrades === 'number' ? d.upgrades : 0;
  // 还原地形种子和填海地块
  if (typeof d.seed === 'number') setSeed(d.seed);
  if (Array.isArray(d.patches)) setPatches(d.patches.map((p) => ({ ...p })));
  setPaletteSync(S.era);
  buildIsland();
  d.cells.forEach((c) => {
    placeBuilding(c.t, c.e, c.x, c.z, !!c.r, false, false);
    const entry = S.cells.get(c.x + ',' + c.z);
    if (entry) entry.level = c.lv || 1;
  });
  // 还原市民个体
  clearCitizens();
  const citizenArr = Array.isArray(d.citizens) ? d.citizens : [];
  if (citizenArr.length) {
    for (const c of citizenArr) loadCitizen(c);
  } else {
    for (let i = 0; i < S.pop; i++) {
      // spawnCitizen 由 updateCitizens 在下一帧补齐，这里不需要额外生成
    }
  }
  assignJobs();
}

/* ================= 自动存档 ================= */

export function saveGame(): void {
  if (S.over || !S.started) return;
  const data = collectSave();
  localStorage.setItem(AUTO_KEY, JSON.stringify(data));
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw) as SaveData;
    applySave(d);
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave(): void {
  localStorage.removeItem(AUTO_KEY);
}

/* ================= 手动多槽位存档 ================= */

/** 列出所有手动槽位（含空槽位） */
export function listManualSaves(): (SaveData | null)[] {
  const result: (SaveData | null)[] = [];
  for (let i = 0; i < SAVE_SLOTS; i++) {
    try {
      const raw = localStorage.getItem(MANUAL_PREFIX + i);
      if (!raw) {
        result.push(null);
        continue;
      }
      result.push(JSON.parse(raw) as SaveData);
    } catch (e) {
      result.push(null);
    }
  }
  return result;
}

/** 保存到指定槽位 */
export function saveToSlot(slot: number): boolean {
  if (slot < 0 || slot >= SAVE_SLOTS) return false;
  if (S.over || !S.started) return false;
  try {
    const data = collectSave();
    localStorage.setItem(MANUAL_PREFIX + slot, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

/** 从指定槽位读取 */
export function loadFromSlot(slot: number): boolean {
  if (slot < 0 || slot >= SAVE_SLOTS) return false;
  try {
    const raw = localStorage.getItem(MANUAL_PREFIX + slot);
    if (!raw) return false;
    const d = JSON.parse(raw) as SaveData;
    applySave(d);
    return true;
  } catch (e) {
    return false;
  }
}

/** 删除指定槽位 */
export function deleteSlot(slot: number): void {
  if (slot < 0 || slot >= SAVE_SLOTS) return;
  localStorage.removeItem(MANUAL_PREFIX + slot);
}
