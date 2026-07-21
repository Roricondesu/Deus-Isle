import * as THREE from 'three';
import { B, C, CO, SP, G, _m } from './materials';
import { CIT_COL } from './constants';
import { rand, pick, lerp } from './utils';
import { S, R, landH, outlineR, patchR, PATCHES } from './state';
import { islandGroup } from './environment';
import { roadEdges, roadVersion } from './roads';

/* 桥面高度：与 roads.ts samplePath 中水段 y=0.5 保持一致 */
const BRIDGE_Y = 0.5;

/* ================= 市民 ================= */
export interface Citizen {
  g: THREE.Group;
  tx: number;
  tz: number;
  sp: number;
  state: 'walk' | 'idle' | 'pray';
  t: number;
  ph: number;
  path: THREE.Vector3[]; // 寻路路径点（跨岛建筑目标时填充）
  pathIdx: number;
}

export const citizens: Citizen[] = [];

/* 路网版本跟踪：roadVersion 变化时清空所有市民路径 */
let lastRoadVersion = -1;

/* ================= 当前所在岛判定 ================= */
function currentIsland(x: number, z: number): { cx: number; cz: number; r: number } | null {
  const d = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  if (d < outlineR(a)) return { cx: 0, cz: 0, r: R() * 0.85 };
  for (const p of PATCHES) {
    if (!p.owned) continue;
    const px = Math.cos(p.ang) * p.dist;
    const pz = Math.sin(p.ang) * p.dist;
    const dd = Math.hypot(x - px, z - pz);
    const aa = Math.atan2(z - pz, x - px);
    if (dd < patchR(p, aa)) return { cx: px, cz: pz, r: p.r * 0.85 };
  }
  return null;
}

/* ================= 寻路：基于路网 roadEdges 的 A* ================= */
function nearestBuildingKey(x: number, z: number): string | null {
  let best: string | null = null;
  let bd = Infinity;
  S.cells.forEach((b, key) => {
    const d = Math.hypot(b.g.position.x - x, b.g.position.z - z);
    if (d < bd) {
      bd = d;
      best = key;
    }
  });
  return best;
}

function buildingPos(key: string): THREE.Vector3 | null {
  const b = S.cells.get(key);
  return b ? b.g.position : null;
}

function pathLength(path: THREE.Vector3[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += path[i].distanceTo(path[i - 1]);
  return len;
}

/** A* 在建筑图上找 from→to 的最短路径（节点=建筑 key，边=MST 路段）
 *  返回完整路径点数组（含起点建筑路径首点和终点附近点） */
function findPath(sx: number, sz: number, tx: number, tz: number): THREE.Vector3[] {
  if (roadEdges.length === 0) return [];
  const startB = nearestBuildingKey(sx, sz);
  const endB = nearestBuildingKey(tx, tz);
  if (!startB || !endB) return [];
  // 同一建筑：直接走向目标点
  if (startB === endB) {
    return [new THREE.Vector3(tx, Math.max(landH(tx, tz), BRIDGE_Y), tz)];
  }
  // 构建邻接表：key → [{ to, path }]
  const adj = new Map<string, { to: string; path: THREE.Vector3[] }[]>();
  for (const e of roadEdges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ to: e.to, path: e.path });
    adj.get(e.to)!.push({ to: e.from, path: e.path.slice().reverse() });
  }
  if (!adj.has(startB) || !adj.has(endB)) return [];

  // A*
  const open = new Set<string>([startB]);
  const cameFrom = new Map<string, { from: string; path: THREE.Vector3[] }>();
  const gScore = new Map<string, number>([[startB, 0]]);
  const fScore = new Map<string, number>([[startB, heuristic(startB, endB)]]);

  while (open.size > 0) {
    // 取 f 最小节点
    let current: string | null = null;
    let minF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < minF) {
        minF = f;
        current = k;
      }
    }
    if (!current) break;
    if (current === endB) {
      // 重建路径：拼接每条边的 path
      const result: THREE.Vector3[] = [];
      let cur: string | null = current;
      while (cur && cameFrom.has(cur)) {
        const { from, path } = cameFrom.get(cur)!;
        // 当前段路径点插到结果前面（不含 from 的首点，避免重复）
        for (let i = path.length - 1; i >= 0; i--) {
          result.unshift(path[i].clone());
        }
        cur = from;
      }
      // 末尾追加目标点本身
      result.push(new THREE.Vector3(tx, Math.max(landH(tx, tz), BRIDGE_Y), tz));
      return result;
    }
    open.delete(current);
    const neighbors = adj.get(current) || [];
    for (const { to, path } of neighbors) {
      const edgeLen = pathLength(path);
      const tentG = (gScore.get(current) ?? Infinity) + edgeLen;
      if (tentG < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, { from: current, path });
        gScore.set(to, tentG);
        fScore.set(to, tentG + heuristic(to, endB));
        open.add(to);
      }
    }
  }
  return []; // 无路径
}

function heuristic(fromKey: string, toKey: string): number {
  const a = buildingPos(fromKey);
  const b = buildingPos(toKey);
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/* ================= 市民 mesh ================= */
export function makeCitizenMesh(e: number): THREE.Group {
  const g = G();
  const bodyC = Math.random() < 0.3 ? pick([0xd05a4a, 0x4a9e5a, 0xb85ad0, 0xe0a03a]) : CIT_COL[e];
  const body = _m(new THREE.CapsuleGeometry(0.16, 0.3, 3, 8), bodyC, { y: 0.42 });
  g.add(body);
  g.add(SP(0.15, 0xf0c8a0, { y: 0.78 }));
  const aL = B(0.07, 0.26, 0.07, bodyC, { x: -0.22, y: 0.5, ol: false });
  const aR = B(0.07, 0.26, 0.07, bodyC, { x: 0.22, y: 0.5, ol: false });
  aL.geometry.translate(0, -0.1, 0);
  aR.geometry.translate(0, -0.1, 0);
  aL.position.y = 0.62;
  aR.position.y = 0.62;
  g.add(aL);
  g.add(aR);
  g.userData.arms = [aL, aR];
  if (e === 1) g.add(B(0.34, 0.05, 0.34, 0xd8c89a, { y: 0.88, ol: false }));
  if (e === 2) g.add(CO(0.2, 0.14, 8, 0xd8b86a, { y: 0.92, ol: false }));
  if (e === 3) g.add(C(0.12, 0.13, 0.09, 8, 0x3a3a42, { y: 0.9, ol: false }));
  if (e === 4) g.add(B(0.3, 0.06, 0.2, 0x2a2a2a, { y: 0.86, ol: false }));
  if (e === 5)
    g.add(
      _m(new THREE.TorusGeometry(0.17, 0.03, 6, 12), 0x35e0e6, {
        y: 0.8,
        rx: Math.PI / 2,
        basic: true,
        op: 0.9,
      }),
    );
  if (e === 6) g.add(SP(0.19, 0xbfe8ff, { y: 0.78, basic: true, op: 0.35 }));
  return g;
}

export function spawnCitizen(x?: number, z?: number): Citizen {
  if (x === undefined) {
    for (let i = 0; i < 12; i++) {
      const a = rand(Math.PI * 2);
      const d = rand(2, R() * 0.85);
      const tx = Math.cos(a) * d;
      const tz = Math.sin(a) * d;
      if (landH(tx, tz) > 0.55) {
        x = tx;
        z = tz;
        break;
      }
    }
    x = x ?? 0;
    z = z ?? 0;
  }
  const g = makeCitizenMesh(S.era);
  g.position.set(x, landH(x, z), z);
  islandGroup.add(g);
  const c: Citizen = {
    g,
    tx: g.position.x,
    tz: g.position.z,
    sp: rand(1, 1.7),
    state: 'walk',
    t: rand(2),
    ph: rand(6.28),
    path: [],
    pathIdx: 0,
  };
  citizens.push(c);
  return c;
}

/** 选下一个目标：
 *  - 50% 概率：去任意建筑（跨岛时走桥寻路，path 填充路径点）
 *  - 50% 概率：在当前岛内随机采样（不跨水，直走） */
export function newTarget(c: Citizen): void {
  c.path = [];
  c.pathIdx = 0;

  // 50% 概率去任意建筑（可能跨岛，走桥）
  if (S.cells.size > 0 && Math.random() < 0.5) {
    const arr = Array.from(S.cells.values());
    const b = pick(arr);
    const tx = b.g.position.x + rand(-0.6, 0.6);
    const tz = b.g.position.z + rand(-0.6, 0.6);
    c.tx = tx;
    c.tz = tz;
    // 寻路：如果跨岛，path 会被填充；同岛内可能 path 仅含目标点
    c.path = findPath(c.g.position.x, c.g.position.z, tx, tz);
    return;
  }

  // 50% 概率在当前岛内随机采样（绝不跨水）
  const island = currentIsland(c.g.position.x, c.g.position.z);
  if (island) {
    for (let i = 0; i < 10; i++) {
      const a = rand(Math.PI * 2);
      const d = rand(1, island.r);
      const x = island.cx + Math.cos(a) * d;
      const z = island.cz + Math.sin(a) * d;
      if (landH(x, z) > 0.55) {
        c.tx = x;
        c.tz = z;
        return;
      }
    }
  }
  // 失败 → 回主岛中心
  c.tx = 0;
  c.tz = 0;
}

export function updateCitizens(dt: number, t: number): void {
  // 路网更新时清空所有市民路径，强制重新寻路
  if (lastRoadVersion !== roadVersion) {
    lastRoadVersion = roadVersion;
    for (const c of citizens) {
      c.path = [];
      c.pathIdx = 0;
    }
  }

  const target = Math.min(S.pop, 46);
  while (citizens.length < target) spawnCitizen();
  while (citizens.length > target) {
    const c = citizens.pop();
    if (c) islandGroup.remove(c.g);
  }
  for (const c of citizens) {
    const g = c.g;
    if (c.state === 'walk') {
      // 有寻路路径：沿路径点走（跨岛走桥）
      if (c.path.length > 0 && c.pathIdx < c.path.length) {
        const wp = c.path[c.pathIdx];
        const dx = wp.x - g.position.x;
        const dz = wp.z - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3) {
          c.pathIdx++;
          if (c.pathIdx >= c.path.length) {
            c.state = 'idle';
            c.t = rand(1.5, 4);
          }
        } else {
          // 跨水段（桥）减速
          const onWater = landH(g.position.x, g.position.z) < 0.05;
          const v = c.sp * (onWater ? 0.7 : 1) * dt;
          g.position.x += (dx / d) * v;
          g.position.z += (dz / d) * v;
          g.rotation.y = Math.atan2(dx, dz);
          // y 用路径点 y（已含贴地/桥面）
          g.position.y = wp.y + Math.abs(Math.sin(t * 9 + c.ph)) * 0.07;
          const [aL, aR] = g.userData.arms as THREE.Mesh[];
          aL.rotation.x = Math.sin(t * 9 + c.ph) * 0.6;
          aR.rotation.x = -Math.sin(t * 9 + c.ph) * 0.6;
        }
      } else {
        // 无路径：直走向 tx/tz（同岛内闲逛）
        const dx = c.tx - g.position.x;
        const dz = c.tz - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) {
          c.state = 'idle';
          c.t = rand(1.5, 4);
        } else {
          const v = c.sp * dt;
          g.position.x += (dx / d) * v;
          g.position.z += (dz / d) * v;
          g.rotation.y = Math.atan2(dx, dz);
          g.position.y = landH(g.position.x, g.position.z) + Math.abs(Math.sin(t * 9 + c.ph)) * 0.07;
          const [aL, aR] = g.userData.arms as THREE.Mesh[];
          aL.rotation.x = Math.sin(t * 9 + c.ph) * 0.6;
          aR.rotation.x = -Math.sin(t * 9 + c.ph) * 0.6;
        }
      }
    } else if (c.state === 'idle') {
      c.t -= dt;
      const groundY = landH(g.position.x, g.position.z);
      // 停在桥上时也保持桥面高度，避免下沉到水面
      g.position.y = Math.max(groundY, BRIDGE_Y);
      const [aL, aR] = g.userData.arms as THREE.Mesh[];
      aL.rotation.x *= 0.9;
      aR.rotation.x *= 0.9;
      if (c.t <= 0) {
        c.state = 'walk';
        newTarget(c);
      }
    } else if (c.state === 'pray') {
      c.t -= dt;
      const [aL, aR] = g.userData.arms as THREE.Mesh[];
      aL.rotation.x = lerp(aL.rotation.x, -2.6, 0.12);
      aR.rotation.x = lerp(aR.rotation.x, -2.6, 0.12);
      if (c.t <= 0) {
        c.state = 'walk';
        newTarget(c);
      }
    }
  }
}

/* 时代跃迁时整体换装 */
export function remeshAllCitizens(): void {
  citizens.forEach((c) => {
    const p = c.g.position.clone();
    islandGroup.remove(c.g);
    c.g = makeCitizenMesh(S.era);
    c.g.position.copy(p);
    islandGroup.add(c.g);
  });
}
