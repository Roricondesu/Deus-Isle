import * as THREE from 'three';
import { V3, rand, randi, clamp, tw, easeOutBack } from './utils';
import { CELL, CATALOG } from './constants';
import {
  S,
  cellKey,
  cellY,
  walkable,
  maxCell,
  canAfford,
  costOf,
  costText,
  pay,
  type CellEntry,
} from './state';
import { scene, camera, islandGroup } from './environment';
import { G, setGhosting } from './materials';
import { makeBuilding } from './buildings';
import { burst } from './particles';
import { sfx } from './audio';
import { toast, refreshHUD, renderDock, floatText } from './hud';
import { IC, icon } from './icon';
import { confirmExpandAt, cancelExpandMode, isValidExpandPos } from './game';
import { scheduleRebuildRoads } from './roads';
import { assignJobs } from './citizens';

/* ================= 建造高亮 & 幽灵预览 ================= */
export const highlight = new THREE.Mesh(
  new THREE.PlaneGeometry(CELL * 0.94, CELL * 0.94),
  new THREE.MeshBasicMaterial({
    color: 0x7ad0ff,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  }),
);
highlight.rotation.x = -Math.PI / 2;
highlight.position.y = 0.06;
highlight.visible = false;
scene.add(highlight);

const ndc = new THREE.Vector2();
let pointerOn = false;
export let hoverCell: { x: number; z: number } | null = null;
export let hoverValid = false;
let downPos: [number, number] | null = null;
const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(V3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

let ghost: THREE.Group | null = null;
let ghostType: string | null = null;
const GHOST_OK = new THREE.MeshBasicMaterial({
  color: 0x7affc0,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});
const GHOST_BAD = new THREE.MeshBasicMaterial({
  color: 0xff6a6a,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});

/* ================= 扩岛位置预览（跟随鼠标的圆盘） ================= */
const PATCH_PREVIEW_R = 5;
const patchPreview = new THREE.Mesh(
  new THREE.CircleGeometry(1, 40),
  new THREE.MeshBasicMaterial({
    color: 0xffd76a,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
patchPreview.rotation.x = -Math.PI / 2;
patchPreview.visible = false;
scene.add(patchPreview);
let expandHitValid = false;
let expandHitPos: { x: number; z: number } | null = null;

function updatePatchPreview(): void {
  expandHitValid = false;
  expandHitPos = null;
  if (!S.expandMode) {
    patchPreview.visible = false;
    return;
  }
  _ray.setFromCamera(ndc, camera);
  if (!_ray.ray.intersectPlane(_plane, _hit)) {
    patchPreview.visible = false;
    return;
  }
  const valid = isValidExpandPos(_hit.x, _hit.z);
  expandHitValid = valid;
  expandHitPos = { x: _hit.x, z: _hit.z };
  patchPreview.visible = true;
  patchPreview.position.set(_hit.x, 0.06, _hit.z);
  patchPreview.scale.setScalar(PATCH_PREVIEW_R);
  const mat = patchPreview.material as THREE.MeshBasicMaterial;
  if (valid) {
    mat.color.setHex(0xffd76a);
    mat.opacity = 0.55;
  } else {
    mat.color.setHex(0xff6a6a);
    mat.opacity = 0.35;
  }
}

function refreshGhost(): void {
  if (S.sel === ghostType) return;
  ghostType = S.sel;
  if (ghost) {
    scene.remove(ghost);
    ghost = null;
  }
  if (S.sel) {
    setGhosting(true);
    ghost = makeBuilding(S.sel, S.era);
    setGhosting(false);
    ghost.traverse((m: any) => {
      if (m.isMesh) {
        m.material = GHOST_OK;
        m.castShadow = false;
      }
    });
    scene.add(ghost);
  }
}

export function updateHover(): void {
  refreshGhost();
  updatePatchPreview();
  if (S.expandMode) {
    // 扩岛模式下不显示建造高亮
    highlight.visible = false;
    hoverCell = null;
    if (ghost) ghost.visible = false;
    return;
  }
  if (!pointerOn || S.transitioning || S.over) {
    highlight.visible = false;
    hoverCell = null;
    if (ghost) ghost.visible = false;
    return;
  }
  _ray.setFromCamera(ndc, camera);
  if (!_ray.ray.intersectPlane(_plane, _hit)) {
    highlight.visible = false;
    hoverCell = null;
    if (ghost) ghost.visible = false;
    return;
  }
  const cx = Math.round(_hit.x / CELL);
  const cz = Math.round(_hit.z / CELL);
  if (Math.abs(cx) > maxCell() || Math.abs(cz) > maxCell()) {
    highlight.visible = false;
    hoverCell = null;
    if (ghost) ghost.visible = false;
    return;
  }
  hoverCell = { x: cx, z: cz };
  const def = CATALOG.find((d) => d.t === S.sel);
  hoverValid =
    !!def && walkable(cx, cz) && !S.cells.has(cellKey(cx, cz)) && canAfford(costOf(def));
  if (ghost) {
    ghost.visible = !!S.sel;
    ghost.position.set(cx * CELL, cellY(cx, cz), cz * CELL);
    const mat = hoverValid ? GHOST_OK : GHOST_BAD;
    ghost.traverse((m: any) => {
      if (m.isMesh) m.material = mat;
    });
  }
  highlight.position.set(cx * CELL, cellY(cx, cz) + 0.06, cz * CELL);
  highlight.visible = !!S.sel && hoverValid;
}

/* ================= 指针事件 ================= */
export function setupInteraction(): void {
  const canvas = rendererCanvas();
  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    pointerOn = true;
  });
  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    downPos = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
    downPos = null;
    if (moved > 6) return;
    if (S.transitioning || S.over) return;
    if (S.expandMode) {
      if (expandHitValid && expandHitPos) confirmExpandAt(expandHitPos.x, expandHitPos.z);
      else cancelExpandMode();
      return;
    }
    if (S.sel && hoverCell && hoverValid) tryBuild(hoverCell.x, hoverCell.z);
  });
  // ESC 取消扩岛模式
  addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && S.expandMode) cancelExpandMode();
  });
}

function rendererCanvas(): HTMLElement {
  // environment.ts 暴露 renderer，但为简化直接查询
  return document.querySelector('#stage canvas') as HTMLElement;
}

/* ================= 建造 ================= */
export function tryBuild(x: number, z: number): void {
  const def = CATALOG.find((d) => d.t === S.sel);
  if (!def) return;
  if (def.t === 'wonder' && S.wonders[S.era]) {
    toast('本时代的奇观已建成', IC.wonder);
    return;
  }
  const cost = costOf(def);
  if (!canAfford(cost)) {
    sfx.error();
    toast('资源不足！需要 ' + costText(cost), IC.warning);
    return;
  }
  pay(cost);
  placeBuilding(def.t, S.era, x, z);
  sfx.build();
  if (def.t === 'wonder') {
    S.wonders[S.era] = true;
    toast('奇观落成！' + def.names[S.era] + ' 将永载史册', IC.wonder);
    burst(V3(x * CELL, 2, z * CELL), 0xffd76a, 60, 7, 1.6, -3, 6);
  }
  refreshHUD();
  renderDock();
}

export function placeBuilding(
  t: string,
  e: number,
  x: number,
  z: number,
  relic: boolean = false,
  slow: boolean = false,
  assign: boolean = true,
): THREE.Group {
  const g = makeBuilding(t, e);
  g.position.set(x * CELL, cellY(x, z) - 0.06, z * CELL);
  g.rotation.y = randi(0, 3) * Math.PI / 2;
  // 地基平台，贴合坡地
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.14, 0.18, 10),
    new THREE.MeshToonMaterial({ color: 0xb8b0a0 }),
  );
  base.position.y = -0.02;
  g.add(base);
  g.scale.setScalar(0.01);
  islandGroup.add(g);
  tw(slow ? 2.2 : 0.7, (k) => g.scale.setScalar(Math.max(0.01, k)), slow ? (k) => k : easeOutBack);
  burst(V3(x * CELL, cellY(x, z) + 0.4, z * CELL), 0xcfc0a0, 16, 3, 0.8, -5, 3);
  const entry: CellEntry = { t, era: e, relic, g };
  S.cells.set(cellKey(x, z), entry);
  scheduleRebuildRoads();
  if (assign) assignJobs();
  return g;
}
