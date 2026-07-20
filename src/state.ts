import * as THREE from 'three';
import { CELL, wonderCost, eraReq } from './constants';
import { rand, smooth } from './utils';

/* ================= 游戏运行时状态 ================= */
export interface CellEntry {
  t: string;
  era: number;
  relic: boolean;
  g: THREE.Group;
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
  cds: { rain: 0, meteor: 0, bless: 0, haste: 0 },
  transitioning: false,
  expandMode: false,
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
  PATCHES = [0, 1, 2].map((i) => ({
    ang: SEED * 0.7 + i * 2.2 + ((SEED * (i + 3)) % 1) * 0.9,
    dist: 13.2,
    r: 4.6 + i * 1.1,
    owned: false,
  }));
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
    if (dd < pr) {
      const fall = smooth(pr, pr - 3.0, dd);
      best = Math.max(best, fall * (0.85 + hnoise(x + 40, z - 30) * 0.4));
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

export const popCap = (): number => {
  let c = 0;
  S.cells.forEach((b) => {
    if (b.t === 'house') c += 4;
  });
  return c;
};

export const eraMul = (): number => 1 + S.era * 0.25;

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
  return def.t === 'wonder' ? wonderCost(S.era) : def.cost;
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
  if (c[0]) s.push('🪵' + c[0]);
  if (c[1]) s.push('🪙' + c[1]);
  if (c[2]) s.push('✨' + c[2]);
  return s.join(' ');
}

export function eraReady(): boolean {
  if (S.era >= 6) return false;
  const r = eraReq(S.era);
  return S.pop >= r.pop && S.gold >= r.gold && !!S.wonders[S.era];
}
