import * as THREE from 'three';

/* ================= 通用工具函数 ================= */
export const rand = (a: number = 1, b?: number): number =>
  b === undefined ? Math.random() * a : a + Math.random() * (b - a);

export const randi = (a: number, b: number): number => Math.floor(rand(a, b + 1));

export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const V3 = (x: number = 0, y: number = 0, z: number = 0): THREE.Vector3 =>
  new THREE.Vector3(x, y, z);

export const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

/* ================= 补间动画 ================= */
interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  ease: (t: number) => number;
  done?: () => void;
}

export const tweens: Tween[] = [];

export function tw(
  dur: number,
  fn: (k: number) => void,
  ease: (t: number) => number = (t) => t,
  done?: () => void,
): void {
  tweens.push({ t: 0, dur, fn, ease, done });
}

export const easeOutBack = (t: number): number => {
  const c = 1.7;
  t -= 1;
  return 1 + t * t * ((c + 1) * t + c);
};

export const easeIn = (t: number): number => t * t * t;

export function updateTweens(dt: number): void {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i];
    w.t += dt;
    const k = clamp(w.t / w.dur, 0, 1);
    w.fn(w.ease(k));
    if (k >= 1) {
      tweens.splice(i, 1);
      w.done && w.done();
    }
  }
}

/* 用于地形高度过渡的平滑函数（也供 environment 使用） */
export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
