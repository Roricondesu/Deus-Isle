import * as THREE from 'three';
import { S, landH, type CellEntry } from './state';
import { islandGroup } from './environment';
import { B, C } from './materials';

/* ================= 道路系统：建筑间自动连线，跨水搭桥，时代风格 ================= */

interface RoadStyle {
  color: number;          // 路面颜色
  width: number;          // 路面宽度
  opacity: number;
  emissive?: number;
  emissiveIntensity?: number;
  // 桥的风格
  bridgeDeck: number;     // 桥面颜色
  bridgeRail: number;     // 栏杆/桥拱颜色
  bridgePillar: number;  // 桥墩颜色
  bridgeEmissive?: number;
  bridgeEmissiveIntensity?: number;
}

const ROAD_STYLES: RoadStyle[] = [
  // 远古 - 木栈桥
  { color: 0x6a4a2a, width: 0.45, opacity: 0.95,
    bridgeDeck: 0x7a5a3a, bridgeRail: 0x6a4a2a, bridgePillar: 0x5a3a22 },
  // 古典 - 石拱桥
  { color: 0xc8b890, width: 0.48, opacity: 0.95,
    bridgeDeck: 0xd8c8a0, bridgeRail: 0xb8a890, bridgePillar: 0x9a8a70 },
  // 中世纪 - 木桁架桥
  { color: 0x8a7a6a, width: 0.52, opacity: 0.95,
    bridgeDeck: 0x8a6a4a, bridgeRail: 0x5a4a3a, bridgePillar: 0x4a3a2a },
  // 工业 - 钢桁桥
  { color: 0x9a5a3a, width: 0.56, opacity: 0.95,
    bridgeDeck: 0x6a5a4a, bridgeRail: 0x3a3a3a, bridgePillar: 0x2a2a2a },
  // 现代 - 混凝土桥
  { color: 0x3a3a3a, width: 0.62, opacity: 0.95,
    bridgeDeck: 0x6a6a6a, bridgeRail: 0x8a8a8a, bridgePillar: 0x5a5a5a },
  // 未来 - 磁悬浮桥
  { color: 0x35e0e6, width: 0.66, opacity: 0.9, emissive: 0x35e0e6, emissiveIntensity: 0.6,
    bridgeDeck: 0x4a8a9a, bridgeRail: 0x35e0e6, bridgePillar: 0x2a4a5a,
    bridgeEmissive: 0x35e0e6, bridgeEmissiveIntensity: 0.8 },
  // 太空 - 能量桥
  { color: 0x8aaaff, width: 0.7, opacity: 0.85, emissive: 0x8aaaff, emissiveIntensity: 0.8,
    bridgeDeck: 0x4a5a8a, bridgeRail: 0x8aaaff, bridgePillar: 0x3a4a7a,
    bridgeEmissive: 0x8aaaff, bridgeEmissiveIntensity: 1.2 },
];

let roadGroup: THREE.Group | null = null;

function buildingPositions(): { x: number; z: number; key: string }[] {
  const arr: { x: number; z: number; key: string }[] = [];
  S.cells.forEach((b: CellEntry, key: string) => {
    arr.push({ x: b.g.position.x, z: b.g.position.z, key });
  });
  return arr;
}

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

interface PathSeg {
  pos: THREE.Vector3;
  onWater: boolean;  // 是否在水面上（需要搭桥）
}

/** 采样路径，标记每段是否在水面上 */
function samplePath(
  ax: number, az: number,
  bx: number, bz: number,
  segs: number,
  seed: number,
): PathSeg[] {
  const out: PathSeg[] = [];
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-4) {
    const h = landH(ax, az);
    return [{ pos: new THREE.Vector3(ax, Math.max(h, 0) + 0.02, az), onWater: h < 0.05 }];
  }
  const nx = -dz / dist;
  const nz = dx / dist;
  const amp = dist * (0.08 + 0.07 * (0.5 + 0.5 * Math.sin(seed * 2.7)));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const cx = ax + dx * t;
    const cz = az + dz * t;
    const w1 = Math.sin(t * Math.PI) * amp;
    const w2 = Math.sin(t * Math.PI * 3 + seed) * amp * 0.25;
    const off = w1 + w2;
    const x = cx + nx * off;
    const z = cz + nz * off;
    const h = landH(x, z);
    const onWater = h < 0.05;
    // 陆地：贴地（+0.02）；水面：桥面（固定高度 +0.5）
    const y = onWater ? 0.5 : h + 0.02;
    out.push({ pos: new THREE.Vector3(x, y, z), onWater });
  }
  return out;
}

function smoothPath(raw: PathSeg[], samplesPerSeg: number = 4): PathSeg[] {
  if (raw.length < 3) return raw;
  const out: PathSeg[] = [];
  const positions = raw.map(p => p.pos);
  const p0 = positions[0].clone().multiplyScalar(2).sub(positions[1]);
  const pN = positions[positions.length - 1].clone().multiplyScalar(2).sub(positions[positions.length - 2]);
  const ext = [p0, ...positions, pN];
  for (let i = 1; i < ext.length - 2; i++) {
    const a = ext[i - 1], b = ext[i], c = ext[i + 1], d = ext[i + 2];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * b.x) + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3);
      const y = 0.5 * ((2 * b.y) + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3);
      const z = 0.5 * ((2 * b.z) + (-a.z + c.z) * t + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * t2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * t3);
      // onWater 状态沿用原始段（避免插值后状态混乱）
      const onWater = raw[i].onWater;
      out.push({ pos: new THREE.Vector3(x, y, z), onWater });
    }
  }
  out.push(raw[raw.length - 1]);
  return out;
}

/** 生成路面 ribbon（贴地段） */
function buildRibbon(path: PathSeg[], width: number, mat: THREE.Material): THREE.Mesh {
  const n = path.length;
  if (n < 2) return new THREE.Mesh();
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const p = path[i].pos;
    let tangent: THREE.Vector3;
    if (i === 0) tangent = path[1].pos.clone().sub(p);
    else if (i === n - 1) tangent = p.clone().sub(path[i - 1].pos);
    else tangent = path[i + 1].pos.clone().sub(path[i - 1].pos);
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
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  // 不剔除：路径细长，bounding sphere 易误判出视锥导致闪烁
  mesh.frustumCulled = false;
  return mesh;
}

/** 把连续 onWater 段提取为桥区间 [startIdx, endIdx] */
function extractBridges(path: PathSeg[]): [number, number][] {
  const bridges: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < path.length; i++) {
    if (path[i].onWater) {
      if (start === -1) start = i;
    } else {
      if (start !== -1) {
        // 桥至少 3 段才搭，否则太短不画
        if (i - start >= 3) bridges.push([start, i - 1]);
        start = -1;
      }
    }
  }
  if (start !== -1 && path.length - start >= 3) {
    bridges.push([start, path.length - 1]);
  }
  return bridges;
}

/** 搭一座桥：桥面 + 栏杆 + 桥墩 */
function buildBridge(
  path: PathSeg[],
  startIdx: number,
  endIdx: number,
  style: RoadStyle,
): THREE.Group {
  const g = new THREE.Group();
  const segs = path.slice(startIdx, endIdx + 1);
  const deckMat = new THREE.MeshStandardMaterial({
    color: style.bridgeDeck,
    roughness: 0.8,
    metalness: 0.1,
    emissive: style.bridgeEmissive ?? 0x000000,
    emissiveIntensity: style.bridgeEmissiveIntensity ?? 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: style.bridgeRail,
    roughness: 0.6,
    metalness: 0.2,
    emissive: style.bridgeEmissive ?? 0x000000,
    emissiveIntensity: (style.bridgeEmissiveIntensity ?? 0) * 1.5,
  });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: style.bridgePillar,
    roughness: 0.9,
    metalness: 0.05,
  });
  // 桥面（略宽于路面）
  const deckWidth = style.width + 0.15;
  const deck = buildRibbon(segs, deckWidth, deckMat);
  g.add(deck);
  // 双侧栏杆（细条）
  const railH = 0.18;
  for (const side of [-1, 1]) {
    const railGeo = new THREE.BufferGeometry();
    const rv: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < segs.length; i++) {
      const p = segs[i].pos;
      let tangent: THREE.Vector3;
      if (i === 0) tangent = segs[1].pos.clone().sub(p);
      else if (i === segs.length - 1) tangent = p.clone().sub(segs[i - 1].pos);
      else tangent = segs[i + 1].pos.clone().sub(segs[i - 1].pos);
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      tangent.y = 0;
      tangent.normalize();
      const s = new THREE.Vector3().crossVectors(up, tangent).normalize();
      const off = (deckWidth * 0.5) * side;
      rv.push(p.x + s.x * off, p.y + railH, p.z + s.z * off);
    }
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
    const rail = new THREE.Line(railGeo, new THREE.LineBasicMaterial({
      color: style.bridgeRail,
      transparent: true,
      opacity: 0.9,
    }));
    g.add(rail);
    // 栏杆立柱（每隔几段一根）
    for (let i = 0; i < segs.length; i += 3) {
      const p = segs[i].pos;
      let tangent: THREE.Vector3;
      if (i === 0) tangent = segs[1].pos.clone().sub(p);
      else if (i === segs.length - 1) tangent = p.clone().sub(segs[i - 1].pos);
      else tangent = segs[i + 1].pos.clone().sub(segs[i - 1].pos);
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      tangent.y = 0;
      tangent.normalize();
      const s = new THREE.Vector3().crossVectors(up, tangent).normalize();
      const off = (deckWidth * 0.5) * side;
      const px = p.x + s.x * off;
      const pz = p.z + s.z * off;
      const post = C(0.03, 0.04, railH, 6, style.bridgeRail, {
        x: px, y: p.y + railH * 0.5, z: pz, ol: false,
      });
      (post.material as THREE.Material) = railMat;
      g.add(post);
    }
  }
  // 桥墩（每隔几段从桥面伸到水面下）
  for (let i = 1; i < segs.length - 1; i += 4) {
    const p = segs[i].pos;
    const pillarH = p.y + 0.6; // 从桥面往上一点 + 往下到水底
    const pillar = C(0.06, 0.08, pillarH, 6, style.bridgePillar, {
      x: p.x, y: p.y - pillarH * 0.5 + 0.1, z: p.z, ol: false,
    });
    (pillar.material as THREE.Material) = pillarMat;
    g.add(pillar);
  }
  return g;
}

/** 重建所有道路（在建筑变更后调用） */
export function rebuildRoads(): void {
  if (!roadGroup) {
    roadGroup = new THREE.Group();
    islandGroup.add(roadGroup);
  }
  for (let i = roadGroup.children.length - 1; i >= 0; i--) {
    const child = roadGroup.children[i];
    child.traverse((m: any) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material && m.material.dispose) m.material.dispose();
    });
    roadGroup.remove(child);
  }
  const pts = buildingPositions();
  if (pts.length < 2) return;
  const edges = buildMST(pts);
  if (!edges.length) return;
  const style = ROAD_STYLES[Math.min(S.era, ROAD_STYLES.length - 1)];
  const roadMat = new THREE.MeshStandardMaterial({
    color: style.color,
    transparent: style.opacity < 1,
    opacity: style.opacity,
    roughness: 0.85,
    metalness: 0.05,
    emissive: style.emissive ?? 0x000000,
    emissiveIntensity: style.emissiveIntensity ?? 0,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (let ei = 0; ei < edges.length; ei++) {
    const [a, b] = edges[ei];
    const pa = pts[a], pb = pts[b];
    const dist = Math.hypot(pa.x - pb.x, pa.z - pb.z);
    const segs = Math.max(8, Math.ceil(dist / 0.9));
    const seed = (a * 1.37 + b * 2.91 + dist * 0.13) % 100;
    const raw = samplePath(pa.x, pa.z, pb.x, pb.z, segs, seed);
    const smooth = smoothPath(raw, 4);
    // 提取水段并切分：路面（陆地段） + 桥（水段）
    const bridges = extractBridges(smooth);
    // 把水段从路径中标记，buildRibbon 时跳过（避免路面 ribbon 跨水）
    // 简化：直接生成整条路面 ribbon（水段会在桥面下方，被桥覆盖）
    const ribbon = buildRibbon(smooth, style.width, roadMat);
    roadGroup.add(ribbon);
    // 搭桥
    for (const [s, e] of bridges) {
      const bridge = buildBridge(smooth, s, e, style);
      roadGroup.add(bridge);
    }
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

// 占位避免未使用警告
void B;
