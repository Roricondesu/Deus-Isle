import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  _m,
  B,
  C,
  CO,
  SP,
  G,
  terrainMat,
  rockMat,
  leafMat,
  foamMat,
  WIN_MAT,
  gradTex,
  undersideMat,
} from './materials';
import { ERAS } from './constants';
import { $, V3, rand, randi, smooth, clamp, lerp } from './utils';
import { icon, IC } from './icon';
import {
  S,
  R,
  PATCHES,
  SEED,
  landH,
  outlineR,
  patchR,
  cellKey,
} from './state';

/* ================= 渲染器 / 场景 / 相机 ================= */
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xaee2ff, 60, 220);

export const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 600);
// 初始主界面：相机大幅左移，岛屿偏到画面右侧，给左侧标题留足空间
camera.position.set(-40, 22, 34);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 12;
controls.maxDistance = 110;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.target.set(0, 1, 0);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.domElement.addEventListener(
  'pointerdown',
  () => {
    controls.autoRotate = false;
  },
  { once: true },
);

/* ================= 光照 ================= */
export const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a6a4a, 0.7);
scene.add(hemi);

export const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

/* ================= 调色板（运行时向目标过渡） ================= */
export const PAL: Record<string, THREE.Color> = {};
export const PAL_T: Record<string, THREE.Color> = {};
const PAL_KEYS = ['sky', 'night', 'dusk', 'fog', 'water', 'grass', 'sand', 'rock', 'leaf', 'sun'];
PAL_KEYS.forEach((k) => {
  PAL[k] = new THREE.Color(ERAS[0][k]);
  PAL_T[k] = new THREE.Color(ERAS[0][k]);
});

export function setPalette(e: number): void {
  PAL_KEYS.forEach((k) => PAL_T[k].set(ERAS[e][k]));
}

/* 立即同步当前调色板（用于加载存档时跳过过渡） */
export function setPaletteSync(e: number): void {
  setPalette(e);
  PAL_KEYS.forEach((k) => PAL[k].copy(PAL_T[k]));
}

/* ================= 场景组：world / islandGroup（发射时整体升空） ================= */
export const world = new THREE.Group();
scene.add(world);

export const islandGroup = new THREE.Group();
world.add(islandGroup);

/* ================= 起飞底部岩石建模（升空时才显示） ================= */
let undersideGroup: THREE.Group | null = null;

/** 生成岛屿底部：复用 landH 但翻转 y 并起伏×2，染岩石色
 *  顶点 alpha 与主岛地形同步挖洞：只在岛屿轮廓内可见，岛外 discard */
export function buildIslandUnderside(): THREE.Group {
  if (undersideGroup) return undersideGroup;
  const g = new THREE.Group();
  const rock = new THREE.Color(0x8a7f6a);

  // 单块底面网格：在 (cx, cz) 周围 size×size 范围采样 landH 并翻转
  const buildSlab = (cx: number, cz: number, size: number, res: number) => {
    const seg = Math.ceil(size / res);
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const n = pos.count;
    const colors = new Float32Array(n * 4); // RGBA，岛外 alpha=0 → discard
    for (let i = 0; i < n; i++) {
      const h = landH(pos.getX(i) + cx, pos.getZ(i) + cz);
      // 翻转 y 并放大起伏 2 倍；岛外（h<=0）也跟随下沉，但 alpha=0 不显示
      pos.setY(i, h > 0 ? -h * 2 : h * 2);
      // 边缘 alpha 与主岛地形同步：h>0.3 完全显示，h<-0.2 完全消失
      const a = smooth(-0.2, 0.3, h);
      colors[i * 4 + 0] = rock.r;
      colors[i * 4 + 1] = rock.g;
      colors[i * 4 + 2] = rock.b;
      colors[i * 4 + 3] = a;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, undersideMat);
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    g.add(mesh);
  };

  // 主岛底部
  buildSlab(0, 0, (R() + 9) * 2, 1);
  // 每个 patch 的底部
  PATCHES.forEach((p) => {
    if (!p.owned) return;
    const px = Math.cos(p.ang) * p.dist;
    const pz = Math.sin(p.ang) * p.dist;
    buildSlab(px, pz, (p.r + 4) * 2, 0.9);
  });

  g.visible = false; // 默认隐藏，起飞时显示
  islandGroup.add(g);
  undersideGroup = g;
  return g;
}

/** 起飞时显示底部岩石 */
export function showIslandUnderside(): void {
  const g = buildIslandUnderside();
  g.visible = true;
}

/* ================= 海 ================= */
const waterGeo = new THREE.PlaneGeometry(420, 420, 72, 72);
export const waterMat = new THREE.MeshPhongMaterial({
  color: 0x2f8fd0,
  shininess: 90,
  specular: 0x88ccff,
  transparent: true,
  opacity: 0.94,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.4;
water.receiveShadow = true;
scene.add(water);
const wBase = waterGeo.attributes.position.array.slice();

/* ================= 地形 ================= */
export let terrainMeshes: THREE.Mesh[] = [];
export let skirtMeshes: THREE.Mesh[] = [];
export let foamMeshes: THREE.Mesh[] = [];

function buildTopGrid(cx: number, cz: number, size: number, res: number): THREE.Mesh {
  const seg = Math.ceil(size / res);
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const n = pos.count;
  const colors = new Float32Array(n * 4); // RGBA：岛外 alpha=0
  const zones = new Uint8Array(n);
  const jit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const h = landH(pos.getX(i) + cx, pos.getZ(i) + cz);
    const onLand = h > 0;
    pos.setY(i, onLand ? h : -0.5);
    zones[i] = h < 0.55 ? 0 : h > 1.85 ? 2 : 1; // 0 沙滩 1 草地 2 岩石
    jit[i] = rand(0.88, 1.06);
    // 边缘 alpha 平滑过渡：h>0.3 完全显示，h<-0.2 完全消失
    colors[i * 4 + 3] = smooth(-0.2, 0.3, h);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, terrainMat);
  m.receiveShadow = true;
  m.castShadow = true;
  m.position.set(cx, 0, cz);
  m.userData.zones = zones;
  m.userData.jit = jit;
  return m;
}

function ringStrip(
  rTop: (a: number) => number,
  rBot: (a: number) => number,
  yTop: number,
  yBot: number,
  mat: THREE.Material,
  shadow?: boolean,
  cap?: boolean,
  // 可选：只画 [aStart, aEnd] 范围的角度（用于 patch 朝海侧）
  arc?: { start: number; end: number },
): THREE.Mesh {
  const N = 64;
  const aStart = arc ? arc.start : 0;
  const aEnd = arc ? arc.end : Math.PI * 2;
  const verts: number[] = [];
  // 角度步进
  const steps = arc ? Math.max(8, Math.ceil((aEnd - aStart) / (Math.PI * 2) * N)) : N;
  for (let i = 0; i <= steps; i++) {
    const a = aStart + (aEnd - aStart) * (i / steps);
    verts.push(Math.cos(a) * rTop(a), yTop, Math.sin(a) * rTop(a));
    verts.push(Math.cos(a) * rBot(a), yBot, Math.sin(a) * rBot(a));
  }
  const idx: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  // 底面封口（避免从下方看到裙摆内部空腔）
  if (cap && !arc) {
    const base = verts.length / 3;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      verts.push(Math.cos(a) * rBot(a), yBot, Math.sin(a) * rBot(a));
    }
    for (let i = 0; i < N; i++) {
      idx.push(base + i, base + i + 1, base);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  if (shadow) m.castShadow = true;
  return m;
}

const _zc = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
export function recolorTerrain(): void {
  _zc[0].copy(PAL.sand);
  _zc[1].copy(PAL.grass);
  _zc[2].copy(PAL.rock);
  for (const m of terrainMeshes) {
    const zones = m.userData.zones as Uint8Array;
    const jit = m.userData.jit as Float32Array;
    const col = m.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const j = jit[i];
      const a = col.getW(i); // 保留 alpha（岛上=1, 岛外=0）
      col.setXYZW(i, _zc[z].r * j, _zc[z].g * j, _zc[z].b * j, a);
    }
    col.needsUpdate = true;
  }
}

let natureGroup: THREE.Group | null = null;

/* 树木状态：'tree' 成熟 / 'stump' 砍后树桩 / 'sapling' 再生长中 */
interface TreeState {
  g: THREE.Group;       // 整个组的引用（含树干+树叶）
  leaf: THREE.Object3D; // 叶子对象（用于缩放/隐藏）
  baseScale: number;
  x: number;
  z: number;
  state: 'tree' | 'stump' | 'sapling';
  regrowT: number;      // 距下次成长剩余秒数
  chopCd: number;       // 距下次可被砍伐剩余秒数
}

const treeStates: TreeState[] = [];

function makeTree(x: number, z: number, h: number): THREE.Group {
  const t = G();
  const s = rand(0.7, 1.25);
  t.add(C(0.09, 0.13, 0.7, 6, 0x7a5a38, { y: 0.35, ol: false }));
  let leaf: THREE.Object3D;
  if (Math.random() < 0.5) {
    leaf = _m(new THREE.IcosahedronGeometry(0.55, 0), 0xffffff, { y: 1.0, ol: false });
    (leaf as THREE.Mesh).material = leafMat;
  } else {
    leaf = CO(0.55, 1.2, 7, 0xffffff, { y: 1.05, ol: false });
    (leaf as THREE.Mesh).material = leafMat;
  }
  t.add(leaf);
  t.position.set(x, h - 0.05, z);
  t.scale.setScalar(s);
  t.rotation.y = rand(6.28);
  // 记录状态
  treeStates.push({
    g: t,
    leaf,
    baseScale: s,
    x,
    z,
    state: 'tree',
    regrowT: 0,
    chopCd: rand(2, 8),  // 初始随机延迟，避免一起被砍
  });
  return t;
}

function scatterNature(): void {
  if (natureGroup) islandGroup.remove(natureGroup);
  natureGroup = G();
  islandGroup.add(natureGroup);
  treeStates.length = 0;
  const n = 30 + PATCHES.filter((p) => p.owned).length * 10;
  let placed = 0;
  let tries = 0;
  while (placed < n && tries < n * 10) {
    tries++;
    const a = rand(Math.PI * 2);
    const d = rand(2.5, R() + 7);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const h = landH(x, z);
    if (h < 0.6) continue;
    let blocked = false;
    S.cells.forEach((b) => {
      if (Math.hypot(b.g.position.x - x, b.g.position.z - z) < 1.7) blocked = true;
    });
    if (blocked) continue;
    placed++;
    if (Math.random() < 0.78) {
      natureGroup.add(makeTree(x, z, h));
    } else {
      // 石头
      const r = _m(new THREE.IcosahedronGeometry(rand(0.2, 0.42), 0), 0x9a9a9a, {
        x,
        y: h,
        z,
        ol: false,
        s: [1, rand(0.6, 0.9), 1],
      });
      r.material = rockMat;
      natureGroup.add(r);
    }
  }
}

/* 每帧更新树木：被伐木工砍 → 树桩 → 树苗 → 成熟 */
export function updateTrees(dt: number): void {
  if (!treeStates.length) return;
  // 找所有伐木工建筑
  const woodcutters: { x: number; z: number }[] = [];
  S.cells.forEach((b) => {
    if (b.t === 'wood') woodcutters.push({ x: b.g.position.x, z: b.g.position.z });
  });
  for (const ts of treeStates) {
    // 状态机
    if (ts.state === 'tree') {
      ts.chopCd -= dt;
      if (ts.chopCd <= 0 && woodcutters.length) {
        // 查找最近的伐木工（距离 < 4 才算可达）
        let nearest: { x: number; z: number } | null = null;
        let nd = Infinity;
        for (const w of woodcutters) {
          const d = Math.hypot(w.x - ts.x, w.z - ts.z);
          if (d < nd) { nd = d; nearest = w; }
        }
        if (nearest && nd < 5) {
          // 砍伐：变树桩
          ts.state = 'stump';
          ts.regrowT = rand(12, 22);  // 12-22 秒后开始再生长
          ts.leaf.visible = false;
          // 给玩家加木材
          S.wood += randi(3, 6);
        } else {
          // 没有可达伐木工，重置冷却
          ts.chopCd = rand(3, 7);
        }
      }
    } else if (ts.state === 'stump') {
      ts.regrowT -= dt;
      if (ts.regrowT <= 0) {
        // 进入树苗阶段
        ts.state = 'sapling';
        ts.regrowT = rand(15, 28);  // 15-28 秒长成
        ts.leaf.visible = true;
        ts.leaf.scale.setScalar(0.25);
        ts.g.scale.setScalar(ts.baseScale);
      }
    } else if (ts.state === 'sapling') {
      ts.regrowT -= dt;
      // 渐进长大：从 0.25 → 1
      const k = 1 - Math.max(0, ts.regrowT) / 28;
      const leafScale = 0.25 + 0.75 * clamp(k, 0, 1);
      ts.leaf.scale.setScalar(leafScale);
      if (ts.regrowT <= 0) {
        ts.state = 'tree';
        ts.chopCd = rand(5, 12);
        ts.leaf.scale.setScalar(1);
      }
    }
  }
}

export function buildIsland(): void {
  terrainMeshes.forEach((m) => {
    islandGroup.remove(m);
    m.geometry.dispose();
  });
  skirtMeshes.forEach((m) => {
    islandGroup.remove(m);
    m.geometry.dispose();
  });
  foamMeshes.forEach((m) => {
    scene.remove(m);
    m.geometry.dispose();
  });
  terrainMeshes = [];
  skirtMeshes = [];
  foamMeshes = [];

  const main = buildTopGrid(0, 0, (R() + 9) * 2, 1);
  islandGroup.add(main);
  terrainMeshes.push(main);

  const fo = ringStrip(
    (a) => outlineR(a) + 0.1,
    (a) => outlineR(a) + 1.5,
    -0.05,
    -0.05,
    foamMat,
    false,
  );
  scene.add(fo);
  foamMeshes.push(fo);

  PATCHES.forEach((p) => {
    if (!p.owned) return;
    const px = Math.cos(p.ang) * p.dist;
    const pz = Math.sin(p.ang) * p.dist;
    const g = buildTopGrid(px, pz, (p.r + 4) * 2, 0.9);
    islandGroup.add(g);
    terrainMeshes.push(g);
    // 只画朝海侧半圈 foam（远离岛心方向），避免 patch 与主岛之间出现白条
    const fo2 = ringStrip(
      (a) => patchR(p, a) + 0.1,
      (a) => patchR(p, a) + 1.4,
      -0.05,
      -0.05,
      foamMat,
      false,
      false,
      // 朝海侧角度范围：以 patch 中心为原点，朝外方向 ±90°
      { start: p.ang - Math.PI / 2, end: p.ang + Math.PI / 2 },
    );
    fo2.position.set(px, 0, pz);
    scene.add(fo2);
    foamMeshes.push(fo2);
  });

  recolorTerrain();
  scatterNature();
}

/* ================= 云 / 船 / 鸟 / 星空 / 太阳 / 月亮 ================= */
const clouds: THREE.Group[] = [];
for (let i = 0; i < 7; i++) {
  const c = G();
  const mat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: gradTex,
    transparent: true,
    opacity: 0.92,
  });
  const puffs = randi(3, 5);
  for (let j = 0; j < puffs; j++) {
    const puff = _m(new THREE.IcosahedronGeometry(rand(0.9, 1.7), 0), 0xffffff, {
      x: j * 1.4 - puffs * 0.7 + rand(-0.4, 0.4),
      y: rand(-0.25, 0.3),
      z: rand(-0.5, 0.5),
      ol: false,
    });
    puff.material = mat;
    c.add(puff);
  }
  c.position.set(rand(-70, 70), rand(15, 26), rand(-70, 70));
  c.userData.sp = rand(0.3, 0.8);
  scene.add(c);
  clouds.push(c);
}

const boat = G();
boat.add(B(1.6, 0.4, 0.7, 0x8a5a3a, { y: 0.2 }));
boat.add(B(1.2, 0.3, 0.5, 0xa06a42, { y: 0.45 }));
boat.add(C(0.04, 0.04, 1.6, 6, 0x6a4a2a, { y: 1.2, ol: false }));
boat.add(B(0.7, 0.9, 0.04, 0xf0e8d8, { x: 0.35, y: 1.25, ol: false }));
scene.add(boat);

/* ================= 港口：码头 + 灯塔（带旋转光带 + 闪烁灯） ================= */
export const portGroup = G();
// 港口位置：贴着岛外缘（outlineR 处），灯塔在岸上、码头伸向海面
const portAng = (SEED % 1) * Math.PI * 2;
const portR = outlineR(portAng) - 0.5; // 岛岸内侧一点点
const portX = Math.cos(portAng) * portR;
const portZ = Math.sin(portAng) * portR;
portGroup.position.set(portX, 0, portZ);
// +X 方向指向岛外（海面）
portGroup.rotation.y = -portAng + Math.PI / 2;
islandGroup.add(portGroup);

// 码头平台（向岛外延伸，从 x=0.5 到 x=2.9）
const dock = B(2.4, 0.18, 1.2, 0xb88a5a, { y: -0.2, x: 1.7, ol: false });
portGroup.add(dock);
// 码头支柱
for (const [px, pz] of [
  [0.7, -0.45],
  [0.7, 0.45],
  [2.7, -0.45],
  [2.7, 0.45],
] as [number, number][]) {
  portGroup.add(C(0.08, 0.08, 1.0, 6, 0x6a4a2a, { x: px, y: -0.65, z: pz, ol: false }));
}
// 系缆桩
portGroup.add(C(0.1, 0.18, 0.1, 8, 0x4a3a2a, { x: 0.8, y: -0.02, z: -0.4, ol: false }));
portGroup.add(C(0.1, 0.18, 0.1, 8, 0x4a3a2a, { x: 0.8, y: -0.02, z: 0.4, ol: false }));

// 灯塔基座（位置在 x=0，岛岸上）
const baseY = 0; // 岛岸高度，大致贴近地面
portGroup.add(B(0.8, 0.2, 0.8, 0x8a8a8a, { x: 0, y: baseY + 0.1 }));
// 塔身（红白条纹）
const tower = C(0.32, 0.36, 1.4, 12, 0xf0e8d8, { x: 0, y: baseY + 0.95 });
portGroup.add(tower);
for (let i = 0; i < 3; i++) {
  portGroup.add(C(0.33, 0.37, 0.12, 12, 0xd04a3a, { x: 0, y: baseY + 0.45 + i * 0.45, ol: false }));
}
// 灯室
const lampY = baseY + 1.75;
portGroup.add(C(0.34, 0.3, 0.2, 12, 0x2a2a2a, { x: 0, y: lampY }));
// 灯泡
const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe98a, fog: false });
const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lampMat);
lamp.position.set(0, lampY, 0);
portGroup.add(lamp);

const birds: THREE.Group[] = [];
for (let i = 0; i < 4; i++) {
  const b = G();
  b.add(B(0.3, 0.06, 0.1, 0xffffff, { ol: false }));
  b.add(B(0.1, 0.06, 0.3, 0xffffff, { ol: false }));
  b.userData = { r: rand(20, 34), h: rand(10, 16), sp: rand(0.25, 0.5), ph: rand(6.28) };
  scene.add(b);
  birds.push(b);
}

const starGeo = new THREE.BufferGeometry();
{
  const p: number[] = [];
  for (let i = 0; i < 420; i++) {
    const a = rand(Math.PI * 2);
    const e = rand(0.06, 1.4);
    const r = 260;
    p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
export const starMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1.6,
  sizeAttenuation: false,
  transparent: true,
  opacity: 0,
  fog: false,
});
scene.add(new THREE.Points(starGeo, starMat));

const sunSpr = _m(new THREE.SphereGeometry(4, 16, 12), 0xffe9a0, { basic: true, ol: false });
scene.add(sunSpr);
const moonSpr = _m(new THREE.SphereGeometry(2.6, 16, 12), 0xe8ecff, { basic: true, ol: false });
scene.add(moonSpr);
(sunSpr.material as any).fog = false;
(moonSpr.material as any).fog = false;

/* ================= 昼夜 / 调色板过渡 ================= */
const bgCol = new THREE.Color();
scene.background = bgCol;
const _t1 = new THREE.Color();
const _t2 = new THREE.Color();
let dayF = 1;

export function dayNight(): void {
  const ang = S.dayTime * Math.PI * 2;
  const elev = Math.sin(ang);
  dayF = smooth(-0.1, 0.28, elev);
  const duskF = Math.exp(-Math.pow(elev / 0.18, 2)) * (Math.cos(ang) < 0 ? 1 : 0.3);
  bgCol.copy(PAL.night).lerp(PAL.sky, dayF).lerp(PAL.dusk, duskF * 0.55);
  scene.fog!.color.copy(bgCol);
  sun.position.set(Math.cos(ang) * 70, Math.sin(ang) * 80, 36);
  sun.intensity = 0.1 + 1.35 * dayF;
  _t1.set(0xff9a5a);
  _t2.copy(PAL.sun);
  sun.color.copy(_t2).lerp(_t1, duskF * 0.6);
  if (elev < -0.05) {
    sun.color.set(0x8a9ac8);
    sun.intensity = 0.16;
    sun.position.set(-Math.cos(ang) * 70, -Math.sin(ang) * 80, 36);
  }
  hemi.intensity = 0.3 + 0.5 * dayF;
  sunSpr.position.copy(sun.position).normalize().multiplyScalar(190);
  sunSpr.visible = elev > -0.15;
  moonSpr.position
    .set(-Math.cos(ang), -Math.sin(ang), -0.3)
    .normalize()
    .multiplyScalar(190);
  moonSpr.visible = elev < 0.15;
  starMat.opacity = 1 - dayF;
  WIN_MAT.color.set(dayF > 0.5 ? 0x46586a : 0xffd77a);
  waterMat.color.copy(PAL.water).multiplyScalar(0.35 + 0.65 * dayF);
  if (S.crisis?.type === 'drought') {
    const droughtCol = new THREE.Color(0x9a7a4a);
    waterMat.color.lerp(droughtCol, S.crisis.severity * 0.55);
  }
  $('clock').innerHTML = icon(dayF > 0.6 ? IC.sun : duskF > 0.5 ? IC.sunset : IC.moon);
}

export function paletteLerp(dt: number): void {
  const k = 1 - Math.pow(0.25, dt);
  PAL_KEYS.forEach((key) => PAL[key].lerp(PAL_T[key], k));
  rockMat.color.copy(PAL.rock);
  leafMat.color.copy(PAL.leaf);
  recolorTerrain();
}

/* ================= 环境动效：水波 / 云 / 船 / 鸟 / 部件动画 ================= */
export function waterWave(t: number): void {
  const tsunami = S.crisis?.type === 'tsunami' ? S.crisis.severity : 0;
  const amp = 0.12 + tsunami * 0.42;
  const p = waterGeo.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 3) {
    p[i + 2] = Math.sin(p[i] * 0.14 + t * (1.1 + tsunami * 2)) * amp + Math.cos(p[i + 1] * 0.12 + t * (0.9 + tsunami * 1.5)) * amp;
  }
  waterGeo.attributes.position.needsUpdate = true;
  foamMeshes.forEach((f) => f.scale.setScalar(1 + Math.sin(t * (1.4 + tsunami * 3)) * (0.02 + tsunami * 0.08)));
  foamMat.opacity = 0.32 + Math.sin(t * (1.4 + tsunami * 3)) * (0.12 + tsunami * 0.18);
}

export function envMove(dt: number, t: number): void {
  clouds.forEach((c) => {
    c.position.x += c.userData.sp * dt;
    if (c.position.x > 90) c.position.x = -90;
  });
  // 船：持续绕岛航行
  const seaY = -0.4 + Math.sin(t * 1.3) * 0.05;
  const bt = t * 0.12;
  boat.position.set(
    Math.cos(bt) * (R() + 7) + islandGroup.position.x,
    seaY,
    Math.sin(bt) * (R() + 7) + islandGroup.position.z,
  );
  boat.rotation.y = -bt + Math.PI / 2;
  boat.rotation.z = Math.sin(t * 1.3) * 0.05;
  birds.forEach((b) => {
    const u = b.userData;
    const a = t * u.sp + u.ph;
    b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 2 + u.ph), Math.sin(a) * u.r);
    b.rotation.y = -a;
  });
}

/* 由 main 调用，遍历 animBits（在 materials 中维护） */
import { animBits } from './materials';
export function animUpdate(dt: number, t: number): void {
  for (const m of animBits) {
    const k = m.userData.anim as string;
    const ph = (m.userData.ph as number) || 0;
    if (k === 'spin') m.rotation.y += dt * 1.4;
    else if (k === 'bob') {
      if (m.userData.by === undefined) m.userData.by = m.position.y;
      m.position.y = m.userData.by + Math.sin(t * 2 + ph) * 0.18;
    } else if (k === 'blink') m.visible = Math.sin(t * 3 + ph) > -0.3;
  }
}

/* 初始建岛 */
buildIsland();

/* 镜头震动支持 */
export let shake = 0;
export function addShake(v: number): void {
  shake = Math.max(shake, v);
}
export function updateShake(dt: number): void {
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.2);
    const s = shake * 14;
    renderer.domElement.style.transform = 'translate(' + rand(-s, s) + 'px,' + rand(-s, s) + 'px)';
  } else {
    renderer.domElement.style.transform = '';
  }
}

export { clamp, lerp };
