import * as THREE from 'three';
import { S, landH, type CellEntry } from './state';
import { islandGroup } from './environment';

/* ================= 道路系统：建筑间自动连线，贴地，时代风格 ================= */

interface RoadStyle {
  color: number;
  width: number;
  opacity: number;
  emissive?: number; // 自发光颜色
  emissiveIntensity?: number;
}

const ROAD_STYLES: RoadStyle[] = [
  { color: 0x6a4a2a, width: 0.85, opacity: 0.95 },                  // 远古 - 土路
  { color: 0xc8b890, width: 0.9, opacity: 0.95 },                   // 古典 - 石板
  { color: 0x8a7a6a, width: 1.0, opacity: 0.95 },                   // 中世纪 - 鹅卵石
  { color: 0x9a5a3a, width: 1.1, opacity: 0.95 },                   // 工业 - 砖石
  { color: 0x3a3a3a, width: 1.3, opacity: 0.95 },                   // 现代 - 沥青
  { color: 0x35e0e6, width: 1.4, opacity: 0.9, emissive: 0x35e0e6, emissiveIntensity: 0.6 }, // 未来 - 发光
  { color: 0x8aaaff, width: 1.5, opacity: 0.85, emissive: 0x8aaaff, emissiveIntensity: 0.8 }, // 太空 - 能量
];

let roadGroup: THREE.Group | null = null;

/** 收集所有建筑世界坐标 */
function buildingPositions(): { x: number; z: number; key: string }[] {
  const arr: { x: number; z: number; key: string }[] = [];
  S.cells.forEach((b: CellEntry, key: string) => {
    arr.push({ x: b.g.position.x, z: b.g.position.z, key });
  });
  return arr;
}

/** Prim 最小生成树：返回建筑间的边列表 */
function buildMST(pts: { x: number; z: number; key: string }[]): [number, number][] {
  const edges: [number, number][] = [];
  if (pts.length < 2) return edges;
  const n = pts.length;
  const inTree = new Array(n).fill(false);
  const minDist = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  minDist[0] = 0;
  for (let i = 0; i < n; i++) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!inTree[v] && (u === -1 || minDist[v] < minDist[u])) u = v;
    }
    if (u === -1) break;
    inTree[u] = true;
    if (parent[u] !== -1) edges.push([parent[u], u]);
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const dx = pts[u].x - pts[v].x;
      const dz = pts[u].z - pts[v].z;
      const d = dx * dx + dz * dz;
      if (d < minDist[v]) {
        minDist[v] = d;
        parent[v] = u;
      }
    }
  }
  return edges;
}

/** 沿两点之间采样，贴地（landH < 0 时夹到水面附近） */
function samplePath(
  ax: number, az: number,
  bx: number, bz: number,
  segs: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    let h = landH(x, z);
    if (h < 0.05) h = -0.35; // 水面以上一点（桥面）
    pts.push(new THREE.Vector3(x, h + 0.06, z));
  }
  return pts;
}

/** Catmull-Rom 平滑：从折线生成更密的平滑曲线 */
function smoothPath(raw: THREE.Vector3[], samplesPerSeg: number = 6): THREE.Vector3[] {
  if (raw.length < 3) return raw;
  const out: THREE.Vector3[] = [];
  // 端点延伸虚拟点
  const p0 = raw[0].clone().multiplyScalar(2).sub(raw[1]);
  const pN = raw[raw.length - 1].clone().multiplyScalar(2).sub(raw[raw.length - 2]);
  const ext = [p0, ...raw, pN];
  for (let i = 1; i < ext.length - 2; i++) {
    const a = ext[i - 1], b = ext[i], c = ext[i + 1], d = ext[i + 2];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * b.x) + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3);
      const y = 0.5 * ((2 * b.y) + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3);
      const z = 0.5 * ((2 * b.z) + (-a.z + c.z) * t + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * t2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * t3);
      out.push(new THREE.Vector3(x, y, z));
    }
  }
  out.push(raw[raw.length - 1].clone());
  return out;
}

/** 根据平滑路径生成 ribbon 网格 */
function buildRibbon(path: THREE.Vector3[], width: number, mat: THREE.Material): THREE.Mesh {
  const n = path.length;
  if (n < 2) return new THREE.Mesh();
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const p = path[i];
    let tangent: THREE.Vector3;
    if (i === 0) tangent = path[1].clone().sub(p);
    else if (i === n - 1) tangent = p.clone().sub(path[i - 1]);
    else tangent = path[i + 1].clone().sub(path[i - 1]);
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
    tangent.y = 0;
    tangent.normalize();
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
    const half = width * 0.5;
    verts.push(p.x + side.x * half, p.y, p.z + side.z * half);
    verts.push(p.x - side.x * half, p.y, p.z - side.z * half);
    const v = i / (n - 1);
    uvs.push(0, v * 4);
    uvs.push(1, v * 4);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** 重建所有道路（在建筑变更后调用） */
export function rebuildRoads(): void {
  if (!roadGroup) {
    roadGroup = new THREE.Group();
    islandGroup.add(roadGroup);
  }
  // 清空旧道路
  for (let i = roadGroup.children.length - 1; i >= 0; i--) {
    const m = roadGroup.children[i] as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    roadGroup.remove(m);
  }
  const pts = buildingPositions();
  if (pts.length < 2) return;
  const edges = buildMST(pts);
  if (!edges.length) return;
  const style = ROAD_STYLES[Math.min(S.era, ROAD_STYLES.length - 1)];
  const mat = new THREE.MeshStandardMaterial({
    color: style.color,
    transparent: style.opacity < 1,
    opacity: style.opacity,
    roughness: 0.85,
    metalness: 0.05,
    emissive: style.emissive ?? 0x000000,
    emissiveIntensity: style.emissiveIntensity ?? 0,
    depthWrite: false,
  });
  for (const [a, b] of edges) {
    const pa = pts[a], pb = pts[b];
    const dist = Math.hypot(pa.x - pb.x, pa.z - pb.z);
    const segs = Math.max(6, Math.ceil(dist / 1.2));
    const raw = samplePath(pa.x, pa.z, pb.x, pb.z, segs);
    const smooth = smoothPath(raw, 5);
    const ribbon = buildRibbon(smooth, style.width, mat);
    roadGroup.add(ribbon);
  }
}

/* 延迟重建（防抖）：批量操作时只重建一次 */
let rebuildScheduled = false;
export function scheduleRebuildRoads(): void {
  if (rebuildScheduled) return;
  rebuildScheduled = true;
  setTimeout(() => {
    rebuildScheduled = false;
    rebuildRoads();
  }, 50);
}
