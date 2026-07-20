import * as THREE from 'three';
import { B, C, CO, SP, G, _m } from './materials';
import { CIT_COL } from './constants';
import { rand, pick, lerp } from './utils';
import { S, R, landH, outlineR, patchR, PATCHES } from './state';
import { islandGroup } from './environment';

/* 最远采样半径：覆盖到最远的 patch（PATCH_MAX_DIST=32） */
const MAX_WALK_R = 30;

/** 判断 (x,z) 当前所在的岛：主岛 or 某个 patch
 *  返回该岛中心和采样半径，null 表示在水面上（不应发生） */
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

/** 判断建筑是否在指定岛上 */
function buildingOnIsland(bx: number, bz: number, island: { cx: number; cz: number }): boolean {
  const bi = currentIsland(bx, bz);
  if (!bi) return false;
  return Math.hypot(bi.cx - island.cx, bi.cz - island.cz) < 0.5;
}

/* ================= 市民 ================= */
export interface Citizen {
  g: THREE.Group;
  tx: number;
  tz: number;
  sp: number;
  state: 'walk' | 'idle' | 'pray';
  t: number;
  ph: number;
}

export const citizens: Citizen[] = [];

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
      // 扩大采样范围：覆盖主岛 + 已购买 patches
      const d = rand(2, MAX_WALK_R);
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
  };
  citizens.push(c);
  return c;
}

/** 选下一个目标：仅在当前所在岛（主岛或某 patch）内选，绝不跨水
 *  - 50% 概率：以当前岛上的某栋建筑为目标
 *  - 50% 概率：在当前岛范围内随机采样陆地 */
export function newTarget(c: Citizen): void {
  const island = currentIsland(c.g.position.x, c.g.position.z);
  if (!island) {
    // 异常情况：市民在水面上 → 回主岛中心
    c.tx = 0;
    c.tz = 0;
    return;
  }
  // 50% 概率挑当前岛上的建筑作为目标
  if (S.cells.size > 0 && Math.random() < 0.5) {
    const arr = Array.from(S.cells.values()).filter((b) =>
      buildingOnIsland(b.g.position.x, b.g.position.z, island),
    );
    if (arr.length > 0) {
      const b = pick(arr);
      c.tx = b.g.position.x + rand(-0.6, 0.6);
      c.tz = b.g.position.z + rand(-0.6, 0.6);
      return;
    }
  }
  // 50% 概率在当前岛内随机采样
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
  // 都失败 → 回岛中心
  c.tx = island.cx;
  c.tz = island.cz;
}

export function updateCitizens(dt: number, t: number): void {
  const target = Math.min(S.pop, 46);
  while (citizens.length < target) spawnCitizen();
  while (citizens.length > target) {
    const c = citizens.pop();
    if (c) islandGroup.remove(c.g);
  }
  for (const c of citizens) {
    const g = c.g;
    if (c.state === 'walk') {
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
    } else if (c.state === 'idle') {
      c.t -= dt;
      g.position.y = landH(g.position.x, g.position.z);
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
