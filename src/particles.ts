import * as THREE from 'three';
import { scene } from './environment';
import { R } from './state';
import { S } from './state';
import { rand } from './utils';

/* ================= 粒子系统（爆发 / 雨） ================= */
const PMAX = 1400;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3);
const pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({
  size: 0.32,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  r: number;
  g: number;
  b: number;
  grav: number;
}

const parts: Particle[] = [];
const _c = new THREE.Color();

export function burst(
  pos: THREE.Vector3,
  color: number,
  n: number = 24,
  sp: number = 4,
  life: number = 1,
  grav: number = -6,
  up: number = 3,
): void {
  _c.set(color);
  for (let i = 0; i < n; i++) {
    if (parts.length >= PMAX) parts.shift();
    const a = rand(Math.PI * 2);
    const e = rand(-1, 1);
    const v = rand(sp * 0.3, sp);
    parts.push({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: Math.cos(a) * v,
      vy: rand(up * 0.3, up) + e,
      vz: Math.sin(a) * v,
      life: 0,
      max: rand(life * 0.5, life),
      r: _c.r,
      g: _c.g,
      b: _c.b,
      grav,
    });
  }
}

export function updateParts(dt: number): void {
  let w = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.life += dt;
    if (p.life < p.max) {
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      parts[w++] = p;
    }
  }
  parts.length = w;
  for (let i = 0; i < PMAX; i++) {
    const on = i < w;
    pPos[i * 3] = on ? parts[i].x : 0;
    pPos[i * 3 + 1] = on ? parts[i].y : -999;
    pPos[i * 3 + 2] = on ? parts[i].z : 0;
    if (on) {
      const f = 1 - parts[i].life / parts[i].max;
      pCol[i * 3] = parts[i].r * f;
      pCol[i * 3 + 1] = parts[i].g * f;
      pCol[i * 3 + 2] = parts[i].b * f;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

/* ================= 雨 ================= */
const RAIN_N = 700;
const rainGeo = new THREE.BufferGeometry();
const rPos = new Float32Array(RAIN_N * 3);
rainGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
export const rainPts = new THREE.Points(
  rainGeo,
  new THREE.PointsMaterial({
    color: 0x9fc8ff,
    size: 0.22,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  }),
);
rainPts.visible = false;
rainPts.frustumCulled = false;
scene.add(rainPts);

interface RainDrop {
  x: number;
  y: number;
  z: number;
  sp: number;
}
const rainDrops: RainDrop[] = [];
for (let i = 0; i < RAIN_N; i++) rainDrops.push({ x: 0, y: 0, z: 0, sp: rand(16, 24) });

function resetDrop(d: RainDrop): void {
  const a = rand(Math.PI * 2);
  const r = rand(R() + 10);
  d.x = Math.cos(a) * r;
  d.z = Math.sin(a) * r;
  d.y = rand(8, 30);
}
rainDrops.forEach(resetDrop);

export function updateRain(dt: number): void {
  if (S.buffs.rain <= 0) return;
  for (const d of rainDrops) {
    d.y -= d.sp * dt;
    if (d.y < 0) resetDrop(d);
  }
  for (let i = 0; i < RAIN_N; i++) {
    rPos[i * 3] = rainDrops[i].x;
    rPos[i * 3 + 1] = rainDrops[i].y;
    rPos[i * 3 + 2] = rainDrops[i].z;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

/* ================= 烟囱（工业时代工厂烟雾） ================= */
export const smokeEmitters: THREE.Group[] = [];

function inScene(o: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = o;
  while (p.parent) p = p.parent;
  return p === scene;
}

let smokeAcc = 0;
export function smokeUpdate(dt: number): void {
  smokeAcc += dt;
  if (smokeAcc > 0.35) {
    smokeAcc = 0;
    for (const g of smokeEmitters) {
      if (!inScene(g)) continue;
      const pos = g.position.clone();
      pos.add(new THREE.Vector3(0.4, 1.5, 0.4));
      burst(pos, 0x8a8a8a, 1, 0.4, 2.2, 1.6, 0.6);
    }
  }
}
