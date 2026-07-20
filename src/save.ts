import { S, SEED, PATCHES, setSeed, setPatches, type Patch } from './state';
import { setPaletteSync } from './environment';
import { buildIsland } from './environment';
import { placeBuilding } from './interaction';

/* ================= 本地存档（localStorage） ================= */
const SAVE_KEY = 'deus-isle-save';

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
  cells: { x: number; z: number; t: string; e: number; r: 0 | 1 }[];
  seed: number;
  patches: Patch[];
}

export function saveGame(): void {
  if (S.over || !S.started) return;
  const cells: SaveData['cells'] = [];
  S.cells.forEach((b, k) => {
    const [x, z] = k.split(',').map(Number);
    cells.push({ x, z, t: b.t, e: b.era, r: b.relic ? 1 : 0 });
  });
  const data: SaveData = {
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
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw) as SaveData;
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
    // 还原地形种子和填海地块
    if (typeof d.seed === 'number') setSeed(d.seed);
    if (Array.isArray(d.patches)) setPatches(d.patches.map((p) => ({ ...p })));
    setPaletteSync(S.era);
    buildIsland();
    d.cells.forEach((c) => placeBuilding(c.t, c.e, c.x, c.z, !!c.r));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
