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
} from './materials';
import { ERAS } from './constants';
import { $, V3, rand, randi, smooth, clamp, lerp } from './utils';
import {
  S,
  R,
  PATCHES,
  landH,
  outlineR,
  patchR,
  hnoise,
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
camera.position.set(30, 26, 34);

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
  const colors = new Float32Array(n * 3);
  const zones = new Uint8Array(n);
  const jit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const h = landH(pos.getX(i) + cx, pos.getZ(i) + cz);
    pos.setY(i, h < 0 ? -0.5 : h);
    zones[i] = h < 0.55 ? 0 : h > 1.85 ? 2 : 1; // 0 沙滩 1 草地 2 岩石
    jit[i] = rand(0.88, 1.06);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
): THREE.Mesh {
  const N = 64;
  const verts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    verts.push(Math.cos(a) * rTop(a), yTop, Math.sin(a) * rTop(a));
    verts.push(Math.cos(a) * rBot(a), yBot, Math.sin(a) * rBot(a));
  }
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  // 底面封口（避免从下方看到裙摆内部空腔）
  if (cap) {
    const base = verts.length / 3;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      verts.push(Math.cos(a) * rBot(a), yBot, Math.sin(a) * rBot(a));
    }
    for (let i = 0; i < N; i++) {
      // 顺时针缠绕使法线朝下
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
      col.setXYZ(i, _zc[z].r * j, _zc[z].g * j, _zc[z].b * j);
    }
    col.needsUpdate = true;
  }
}

let natureGroup: THREE.Group | null = null;

function scatterNature(): void {
  if (natureGroup) islandGroup.remove(natureGroup);
  natureGroup = G();
  islandGroup.add(natureGroup);
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
      // 树
      const t = G();
      const s = rand(0.7, 1.25);
      t.add(C(0.09, 0.13, 0.7, 6, 0x7a5a38, { y: 0.35, ol: false }));
      if (Math.random() < 0.5) {
        const leaf = _m(new THREE.IcosahedronGeometry(0.55, 0), 0xffffff, { y: 1.0, ol: false });
        leaf.material = leafMat;
        t.add(leaf);
      } else {
        const leaf = CO(0.55, 1.2, 7, 0xffffff, { y: 1.05, ol: false });
        leaf.material = leafMat;
        t.add(leaf);
      }
      t.position.set(x, h - 0.05, z);
      t.scale.setScalar(s);
      t.rotation.y = rand(6.28);
      natureGroup.add(t);
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
    const fo2 = ringStrip(
      (a) => patchR(p, a) + 0.1,
      (a) => patchR(p, a) + 1.4,
      -0.05,
      -0.05,
      foamMat,
      false,
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
  $('clock').textContent = dayF > 0.6 ? '☀️' : duskF > 0.5 ? '🌇' : '🌙';
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
  const p = waterGeo.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 3) {
    p[i + 2] = Math.sin(p[i] * 0.14 + t * 1.1) * 0.32 + Math.cos(p[i + 1] * 0.12 + t * 0.9) * 0.32;
  }
  waterGeo.attributes.position.needsUpdate = true;
  foamMeshes.forEach((f) => f.scale.setScalar(1 + Math.sin(t * 1.4) * 0.02));
  foamMat.opacity = 0.32 + Math.sin(t * 1.4) * 0.12;
}

export function envMove(dt: number, t: number): void {
  clouds.forEach((c) => {
    c.position.x += c.userData.sp * dt;
    if (c.position.x > 90) c.position.x = -90;
  });
  const bt = t * 0.12;
  boat.position.set(Math.cos(bt) * (R() + 7), -1.9 + Math.sin(t * 1.3) * 0.15, Math.sin(bt) * (R() + 7));
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
