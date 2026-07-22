import * as THREE from 'three';
import { CELL, wonderCost, eraReq, SKILLMAP, EXPAND_COST } from './constants';
import { rand, smooth } from './utils';
import { icon, IC } from './icon';

/* ================= 游戏运行时状态 ================= */
export interface CellEntry {
  t: string;
  era: number;
  relic: boolean;
  g: THREE.Group;
  level: number; // 建筑等级（1 起，每级 +20% 收益）
}

/* 危机状态（单一、带剩余时间） */
export interface Crisis {
  type: 'drought' | 'plague' | 'tsunami' | 'meteor';
  t: number;        // 剩余秒数
  severity: number; // 0-1 强度
}

export interface GameState {
  started: boolean;
  over: boolean;
  era: number;
  food: number;
  wood: number;
  gold: number;
  faith: number;
  pop: number;
  happy: number;
  expand: number;
  dayTime: number;
  timeScale: number;
  playTime: number;
  cells: Map<string, CellEntry>;
  wonders: Record<number, boolean>;
  sel: string | null;
  buffs: { rain: number; haste: number };
  cds: Record<string, number>;
  transitioning: boolean;
  expandMode: boolean;
  crisis: Crisis | null;
  /* 市民个体系统：职业槽位由建筑占用 */
  jobs: Map<string, string[]>; // building key -> citizen ids at work
  /* 危机统计/可应对神迹 */
  plagueShield: number; // 免疫时间（秒）
  /* 时代技能：每时代可学习一个 */
  skills: string[];
  /* 当前可选技能（时代跃迁时弹出） */
  skillChoices: string[] | null;
  /* 任务清单 */
  tasks: TaskState;
  /* 累计自动升级次数（驱动难度递增） */
  upgrades: number;
}

export interface TaskState {
  list: ActiveTask[];
  lastRefresh: number;
}

export interface ActiveTask {
  id: string;
  text: string;
  icon: string;
  reward: string;
  done: boolean;
}

export const S: GameState = {
  started: false,
  over: false,
  era: 0,
  food: 40,
  wood: 60,
  gold: 50,
  faith: 15,
  pop: 3,
  happy: 70,
  expand: 0,
  dayTime: 0.32,
  timeScale: 1,
  playTime: 0,
  cells: new Map(),
  wonders: {},
  sel: null,
  buffs: { rain: 0, haste: 0 },
  cds: { rain: 0, meteor: 0, bless: 0, haste: 0, calm: 0, heal: 0 },
  transitioning: false,
  expandMode: false,
  crisis: null,
  jobs: new Map(),
  plagueShield: 0,
  skills: [],
  skillChoices: null,
  tasks: { list: [], lastRefresh: 0 },
  upgrades: 0,
};

/* ================= 地形：种子 + 高度场 + 不规则岸线 + 填海地块 ================= */
export let SEED: number = rand(1000);

export interface Patch {
  ang: number;
  dist: number;
  r: number;
  owned: boolean;
}

export let PATCHES: Patch[] = [];

export function initPatches(): void {
  PATCHES = [];
}

export function addPatch(x: number, z: number, r: number = 5): Patch {
  const ang = Math.atan2(z, x);
  const dist = Math.hypot(x, z);
  const p: Patch = { ang, dist, r, owned: true };
  PATCHES.push(p);
  return p;
}

/** 还原存档时设置种子 */
export function setSeed(s: number): void {
  SEED = s;
}

/** 还原存档时设置 patches 列表 */
export function setPatches(patches: Patch[]): void {
  PATCHES = patches;
}

export function reseed(newSeed?: number): void {
  SEED = newSeed ?? rand(1000);
  initPatches();
}

initPatches();

export const R = (): number => 13;
export const maxCell = (): number => Math.ceil((R() + 8) / CELL);
export const cellKey = (x: number, z: number): string => x + ',' + z;

export function hnoise(x: number, z: number): number {
  return (
    Math.sin(x * 0.32 + SEED) * Math.cos(z * 0.29 + SEED * 1.7) +
    0.55 * Math.sin(x * 0.74 + SEED * 2.3) * Math.sin(z * 0.68 + SEED * 0.9)
  );
}

export function outlineR(a: number): number {
  return (
    (R() - 1.6) *
    (1 +
      0.08 * Math.sin(3 * a + SEED) +
      0.05 * Math.sin(5 * a + SEED * 2.1) +
      0.03 * Math.sin(8 * a + SEED * 3.7))
  );
}

export function patchR(p: Patch, a: number): number {
  return p.r * (1 + 0.16 * Math.sin(4 * a + SEED + p.ang) + 0.08 * Math.sin(7 * a + SEED * 2 + p.ang));
}

export function landH(x: number, z: number): number {
  let best = -1;
  const d = Math.hypot(x, z),
    a = Math.atan2(z, x),
    ro = outlineR(a);
  if (d < ro) {
    const fall = smooth(ro, ro - 4.0, d);
    best = fall * (1.05 + hnoise(x, z) * 0.85);
  }
  for (const p of PATCHES) {
    if (!p.owned) continue;
    const px = Math.cos(p.ang) * p.dist,
      pz = Math.sin(p.ang) * p.dist;
    const dd = Math.hypot(x - px, z - pz),
      aa = Math.atan2(z - pz, x - px),
      pr = patchR(p, aa);
    // 扩大 patch 影响范围，使其与主岛边缘重叠融合（+1.5 的过渡区）
    if (dd < pr + 1.5) {
      const fall = smooth(pr + 1.5, pr - 2.5, dd);
      const h = fall * (0.85 + hnoise(x + 40, z - 30) * 0.4);
      // smooth union：两者接近时取平滑最大值，避免硬边
      if (h > best) {
        best = best < 0 ? h : best + (h - best) * smooth(0.2, 0.8, h);
      }
    }
  }
  return best;
}

export const walkable = (x: number, z: number): boolean => landH(x * CELL, z * CELL) > 0.5;
export const cellY = (x: number, z: number): number => Math.max(0, landH(x * CELL, z * CELL));

export function findCellNear(cx0: number, cz0: number): { x: number; z: number } | null {
  for (let r = 0; r < 8; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx0 + dx,
          z = cz0 + dz;
        if (walkable(x, z) && !S.cells.has(cellKey(x, z))) return { x, z };
      }
    }
  }
  return null;
}

/* ================= 技能加成辅助 ================= */
function sumEffect(type: string): number {
  let s = 0;
  for (const k of S.skills) {
    const def = SKILLMAP[k];
    if (!def) continue;
    for (const e of def.effects) {
      if (e.type === type) s += e.value;
    }
  }
  return s;
}

export const farmMul = (): number => 1 + sumEffect('farmMul');
export const woodMul = (): number => 1 + sumEffect('woodMul');
export const marketMul = (): number => 1 + sumEffect('marketMul');
export const templeMul = (): number => 1 + sumEffect('templeMul');
export const popCapMul = (): number => 1 + sumEffect('popCapMul');
export const citizenSpeedMul = (): number => 1 + sumEffect('citizenSpeedMul');
export const costMul = (): number => Math.max(0.5, 1 - sumEffect('costMul'));
export const godCdMul = (): number => Math.max(0.5, 1 - sumEffect('godCdMul'));
export const crisisDurMul = (): number => Math.max(0.3, 1 - sumEffect('crisisDurMul'));
export const crisisHappyMul = (): number => Math.max(0, 1 - sumEffect('crisisHappyMul'));
export const rainDurAdd = (): number => sumEffect('rainDurAdd');

export const popCap = (): number => {
  let c = 0;
  S.cells.forEach((b) => {
    if (b.t === 'house') c += 4;
  });
  return Math.floor(c * popCapMul());
};

export const eraMul = (): number => 1 + S.era * 0.25;

/** 难度系数：每次自动升级 +6%，最高 +150% */
export const difficulty = (): number => Math.min(2.5, 1 + S.upgrades * 0.06);

export const countType = (t: string): number => {
  let n = 0;
  S.cells.forEach((b) => {
    if (b.t === t) n++;
  });
  return n;
};

export const totalBuildings = (): number => S.cells.size;

/* ================= 资源 / 时代条件辅助 ================= */
import type { BuildingDef } from './constants';

export function costOf(def: BuildingDef): [number, number, number] {
  const base = def.t === 'wonder' ? wonderCost(S.era) : def.cost;
  const m = costMul();
  return [Math.ceil(base[0] * m), Math.ceil(base[1] * m), Math.ceil(base[2] * m)];
}

export function expandCost(idx: number): [number, number] {
  const c = EXPAND_COST[idx];
  const m = costMul();
  return [Math.ceil(c[0] * m), Math.ceil(c[1] * m)];
}

export function canAfford(cost: number[]): boolean {
  return S.wood >= cost[0] && S.gold >= cost[1] && S.faith >= cost[2];
}

export function pay(cost: number[]): void {
  S.wood -= cost[0];
  S.gold -= cost[1];
  S.faith -= cost[2];
}

export function costText(c: number[]): string {
  const s: string[] = [];
  if (c[0]) s.push(icon(IC.wood) + c[0]);
  if (c[1]) s.push(icon(IC.gold) + c[1]);
  if (c[2]) s.push(icon(IC.faith) + c[2]);
  return s.join(' ');
}

export function eraReady(): boolean {
  if (S.era >= 6) return false;
  const r = eraReq(S.era);
  return S.pop >= r.pop && S.gold >= r.gold && !!S.wonders[S.era];
}
