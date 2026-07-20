import * as THREE from 'three';
import { B, C, CO, SP, G, _m, win, animBits, GHOSTING, MeshOpts } from './materials';
import { BC } from './constants';
import { rand, randi } from './utils';
import { smokeEmitters } from './particles';

/* ================= 建筑工厂：7 时代 × 7 类 ================= */
export function makeBuilding(type: string, e: number): THREE.Group {
  const g = G();
  const c = BC[e];
  switch (type) {
    case 'house': {
      if (e === 0) {
        g.add(C(0.55, 0.65, 0.7, 7, c.wall, { y: 0.35 }));
        g.add(CO(0.8, 0.65, 7, c.roof, { y: 0.95 }));
        g.add(B(0.22, 0.4, 0.06, 0x4a3418, { y: 0.2, z: 0.6, ol: false }));
      } else if (e === 1) {
        g.add(B(0.95, 0.62, 0.95, c.wall, { y: 0.31 }));
        g.add(B(1.05, 0.14, 1.05, c.roof, { y: 0.68 }));
        g.add(B(0.5, 0.3, 0.5, c.wall, { y: 0.85, x: -0.2 }));
        win(g, 0.2, 0.35, 0.49);
      } else if (e === 2) {
        g.add(B(0.95, 0.55, 0.85, c.wall, { y: 0.28 }));
        g.add(CO(0.8, 0.5, 4, c.roof, { y: 0.78, ry: Math.PI / 4 }));
        g.add(SP(0.09, c.acc, { y: 0.52, z: 0.46, basic: true }));
        win(g, -0.25, 0.3, 0.44);
      } else if (e === 3) {
        g.add(B(1, 0.75, 0.9, c.wall, { y: 0.38 }));
        g.add(CO(0.75, 0.4, 4, c.roof, { y: 0.95, ry: Math.PI / 4 }));
        g.add(B(0.16, 0.5, 0.16, 0x6a6a6a, { x: 0.32, y: 1.1, ol: false }));
        win(g, 0, 0.4, 0.46);
        win(g, -0.3, 0.4, 0.46);
      } else if (e === 4) {
        g.add(B(1, 1.5, 0.9, c.wall, { y: 0.75 }));
        g.add(B(1.06, 0.1, 0.96, c.roof, { y: 1.53 }));
        for (let f = 0; f < 3; f++)
          for (let wI = -1; wI <= 1; wI++) win(g, wI * 0.3, 0.4 + f * 0.45, 0.46);
        g.add(B(0.3, 0.15, 0.2, 0x9aa, { y: 1.62, x: 0.2, ol: false }));
      } else if (e === 5) {
        g.add(B(0.95, 1.1, 0.95, c.wall, { y: 0.55 }));
        g.add(B(1.01, 0.09, 1.01, c.acc, { y: 0.6, basic: true, op: 0.85 }));
        g.add(CO(0.7, 0.5, 6, c.roof, { y: 1.32 }));
        win(g, 0, 0.85, 0.49);
        win(g, 0, 0.3, 0.49);
      } else {
        const pod = SP(0.55, c.wall, { y: 1.0, s: [1, 0.85, 1] });
        pod.userData.anim = 'bob';
        pod.userData.ph = rand(6.28);
        if (!GHOSTING) animBits.push(pod);
        g.add(pod);
        g.add(
          _m(new THREE.TorusGeometry(0.62, 0.06, 8, 20), c.acc, {
            y: 0.55,
            rx: Math.PI / 2,
            basic: true,
            op: 0.9,
            anim: 'spin',
          }),
        );
        win(g, 0, 1.05, 0.5);
        g.add(B(0.5, 0.06, 0.5, c.roof, { y: 0.1 }));
      }
      break;
    }
    case 'farm': {
      g.add(B(1.9, 0.1, 1.9, e < 3 ? 0x8a6a42 : 0x7a8a5a, { y: 0.05, ol: false }));
      const cropC = [0x9edb6a, 0xd8c860, 0x6ad88a, 0xd8b84a, 0x8ad86a, 0x50e0b0, 0x60e0d8][e];
      for (let i = -1; i <= 1; i++) g.add(B(1.6, 0.16, 0.3, cropC, { y: 0.16, z: i * 0.55, ol: false }));
      if (e === 1) {
        g.add(B(1.9, 0.06, 0.3, 0x3aa5c9, { y: 0.08, x: 0, basic: true, op: 0.8 }));
      }
      if (e === 2) {
        g.add(B(1.9, 0.05, 1.9, 0x4ab8d8, { y: 0.02, basic: true, op: 0.5 }));
        g.add(B(0.3, 0.5, 0.3, c.wall, { x: 0.7, y: 0.35, z: -0.7 }));
        g.add(CO(0.35, 0.25, 4, c.roof, { x: 0.7, y: 0.7, z: -0.7, ry: Math.PI / 4 }));
      }
      if (e === 3) {
        g.add(C(0.25, 0.3, 1, 8, 0xb8b8b8, { x: 0.72, y: 0.6, z: -0.72 }));
        g.add(CO(0.3, 0.25, 8, 0x8a4a3a, { x: 0.72, y: 1.2, z: -0.72 }));
      }
      if (e === 4) {
        g.add(B(0.55, 0.5, 0.45, 0xc03a2a, { x: 0.65, y: 0.35, z: -0.7 }));
        g.add(CO(0.45, 0.3, 4, 0xe8e0d0, { x: 0.65, y: 0.72, z: -0.7, ry: Math.PI / 4 }));
      }
      if (e === 5) {
        for (let f = 0; f < 3; f++) {
          g.add(B(1.1, 0.06, 1.1, 0xd8f0f8, { y: 0.35 + f * 0.42, basic: true, op: 0.4 }));
          g.add(B(1, 0.14, 1, 0x50e0b0, { y: 0.28 + f * 0.42, basic: true, op: 0.75 }));
        }
      }
      if (e === 6) {
        g.add(
          _m(new THREE.SphereGeometry(0.95, 14, 10, 0, 6.3, 0, 1.6), 0x60e0d8, {
            y: 0.2,
            basic: true,
            op: 0.3,
            anim: 'spin',
          }),
        );
        g.add(B(1.2, 0.3, 1.2, 0x3a8a80, { y: 0.3 }));
      }
      break;
    }
    case 'wood': {
      for (let i = 0; i < 3; i++)
        g.add(C(0.14, 0.14, 1.1, 7, 0x8a6238, { z: -0.5 + i * 0.35, y: 0.16, rx: Math.PI / 2, ry: rand(0.4) }));
      if (e === 0) {
        g.add(B(0.5, 0.3, 0.4, 0x9a9a9a, { x: 0.5, y: 0.15, z: 0.4 }));
      } else if (e === 1) {
        g.add(B(0.7, 0.5, 0.6, c.wall, { x: 0.45, y: 0.25, z: 0.45 }));
      } else if (e === 2) {
        g.add(B(0.7, 0.5, 0.6, c.wall, { x: 0.45, y: 0.25, z: 0.45 }));
        g.add(CO(0.55, 0.35, 4, c.roof, { x: 0.45, y: 0.68, z: 0.45, ry: Math.PI / 4 }));
      } else if (e === 3) {
        g.add(B(0.8, 0.7, 0.7, c.wall, { x: 0.4, y: 0.35, z: 0.4 }));
        g.add(B(0.14, 0.7, 0.14, 0x5a5a5a, { x: 0.68, y: 1, z: 0.68 }));
        smokeEmitters.push(g);
        win(g, 0.4, 0.4, 0.76);
      } else if (e === 4) {
        g.add(B(0.9, 0.6, 0.7, 0xb8c0c8, { x: 0.35, y: 0.3, z: 0.35 }));
        win(g, 0.35, 0.35, 0.71);
      } else {
        g.add(B(0.8, 0.9, 0.8, c.wall, { x: 0.35, y: 0.45, z: 0.35 }));
        g.add(B(0.86, 0.08, 0.86, c.acc, { x: 0.35, y: 0.5, z: 0.35, basic: true, op: 0.85 }));
        win(g, 0.35, 0.7, 0.76);
      }
      break;
    }
    case 'market': {
      if (e === 0) {
        g.add(C(0.05, 0.06, 1, 6, 0x7a5a38, { x: -0.5, y: 0.5, z: -0.4, ol: false }));
        g.add(C(0.05, 0.06, 1, 6, 0x7a5a38, { x: 0.5, y: 0.5, z: -0.4, ol: false }));
        g.add(B(1.3, 0.08, 0.9, 0xd8b86a, { y: 1.02, z: -0.1 }));
        g.add(B(0.8, 0.35, 0.5, 0xb08a5a, { y: 0.25, z: 0.2 }));
      } else if (e === 1) {
        g.add(CO(0.9, 1, 6, 0xd85a4a, { y: 0.8 }));
        g.add(C(0.5, 0.55, 0.5, 8, c.wall, { y: 0.25 }));
      } else if (e === 2) {
        g.add(B(1, 0.6, 0.8, c.wall, { y: 0.3 }));
        g.add(CO(0.85, 0.45, 4, c.roof, { y: 0.8, ry: Math.PI / 4 }));
        g.add(SP(0.09, 0xd43a2a, { x: -0.3, y: 0.5, z: 0.44, basic: true }));
        g.add(SP(0.09, 0xd43a2a, { x: 0.3, y: 0.5, z: 0.44, basic: true }));
        win(g, 0, 0.32, 0.42);
      } else if (e === 3) {
        g.add(B(1.1, 0.8, 0.8, c.wall, { y: 0.4 }));
        g.add(B(1.16, 0.12, 0.86, 0xd8d0c0, { y: 0.84 }));
        g.add(B(1, 0.3, 0.06, 0x2a5a8a, { y: 0.62, z: 0.41 }));
        win(g, -0.25, 0.3, 0.41);
        win(g, 0.25, 0.3, 0.41);
      } else if (e === 4) {
        g.add(B(1.2, 1, 0.9, 0xc8d8e8, { y: 0.5 }));
        g.add(B(1.26, 0.14, 0.96, 0x3a5a7a, { y: 1.04 }));
        g.add(B(1.1, 0.34, 0.06, 0xff8a3c, { y: 0.8, z: 0.46, basic: true }));
        win(g, 0, 0.35, 0.46);
      } else {
        g.add(B(1, 1, 0.9, c.wall, { y: 0.5 }));
        g.add(B(1.06, 0.1, 0.96, c.acc, { y: 0.6, basic: true, op: 0.8 }));
        g.add(
          _m(new THREE.TorusGeometry(0.4, 0.05, 8, 18), c.acc, {
            y: 1.35,
            basic: true,
            op: 0.9,
            anim: 'spin',
          }),
        );
        win(g, 0, 0.28, 0.46);
      }
      break;
    }
    case 'temple': {
      if (e === 0) {
        g.add(C(0.9, 1, 0.18, 9, 0x9a9a9a, { y: 0.09 }));
        g.add(B(0.3, 1.3, 0.3, 0x8a6238, { y: 0.83 }));
        g.add(B(0.7, 0.22, 0.24, 0xa07548, { y: 1.25 }));
        g.add(B(0.24, 0.5, 0.22, 0x6a4a2a, { y: 1.65 }));
      } else if (e === 1) {
        g.add(B(1.5, 0.2, 1.5, 0xd8c89a, { y: 0.1 }));
        g.add(CO(0.28, 1.6, 4, 0xe0d0a0, { y: 1 }));
        g.add(C(0.12, 0.14, 0.9, 6, 0xe0d0a0, { x: -0.55, y: 0.65, z: 0.5 }));
        g.add(C(0.12, 0.14, 0.9, 6, 0xe0d0a0, { x: 0.55, y: 0.65, z: 0.5 }));
      } else if (e === 2) {
        g.add(B(0.9, 0.5, 0.8, c.wall, { y: 0.25 }));
        g.add(CO(0.75, 0.4, 4, c.roof, { y: 0.68, ry: Math.PI / 4 }));
        g.add(B(0.6, 0.35, 0.5, c.wall, { y: 0.78 }));
        g.add(CO(0.5, 0.3, 4, c.roof, { y: 1.08, ry: Math.PI / 4 }));
        g.add(SP(0.08, c.acc, { y: 0.4, z: 0.42, basic: true }));
      } else if (e === 3) {
        g.add(B(0.9, 1, 0.8, 0xd8d0c0, { y: 0.5 }));
        g.add(CO(0.5, 0.9, 4, 0x8a4a3a, { y: 1.45, ry: Math.PI / 4 }));
        g.add(B(0.06, 0.4, 0.06, 0xf0e8d8, { y: 2 }));
        g.add(B(0.24, 0.06, 0.06, 0xf0e8d8, { y: 1.95 }));
        win(g, 0, 0.45, 0.41);
      } else if (e === 4) {
        g.add(B(1.3, 0.24, 1, 0xd0d8e0, { y: 0.12 }));
        g.add(B(0.24, 1.3, 0.8, 0xe8ecf2, { y: 0.85 }));
        g.add(SP(0.28, 0xffd76a, { y: 1.7, basic: true }));
      } else if (e === 5) {
        g.add(C(0.7, 0.8, 0.2, 10, c.roof, { y: 0.1 }));
        g.add(C(0.3, 0.35, 1.6, 10, 0xd8f0f8, { y: 1, basic: true, op: 0.5 }));
        g.add(
          _m(new THREE.TorusGeometry(0.55, 0.05, 8, 22), c.acc, {
            y: 1.9,
            basic: true,
            op: 0.9,
            anim: 'spin',
          }),
        );
      } else {
        g.add(C(0.8, 0.9, 0.2, 10, c.roof, { y: 0.1 }));
        g.add(C(0.06, 0.1, 2, 6, c.wall, { y: 1.1 }));
        g.add(SP(0.3, c.acc, { y: 2.2, basic: true, op: 0.9, anim: 'bob' }));
        g.add(
          _m(new THREE.TorusGeometry(0.5, 0.04, 8, 20), c.acc, {
            y: 1.4,
            rx: 1.2,
            basic: true,
            op: 0.7,
            anim: 'spin',
          }),
        );
      }
      break;
    }
    case 'park': {
      g.add(B(1.7, 0.08, 1.7, 0x6ab858, { y: 0.04, ol: false }));
      if (e < 5) {
        g.add(C(0.3, 0.35, 0.3, 9, 0xb8b0a0, { y: 0.2 }));
        g.add(C(0.24, 0.24, 0.1, 9, 0x4ab8d8, { y: 0.36, basic: true, op: 0.8 }));
        const t1 = G();
        t1.add(C(0.06, 0.09, 0.5, 6, 0x7a5a38, { y: 0.25, ol: false }));
        t1.add(CO(0.4, 0.9, 7, 0x4f9e3f, { y: 0.8 }));
        t1.position.set(-0.55, 0, -0.5);
        g.add(t1);
        const t2 = G();
        t2.add(C(0.06, 0.09, 0.5, 6, 0x7a5a38, { y: 0.25, ol: false }));
        t2.add(SP(0.4, 0x6abe50, { y: 0.75, ol: false }));
        t2.position.set(0.55, 0, 0.5);
        g.add(t2);
        if (e === 2) g.add(SP(0.08, 0xd43a2a, { y: 0.9, basic: true }));
      } else {
        g.add(
          _m(new THREE.IcosahedronGeometry(0.35, 0), 0x8ad0e0, {
            y: 1.1,
            anim: 'bob',
            basic: e === 6,
            op: 0.8,
          }),
        );
        g.add(C(0.5, 0.6, 0.14, 9, 0xd0e0e8, { y: 0.07, ol: false }));
        g.add(SP(0.3, 0x50e0b0, { x: -0.5, y: 0.5, z: -0.4, ol: false }));
        g.add(SP(0.24, 0x60c8e0, { x: 0.5, y: 0.45, z: 0.45, ol: false }));
      }
      break;
    }
    case 'wonder': {
      if (e === 0) {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          g.add(B(0.4, rand(1.3, 1.8), 0.35, 0x8a8478, { x: Math.cos(a) * 1.1, y: 0.75, z: Math.sin(a) * 1.1, ry: a }));
        }
        g.add(B(0.5, 2, 0.5, 0x8a6238, { y: 1 }));
        g.add(B(1.1, 0.3, 0.4, 0xa07548, { y: 1.9 }));
        g.add(SP(0.2, 0xffd76a, { y: 2.3, basic: true }));
      } else if (e === 1) {
        g.add(B(3, 0.2, 3, 0xd8c89a, { y: 0.1 }));
        g.add(CO(1.9, 2.2, 4, 0xe8d8a8, { y: 1.3, ry: Math.PI / 4 }));
        g.add(CO(0.2, 1, 4, 0xe0d0a0, { x: 1.6, y: 0.7, z: 1.6 }));
        g.add(CO(0.2, 1, 4, 0xe0d0a0, { x: -1.6, y: 0.7, z: 1.6 }));
      } else if (e === 2) {
        let w = 1.7;
        for (let f = 0; f < 5; f++) {
          g.add(B(w, 0.42, w, c.wall, { y: 0.21 + f * 0.62 }));
          g.add(CO(w * 0.78, 0.34, 4, c.roof, { y: 0.56 + f * 0.62, ry: Math.PI / 4 }));
          g.add(SP(0.07, c.acc, { x: w * 0.5, y: 0.42 + f * 0.62, basic: true }));
          w *= 0.8;
        }
        g.add(C(0.04, 0.04, 0.7, 6, 0xd8b86a, { y: 3.5, ol: false }));
        g.add(SP(0.1, 0xffd76a, { y: 3.9, basic: true }));
      } else if (e === 3) {
        g.add(B(1.1, 2.6, 1.1, c.wall, { y: 1.3 }));
        g.add(B(1.3, 0.2, 1.3, 0xd8d0c0, { y: 2.65 }));
        g.add(C(0.34, 0.34, 0.06, 16, 0xf0ead8, { y: 2.2, z: 0.56, basic: true }));
        g.add(B(0.04, 0.24, 0.04, 0x2a2a2a, { y: 2.2, z: 0.6, ol: false }));
        g.add(CO(0.7, 1, 4, c.roof, { y: 3.2, ry: Math.PI / 4 }));
        win(g, 0, 0.8, 0.56);
        win(g, 0, 1.4, 0.56);
      } else if (e === 4) {
        g.add(B(1.6, 1.6, 1.6, 0xa8c0d8, { y: 0.8 }));
        g.add(B(1.2, 1.4, 1.2, 0xc0d4e8, { y: 2.3 }));
        g.add(B(0.8, 1.2, 0.8, 0xd8e4f0, { y: 3.6 }));
        for (let f = 0; f < 7; f++) {
          const fl = B(f < 3 ? 1.62 : f < 5 ? 1.22 : 0.82, 0.06, f < 3 ? 1.62 : f < 5 ? 1.22 : 0.82, 0x3a5a7a, { y: 0.5 + f * 0.62, basic: true });
          g.add(fl);
        }
        g.add(C(0.03, 0.03, 1, 6, 0xd8d8d8, { y: 4.7, ol: false }));
        g.add(SP(0.09, 0xff4a3a, { y: 5.2, basic: true, anim: 'blink' }));
      } else if (e === 5) {
        g.add(C(1.7, 1.9, 0.3, 16, c.roof, { y: 0.15 }));
        g.add(
          _m(new THREE.SphereGeometry(1.7, 20, 12, 0, 6.3, 0, 1.57), 0x9adcf0, {
            y: 0.3,
            basic: true,
            op: 0.28,
          }),
        );
        g.add(SP(0.5, 0x50e0b0, { y: 0.8, basic: true, op: 0.85, anim: 'bob' }));
        g.add(
          _m(new THREE.TorusGeometry(1.2, 0.06, 8, 30), c.acc, {
            y: 0.3,
            rx: Math.PI / 2,
            basic: true,
            op: 0.9,
            anim: 'spin',
          }),
        );
        const tt = G();
        tt.add(C(0.08, 0.12, 0.8, 6, 0x7a8a6a, { y: 0.4, ol: false }));
        tt.add(SP(0.45, 0x3fc0a0, { y: 1, ol: false }));
        tt.position.set(0.6, 0.3, -0.4);
        g.add(tt);
      } else {
        g.add(C(2, 2.3, 0.35, 16, 0x3a4a6a, { y: 0.18 }));
        g.add(C(0.35, 0.45, 2.6, 10, 0xe8ecf4, { y: 1.6 }));
        g.add(CO(0.38, 0.9, 10, 0xd04a3a, { y: 3.35 }));
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          g.add(B(0.14, 1.2, 0.5, 0xd04a3a, { x: Math.cos(a) * 0.42, y: 0.9, z: Math.sin(a) * 0.42, ry: -a }));
        }
        g.add(
          _m(new THREE.TorusGeometry(1.5, 0.08, 8, 30), c.acc, {
            y: 1.2,
            rx: Math.PI / 2,
            basic: true,
            op: 0.8,
            anim: 'spin',
          }),
        );
        g.add(
          _m(new THREE.TorusGeometry(1.8, 0.05, 8, 30), c.acc, {
            y: 2.4,
            rx: Math.PI / 2,
            basic: true,
            op: 0.6,
            anim: 'spin',
          }),
        );
        g.add(SP(0.12, 0x8aaaff, { y: 4, basic: true, anim: 'blink' }));
      }
      break;
    }
  }
  return g;
}
