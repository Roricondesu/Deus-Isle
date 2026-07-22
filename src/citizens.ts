import * as THREE from 'three';
import { B, C, CO, SP, G, _m } from './materials';
import { CIT_COL, ERAS } from './constants';
import { rand, pick, lerp, clamp } from './utils';
import { S, R, landH, outlineR, patchR, PATCHES } from './state';
import { islandGroup } from './environment';
import { roadEdges, roadVersion } from './roads';
import { burst } from './particles';

/* 桥面高度：与 roads.ts samplePath 中水段 y=0.5 保持一致 */
const BRIDGE_Y = 0.5;

/* ================= 市民个体 ================= */
export type JobType = 'unemployed' | 'farmer' | 'woodcutter' | 'merchant' | 'priest' | 'guard';
export type CitState = 'walk' | 'idle' | 'pray' | 'sick' | 'home';

export interface Citizen {
  id: string;
  name: string;
  g: THREE.Group;
  job: JobType;
  jobKey: string | null; // 工作建筑 key
  age: number; // 0-80 岁
  ageT: number; //  aging timer
  tx: number;
  tz: number;
  sp: number;
  state: CitState;
  t: number;
  ph: number;
  path: THREE.Vector3[];
  pathIdx: number;
  homeKey: string | null;
  emitT: number; // 粒子/特效发射计时
}

export const citizens: Citizen[] = [];
let nextCitizenId = 1;

const FIRST_NAMES_ZH = '子轩 梓涵 一诺 宇轩 诗涵 浩宇 欣怡 博文 梦瑶 俊杰 雨桐 睿思 婉儿 天佑 静姝 明轩 雅琪 思远 佳怡 凯文'.split(' ');
const LAST_NAMES_ZH = '王 李 张 刘 陈 杨 赵 黄 周 吴 徐 孙 胡 朱 高 林 何 郭 马 罗'.split(' ');
const FIRST_NAMES_EN = 'Liam Emma Noah Olivia Ava Ethan Mason Logan Lucas Jackson Aiden Elijah James Oliver Benjamin Sophia Mia Charlotte Amelia'.split(' ');
const LAST_NAMES_EN = 'Smith Johnson Brown Taylor Miller Wilson Moore Anderson Thomas Jackson White Harris Martin Thompson Garcia Martinez'.split(' ');

function randName(): string {
  const zh = Math.random() < 0.7;
  if (zh) return pick(LAST_NAMES_ZH) + pick(FIRST_NAMES_ZH);
  return pick(FIRST_NAMES_EN) + ' ' + pick(LAST_NAMES_EN);
}

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
    if (d < bd) { bd = d; best = key; }
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

/** A* 在建筑图上找 from→to 的最短路径 */
function findPath(sx: number, sz: number, tx: number, tz: number): THREE.Vector3[] {
  if (roadEdges.length === 0) return [];
  const startB = nearestBuildingKey(sx, sz);
  const endB = nearestBuildingKey(tx, tz);
  if (!startB || !endB) return [];
  if (startB === endB) {
    return [new THREE.Vector3(tx, Math.max(landH(tx, tz), BRIDGE_Y), tz)];
  }
  const adj = new Map<string, { to: string; path: THREE.Vector3[] }[]>();
  for (const e of roadEdges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ to: e.to, path: e.path });
    adj.get(e.to)!.push({ to: e.from, path: e.path.slice().reverse() });
  }
  if (!adj.has(startB) || !adj.has(endB)) return [];
  const open = new Set<string>([startB]);
  const cameFrom = new Map<string, { from: string; path: THREE.Vector3[] }>();
  const gScore = new Map<string, number>([[startB, 0]]);
  const fScore = new Map<string, number>([[startB, heuristic(startB, endB)]]);
  while (open.size > 0) {
    let current: string | null = null;
    let minF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < minF) { minF = f; current = k; }
    }
    if (!current) break;
    if (current === endB) {
      const result: THREE.Vector3[] = [];
      let cur: string | null = current;
      while (cur && cameFrom.has(cur)) {
        const { from, path } = cameFrom.get(cur)!;
        for (let i = path.length - 1; i >= 0; i--) result.unshift(path[i].clone());
        cur = from;
      }
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
  return [];
}
function heuristic(fromKey: string, toKey: string): number {
  const a = buildingPos(fromKey);
  const b = buildingPos(toKey);
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/* ================= 市民 mesh ================= */
function makeJobProp(job: JobType): THREE.Object3D | null {
  switch (job) {
    case 'farmer': return B(0.04, 0.5, 0.04, 0x8a6a3a, { x: 0.25, y: 0.45, ol: false });
    case 'woodcutter': return B(0.06, 0.4, 0.06, 0x7a5a38, { x: 0.25, y: 0.45, ol: false });
    case 'priest': return SP(0.06, 0xffd76a, { x: 0.25, y: 0.55, basic: true });
    case 'merchant': return B(0.12, 0.08, 0.08, 0xc9a86a, { x: 0.25, y: 0.45, ol: false });
    case 'guard': return B(0.03, 0.45, 0.12, 0x8a9aaa, { x: 0.25, y: 0.45, ol: false });
    default: return null;
  }
}

function addJobPropToGroup(g: THREE.Group, job: JobType): void {
  if (g.userData.jobProp) {
    g.remove(g.userData.jobProp);
    g.userData.jobProp = null;
  }
  const prop = makeJobProp(job);
  if (prop) {
    g.add(prop);
    g.userData.jobProp = prop;
  }
}

/** 切换市民手持职业道具 */
export function setJobProp(c: Citizen): void {
  addJobPropToGroup(c.g, c.job);
}

export function makeCitizenMesh(e: number, job: JobType): THREE.Group {
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

  // 时代头饰
  if (e === 1) g.add(B(0.34, 0.05, 0.34, 0xd8c89a, { y: 0.88, ol: false }));
  if (e === 2) g.add(CO(0.2, 0.14, 8, 0xd8b86a, { y: 0.92, ol: false }));
  if (e === 3) g.add(C(0.12, 0.13, 0.09, 8, 0x3a3a42, { y: 0.9, ol: false }));
  if (e === 4) g.add(B(0.3, 0.06, 0.2, 0x2a2a2a, { y: 0.86, ol: false }));
  if (e === 5) g.add(_m(new THREE.TorusGeometry(0.17, 0.03, 6, 12), 0x35e0e6, { y: 0.8, rx: Math.PI / 2, basic: true, op: 0.9 }));
  if (e === 6) g.add(SP(0.19, 0xbfe8ff, { y: 0.78, basic: true, op: 0.35 }));

  // 职业标识：手持小道具
  addJobPropToGroup(g, job);

  return g;
}

/* ================= 工作分配 ================= */
const WORK_TYPES: Record<string, JobType> = {
  farm: 'farmer',
  wood: 'woodcutter',
  market: 'merchant',
  temple: 'priest',
};

function maxWorkers(b: typeof S.cells extends Map<string, infer V> ? V : never): number {
  // 每个建筑基础 2 工人，住房 0，奇观 0，公园 1（园丁）
  if (b.t === 'house') return 0;
  if (b.t === 'wonder') return 0;
  if (b.t === 'park') return 1;
  return 2;
}

/** 为所有失业市民分配工作 */
export function assignJobs(): void {
  S.jobs.clear();
  // 初始化每个建筑的工作槽位
  S.cells.forEach((b, key) => {
    S.jobs.set(key, []);
  });
  // 先清空市民的工作绑定
  for (const c of citizens) {
    if (c.job !== 'unemployed') {
      c.job = 'unemployed';
      c.jobKey = null;
    }
  }
  // 按距离分配
  const jobs = Array.from(S.cells.entries())
    .filter(([_, b]) => WORK_TYPES[b.t] || b.t === 'park')
    .map(([key, b]) => ({ key, b, max: maxWorkers(b), type: WORK_TYPES[b.t] || 'guard' }));

  for (const c of citizens) {
    // 幼儿/老人不工作
    if (c.age < 12 || c.age > 60) continue;
    let best: typeof jobs[0] | null = null;
    let bd = Infinity;
    for (const j of jobs) {
      const slots = S.jobs.get(j.key) || [];
      if (slots.length >= j.max) continue;
      const pos = j.b.g.position;
      const d = Math.hypot(pos.x - c.g.position.x, pos.z - c.g.position.z);
      if (d < bd) { bd = d; best = j; }
    }
    if (best) {
      c.job = best.type;
      c.jobKey = best.key;
      const slots = S.jobs.get(best.key) || [];
      slots.push(c.id);
      S.jobs.set(best.key, slots);
      setJobProp(c);
    }
  }
}

/** 返回某建筑的工人数 */
export function workersAt(key: string): number {
  return (S.jobs.get(key) || []).length;
}

/* ================= 生成/移除 ================= */
export function spawnCitizen(x?: number, z?: number): Citizen {
  if (x === undefined) {
    for (let i = 0; i < 12; i++) {
      const a = rand(Math.PI * 2);
      const d = rand(2, R() * 0.85);
      const tx = Math.cos(a) * d;
      const tz = Math.sin(a) * d;
      if (landH(tx, tz) > 0.55) { x = tx; z = tz; break; }
    }
    x = x ?? 0;
    z = z ?? 0;
  }
  const age = rand(18, 45);
  const c: Citizen = {
    id: 'c' + nextCitizenId++,
    name: randName(),
    g: makeCitizenMesh(S.era, 'unemployed'),
    job: 'unemployed',
    jobKey: null,
    age,
    ageT: 0,
    tx: x,
    tz: z,
    sp: rand(1, 1.7),
    state: 'walk',
    t: rand(2),
    ph: rand(6.28),
    path: [],
    pathIdx: 0,
    homeKey: null,
    emitT: 0,
  };
  c.g.position.set(x, landH(x, z), z);
  islandGroup.add(c.g);
  citizens.push(c);
  return c;
}

export function removeCitizen(id: string): boolean {
  const i = citizens.findIndex((c) => c.id === id);
  if (i < 0) return false;
  const c = citizens[i];
  islandGroup.remove(c.g);
  citizens.splice(i, 1);
  // 释放工作槽位
  if (c.jobKey) {
    const slots = S.jobs.get(c.jobKey) || [];
    const idx = slots.indexOf(c.id);
    if (idx >= 0) slots.splice(idx, 1);
  }
  return true;
}

export function clearCitizens(): void {
  for (const c of citizens) islandGroup.remove(c.g);
  citizens.length = 0;
  nextCitizenId = 1;
}

export interface SerializedCitizen {
  id: string;
  name: string;
  age: number;
  state: CitState;
  job: JobType;
  jobKey: string | null;
  homeKey: string | null;
  x: number;
  z: number;
}

export function loadCitizen(data: SerializedCitizen): Citizen {
  const idNum = parseInt(data.id.slice(1), 10) || 0;
  nextCitizenId = Math.max(nextCitizenId, idNum + 1);
  const c: Citizen = {
    id: data.id,
    name: data.name,
    g: makeCitizenMesh(S.era, data.job),
    job: data.job,
    jobKey: data.jobKey,
    age: data.age,
    ageT: 0,
    tx: data.x,
    tz: data.z,
    sp: rand(1, 1.7),
    state: data.state,
    t: 0,
    ph: rand(6.28),
    path: [],
    pathIdx: 0,
    homeKey: data.homeKey,
    emitT: 0,
  };
  c.g.position.set(data.x, landH(data.x, data.z), data.z);
  islandGroup.add(c.g);
  citizens.push(c);
  if (c.jobKey) {
    const slots = S.jobs.get(c.jobKey) || [];
    if (!slots.includes(c.id)) slots.push(c.id);
    S.jobs.set(c.jobKey, slots);
  }
  return c;
}

/** 治愈所有市民并清除瘟疫状态 */
export function healAll(): void {
  for (const c of citizens) {
    if (c.state === 'sick') {
      c.state = 'walk';
      c.t = 0;
      c.path = [];
      c.pathIdx = 0;
      newTarget(c);
    }
  }
}

/** 选下一个目标 */
export function newTarget(c: Citizen): void {
  c.path = [];
  c.pathIdx = 0;

  // 病中：回家或去 temple（如果有 priest）
  if (c.state === 'sick') {
    const temple = Array.from(S.cells.entries()).find(([_, b]) => b.t === 'temple');
    if (temple) {
      const [key, b] = temple;
      c.tx = b.g.position.x + rand(-0.6, 0.6);
      c.tz = b.g.position.z + rand(-0.6, 0.6);
      c.path = findPath(c.g.position.x, c.g.position.z, c.tx, c.tz);
      return;
    }
  }

  // 工作时段且是工作日：去工作建筑
  if (c.job !== 'unemployed' && c.jobKey && Math.random() < 0.55) {
    const b = S.cells.get(c.jobKey);
    if (b) {
      c.tx = b.g.position.x + rand(-0.6, 0.6);
      c.tz = b.g.position.z + rand(-0.6, 0.6);
      c.path = findPath(c.g.position.x, c.g.position.z, c.tx, c.tz);
      return;
    }
  }

  // 50% 去任意建筑
  if (S.cells.size > 0 && Math.random() < 0.5) {
    const arr = Array.from(S.cells.values());
    const b = pick(arr);
    const tx = b.g.position.x + rand(-0.6, 0.6);
    const tz = b.g.position.z + rand(-0.6, 0.6);
    c.tx = tx;
    c.tz = tz;
    c.path = findPath(c.g.position.x, c.g.position.z, tx, tz);
    return;
  }

  // 在当前岛内闲逛
  const island = currentIsland(c.g.position.x, c.g.position.z);
  if (island) {
    for (let i = 0; i < 10; i++) {
      const a = rand(Math.PI * 2);
      const d = rand(1, island.r);
      const x = island.cx + Math.cos(a) * d;
      const z = island.cz + Math.sin(a) * d;
      if (landH(x, z) > 0.55) { c.tx = x; c.tz = z; return; }
    }
  }
  c.tx = 0; c.tz = 0;
}

/* ================= 更新 ================= */
let lastRoadVersion = -1;

export function updateCitizens(dt: number, t: number): void {
  if (lastRoadVersion !== roadVersion) {
    lastRoadVersion = roadVersion;
    for (const c of citizens) { c.path = []; c.pathIdx = 0; }
  }

  const target = Math.min(S.pop, 46);
  const beforeLen = citizens.length;
  while (citizens.length < target) spawnCitizen();
  while (citizens.length > target) {
    const c = citizens.pop();
    if (c) islandGroup.remove(c.g);
  }
  if (citizens.length !== beforeLen) assignJobs();

  // 老龄化：每年（约 60 秒）加一岁
  for (const c of citizens) {
    c.ageT += dt;
    if (c.ageT >= 60) {
      c.ageT -= 60;
      c.age++;
      if (c.age === 12 || c.age === 61) assignJobs();
    }
  }

  // 瘟疫：每秒概率感染
  if (S.crisis?.type === 'plague') {
    const plagueRate = 0.04 * S.crisis.severity * dt;
    for (const c of citizens) {
      if (c.state !== 'sick' && Math.random() < plagueRate) {
        c.state = 'sick';
        c.t = rand(20, 40);
      }
    }
  }

  for (const c of citizens) {
    const g = c.g;
    if (c.state === 'sick') {
      c.t -= dt;
      //  sick 扣血/扣幸福由 game.ts 统一处理
      if (c.t <= 0) {
        c.state = 'walk';
        newTarget(c);
      } else {
        // 缓慢走动或原地颤抖
        g.position.y = landH(g.position.x, g.position.z) + Math.abs(Math.sin(t * 12 + c.ph)) * 0.04;
        c.emitT += dt;
        if (c.emitT > 0.25) {
          c.emitT = 0;
          burst(new THREE.Vector3(g.position.x, g.position.y + 0.5, g.position.z), 0x6ad06a, 1, 0.5, 0.7, 1.2, 0.25);
        }
        continue;
      }
    }

    if (c.state === 'walk') {
      if (c.path.length > 0 && c.pathIdx < c.path.length) {
        const wp = c.path[c.pathIdx];
        const dx = wp.x - g.position.x;
        const dz = wp.z - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3) {
          c.pathIdx++;
          if (c.pathIdx >= c.path.length) { c.state = 'idle'; c.t = rand(1.5, 4); }
        } else {
          const onWater = landH(g.position.x, g.position.z) < 0.05;
          const v = c.sp * (onWater ? 0.7 : 1) * dt;
          g.position.x += (dx / d) * v;
          g.position.z += (dz / d) * v;
          g.rotation.y = Math.atan2(dx, dz);
          g.position.y = wp.y + Math.abs(Math.sin(t * 9 + c.ph)) * 0.07;
          const [aL, aR] = g.userData.arms as THREE.Mesh[];
          aL.rotation.x = Math.sin(t * 9 + c.ph) * 0.6;
          aR.rotation.x = -Math.sin(t * 9 + c.ph) * 0.6;
        }
      } else {
        const dx = c.tx - g.position.x;
        const dz = c.tz - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) { c.state = 'idle'; c.t = rand(1.5, 4); }
        else {
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
      g.position.y = Math.max(groundY, BRIDGE_Y);
      const [aL, aR] = g.userData.arms as THREE.Mesh[];
      aL.rotation.x *= 0.9;
      aR.rotation.x *= 0.9;
      if (c.t <= 0) { c.state = 'walk'; newTarget(c); }
    } else if (c.state === 'pray') {
      c.t -= dt;
      const [aL, aR] = g.userData.arms as THREE.Mesh[];
      aL.rotation.x = lerp(aL.rotation.x, -2.6, 0.12);
      aR.rotation.x = lerp(aR.rotation.x, -2.6, 0.12);
      if (c.t <= 0) { c.state = 'walk'; newTarget(c); }
    }
  }
}

/* 时代跃迁时整体换装 */
export function remeshAllCitizens(): void {
  citizens.forEach((c) => {
    const p = c.g.position.clone();
    islandGroup.remove(c.g);
    c.g = makeCitizenMesh(S.era, c.job);
    c.g.position.copy(p);
    islandGroup.add(c.g);
  });
}
