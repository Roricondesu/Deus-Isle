import * as THREE from 'three';
import { rand } from './utils';

/* ================= 卡通材质 & 部件助手 ================= */
/* 渐变贴图（卡通分层着色） */
export const gradTex = new THREE.DataTexture(
  new Uint8Array([90, 90, 90, 255, 165, 165, 165, 255, 225, 225, 225, 255, 255, 255, 255, 255]),
  4,
  1,
  THREE.RGBAFormat,
);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
gradTex.needsUpdate = true;

/* Toon 材质缓存（按颜色复用） */
const MATS = new Map<number, THREE.MeshToonMaterial>();
export function toon(color: number): THREE.MeshToonMaterial {
  let m = MATS.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradTex });
    MATS.set(color, m);
  }
  return m;
}

/* Basic 材质缓存 */
const BASIC = new Map<string, THREE.MeshBasicMaterial>();
export function basic(color: number, op: number = 1): THREE.MeshBasicMaterial {
  const k = color + '|' + op;
  let m = BASIC.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: op < 1, opacity: op });
    BASIC.set(k, m);
  }
  return m;
}

/* 窗户材质（昼夜变色，由 environment 模块修改） */
export const WIN_MAT = new THREE.MeshBasicMaterial({ color: 0x3a4a5a });
/* 描边材质 */
export const OL_MAT = new THREE.MeshBasicMaterial({ color: 0x14141c, side: THREE.BackSide });

/* 全局共享材质：地形 / 草 / 石 / 浪 */
export const terrainMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex });
export const rockMat = new THREE.MeshToonMaterial({ color: 0x8a7f6a, gradientMap: gradTex });
export const leafMat = new THREE.MeshToonMaterial({ color: 0x4f9e3f, gradientMap: gradTex });
export const foamMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.45,
  side: THREE.DoubleSide,
  depthWrite: false,
});

export function addOL(mesh: THREE.Mesh, s: number = 1.05): void {
  const o = new THREE.Mesh(mesh.geometry, OL_MAT);
  o.scale.setScalar(s);
  o.raycast = () => {};
  mesh.add(o);
}

/* 动画注册表 & 幽灵构建标志 */
export const animBits: THREE.Mesh[] = [];
export let GHOSTING = false;
export function setGhosting(v: boolean): void {
  GHOSTING = v;
}

export interface MeshOpts {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  s?: number | [number, number, number];
  basic?: boolean;
  op?: number;
  ol?: boolean;
  ols?: number;
  anim?: 'spin' | 'bob' | 'blink';
  seg?: number;
}

/* 部件助手 _m：创建网格并放置 */
export function _m(
  geo: THREE.BufferGeometry,
  color: number,
  o: MeshOpts = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, o.basic ? basic(color, o.op ?? 1) : toon(color));
  mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.rx) mesh.rotation.x = o.rx;
  if (o.ry) mesh.rotation.y = o.ry;
  if (o.rz) mesh.rotation.z = o.rz;
  if (o.s) {
    const arr = o.s as number | [number, number, number];
    if (Array.isArray(arr)) mesh.scale.set(arr[0], arr[1], arr[2]);
    else mesh.scale.set(arr, arr, arr);
  }
  if (!o.basic) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (o.ol !== false) addOL(mesh, o.ols);
  }
  if (o.anim && !GHOSTING) {
    mesh.userData.anim = o.anim;
    mesh.userData.ph = rand(6.28);
    animBits.push(mesh);
  }
  return mesh;
}

export const B = (w: number, h: number, d: number, c: number, o: MeshOpts = {}): THREE.Mesh =>
  _m(new THREE.BoxGeometry(w, h, d), c, o);

export const C = (
  rt: number,
  rb: number,
  h: number,
  seg: number,
  c: number,
  o: MeshOpts = {},
): THREE.Mesh => _m(new THREE.CylinderGeometry(rt, rb, h, seg), c, o);

export const CO = (
  r: number,
  h: number,
  seg: number,
  c: number,
  o: MeshOpts = {},
): THREE.Mesh => _m(new THREE.ConeGeometry(r, h, seg), c, o);

export const SP = (r: number, c: number, o: MeshOpts = {}): THREE.Mesh =>
  _m(new THREE.SphereGeometry(r, o.seg || 10, o.seg || 8), c, o);

export const G = (): THREE.Group => new THREE.Group();

/* 在 group 上添加一个窗户小贴片 */
export function win(
  g: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number = 0.16,
  h: number = 0.16,
  ry: number = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), WIN_MAT);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  g.add(m);
  return m;
}
