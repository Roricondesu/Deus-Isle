import * as THREE from 'three';
import {
  S,
  eraMul,
  popCap,
  eraReady,
  R,
  cellY,
  canAfford,
  costText,
  pay,
  expandCost,
  PATCHES,
  addPatch,
  landH,
  farmMul,
  woodMul,
  marketMul,
  templeMul,
  crisisHappyMul,
  crisisDurMul,
  godCdMul,
  rainDurAdd,
  costMul,
  citizenSpeedMul,
  difficulty,
  type CellEntry,
  type Crisis,
} from './state';
import {
  GODS,
  PRAYERS,
  ERAS,
  eraReq,
  CATALOG,
  CELL,
  SKILLS,
  SKILLMAP,
  rollSkills,
  type BuildingDef,
  type SkillDef,
} from './constants';
import { V3, rand, randi, pick, clamp, lerp, tw, easeIn, easeOutBack } from './utils';
import {
  scene,
  camera,
  islandGroup,
  setPalette,
  PAL_T,
  addShake,
  buildIsland,
  showIslandUnderside,
} from './environment';
import { citizens, remeshAllCitizens, assignJobs, removeCitizen, healAll, type Citizen } from './citizens';
import { makeBuilding } from './buildings';
import { burst, rainPts } from './particles';
import { sfx } from './audio';
import {
  toast,
  floatText,
  refreshHUD,
  renderDock,
  showEraTransition,
  hideEraTransition,
  showVictory,
  updateCrisisBanner,
  showSkillChoices,
  hideSkillChoices,
} from './hud';
import { placeBuilding, highlight } from './interaction';
import { iconify, icon, IC } from './icon';
import { saveGame } from './save';
import { rebuildRoads } from './roads';
import { markCrisisSurvived } from './tasks';

/* ================= 随机事件（直接修改 S） ================= */
interface EventDef {
  w: number;
  f: () => [string, string] | null;
}

/** 是否已有危机 */
function inCrisis(): boolean { return S.crisis !== null; }

export const EVENTS: EventDef[] = [
  // ---- 正面事件 ----
  {
    w: 3,
    f() {
      const g = randi(25, 45);
      S.gold += g;
      return ['远方商船来访，贸易 +' + g + ' 金币', IC.ship];
    },
  },
  {
    w: 2,
    f() {
      const f = randi(8, 15);
      S.faith += f;
      return ['流星雨之夜，信仰 +' + f, IC.meteorShower];
    },
  },
  {
    w: 3,
    f() {
      const f = randi(18, 30);
      S.food += f;
      return ['鱼群洄游，食物 +' + f, IC.fish];
    },
  },
  {
    w: 2,
    f() {
      S.happy = Math.min(98, S.happy + 7);
      return ['祥瑞之兆，幸福 +7', IC.eagle];
    },
  },
  {
    w: 1,
    f() {
      S.faith += 30;
      return ['一位伟人诞生了！信仰 +30', IC.star];
    },
  },
  {
    w: 2,
    f() {
      if (S.era < 1) return null;
      const g = randi(20, 40);
      S.gold += g;
      return ['遗迹游客络绎不绝，金币 +' + g, IC.camera];
    },
  },
  // ---- 危机事件（不可叠加）----
  {
    w: 2,
    f() {
      if (inCrisis() || S.plagueShield > 0) return null;
      const d = difficulty();
      S.crisis = { type: 'plague', t: 45 * crisisDurMul(), severity: Math.min(0.95, (0.5 + Math.random() * 0.4) * d) };
      return ['瘟疫爆发！市民不断病倒，快用神迹治愈', IC.plague];
    },
  },
  {
    w: 2,
    f() {
      if (inCrisis()) return null;
      const d = difficulty();
      S.crisis = { type: 'drought', t: 50 * crisisDurMul(), severity: Math.min(0.95, (0.5 + Math.random() * 0.4) * d) };
      return ['大旱来袭！农田干涸，河流断流', IC.drought];
    },
  },
  {
    w: 1,
    f() {
      if (inCrisis()) return null;
      const d = difficulty();
      S.crisis = { type: 'tsunami', t: 30 * crisisDurMul(), severity: Math.min(0.95, (0.6 + Math.random() * 0.3) * d) };
      addShake(1.2);
      return ['海啸警报！沿海建筑停产，快平息海浪', IC.tsunami];
    },
  },
  {
    w: 1,
    f() {
      if (inCrisis()) return null;
      const d = difficulty();
      S.crisis = { type: 'meteor', t: 25 * crisisDurMul(), severity: Math.min(0.95, (0.5 + Math.random() * 0.5) * d) };
      addShake(0.8);
      castMeteor(true);
      return ['陨石坠落！小心火灾蔓延', IC.meteor];
    },
  },
];

/* ================= 经济循环 ================= */
export function econTick(): void {
  const mul = eraMul();
  const rainB = S.buffs.rain > 0 ? 2 : 1;
  const drought = S.crisis?.type === 'drought' ? 1 - S.crisis.severity * 0.7 : 1;
  const tsunami = S.crisis?.type === 'tsunami' ? 1 - S.crisis.severity * 0.6 : 1;
  const meteor = S.crisis?.type === 'meteor' ? 1 - S.crisis.severity * 0.5 : 1;
  let dFood = 0, dWood = 0, dGold = 0, dFaith = 0, happyT = 52;
  const fMul = farmMul(), wMul = woodMul(), mMul = marketMul(), tMul = templeMul();

  S.cells.forEach((b, key) => {
    const m = b.relic ? 0.5 : (1 + b.era * 0.25) * (1 + (b.level - 1) * 0.2);
    const w = (S.jobs.get(key) || []).length; // 工人数
    const crisisM = b.t === 'farm' ? drought : b.t === 'market' || b.t === 'temple' ? tsunami : meteor;
    switch (b.t) {
      case 'farm':
        dFood += 0.6 * m * rainB * drought * (1 + w * 0.7) * fMul;
        break;
      case 'wood':
        dWood += 0.35 * m * (1 + w * 0.7) * wMul;
        break;
      case 'market':
        dGold += 0.4 * m * tsunami * (1 + w * 0.6) * mMul;
        happyT += 2;
        break;
      case 'temple':
        dFaith += 0.18 * m * tsunami * (1 + w * 0.6) * tMul;
        happyT += 3;
        break;
      case 'park':
        happyT += 3 + w * 2;
        break;
      case 'wonder':
        happyT += 8;
        if (b.relic) dGold += 0.35;
        else dFaith += 0.15;
        break;
      case 'house':
        happyT += w * 1.5; // 有居民居住的幸福加成
        break;
    }
  });

  dFood -= S.pop * 0.09;
  S.food = Math.max(0, S.food + dFood);
  S.wood += dWood;
  S.gold += dGold;
  S.faith += dFaith;

  // 危机对幸福的影响
  if (S.crisis) happyT -= S.crisis.severity * 25 * crisisHappyMul();
  // 生病市民
  const sick = citizens.filter((c) => c.state === 'sick').length;
  if (sick) happyT -= Math.min(30, sick * 2);

  happyT += S.food > 0 ? 8 : -20;
  happyT -= Math.max(0, S.pop - popCap()) * 1.2; // 过度拥挤
  happyT -= Math.max(0, S.pop - 18) * 0.25;
  happyT += S.buffs.rain > 0 ? 3 : 0;
  S.happy = lerp(S.happy, clamp(happyT, 5, 98), 0.06);

  // 瘟疫致命：严重时病人可能死亡
  if (S.crisis?.type === 'plague' && S.crisis.t > 0) {
    const dead: Citizen[] = [];
    for (const c of citizens) {
      if (c.state === 'sick' && Math.random() < 0.003 * S.crisis.severity) {
        dead.push(c);
      }
    }
    for (const c of dead) {
      if (removeCitizen(c.id)) {
        S.pop = Math.max(0, S.pop - 1);
        toast(`${c.name} 没能挺过瘟疫`, IC.skull);
      }
    }
  }

  if (Math.random() < 0.3) {
    const arr: { g: THREE.Group; t: string }[] = [];
    S.cells.forEach((b) => {
      if (!b.relic && (b.t === 'farm' || b.t === 'wood' || b.t === 'market' || b.t === 'temple')) {
        arr.push({ g: b.g, t: b.t });
      }
    });
    if (arr.length) {
      const b = pick(arr);
      const ico = b.t === 'farm' ? IC.food : b.t === 'wood' ? IC.woodcutter : b.t === 'market' ? IC.gold : IC.faith;
      floatText(b.g.position, icon(ico), '#ffe9b0');
    }
  }
}

export function popTick(): void {
  const cap = popCap();
  if (S.pop < cap && S.food > 10 && S.happy > 45) {
    S.pop++;
    S.food = Math.max(0, S.food - 4);
    if (Math.random() < 0.5) toast('新生命诞生！人口+1', IC.baby);
  } else if (S.food <= 0 && S.pop > 2 && Math.random() < 0.4) {
    S.pop--;
    toast('有市民因饥饿离开了', IC.skull);
  }
}

/* ================= 祈祷系统 ================= */
interface ActivePrayer {
  c: Citizen;
  el: HTMLDivElement;
  p: (typeof PRAYERS)[number];
  life: number;
}

let activePrayer: ActivePrayer | null = null;

function applyPrayerEffect(p: (typeof PRAYERS)[number]): string {
  switch (p.txt) {
    case '祈求食物':
      S.food += 20;
      return '+20 食物';
    case '想要更多住房':
      S.wood += 15;
      return '+15 木材';
    case '祈求平安':
      S.happy = Math.min(98, S.happy + 6);
      return '幸福+6';
    case '盼望财富':
      S.gold += 18;
      return '+18 金币';
    case '希望风调雨顺':
      S.buffs.rain = Math.max(S.buffs.rain, 25 + rainDurAdd());
      rainPts.visible = true;
      return '降下甘霖';
    default:
      return '';
  }
}

export function spawnPrayer(): void {
  if (activePrayer || !citizens.length || S.transitioning || S.over) return;
  const c = pick(citizens);
  c.state = 'pray';
  c.t = 9;
  const p = pick(PRAYERS);
  const el = document.createElement('div');
  el.className = 'prayer';
  el.innerHTML = icon(p.icon) + p.txt;
  document.getElementById('prayers')!.appendChild(el);
  activePrayer = { c, el, p, life: 9 };
  el.onclick = () => {
    if (!activePrayer) return;
    const got = applyPrayerEffect(p);
    S.faith += 6;
    sfx.faith();
    burst(c.g.position.clone().add(V3(0, 1.2, 0)), 0xffd76a, 26, 3, 1.1, -1, 4);
    floatText(c.g.position, '+6 信仰 ' + got, '#ffe9b0');
    endPrayer(false);
  };
}

function endPrayer(expired: boolean): void {
  if (!activePrayer) return;
  activePrayer.el.remove();
  activePrayer.c.t = Math.min(activePrayer.c.t, 0.5);
  if (expired) S.happy = Math.max(5, S.happy - 3);
  activePrayer = null;
}

export function updatePrayer(dt: number): void {
  if (!activePrayer) return;
  activePrayer.life -= dt;
  if (activePrayer.life <= 0) {
    endPrayer(true);
    return;
  }
  const pos = activePrayer.c.g.position.clone().add(V3(0, 1.6, 0));
  pos.project(camera);
  const x = (pos.x * 0.5 + 0.5) * innerWidth;
  const y = (-pos.y * 0.5 + 0.5) * innerHeight;
  activePrayer.el.style.left = x + 'px';
  activePrayer.el.style.top = y + 'px';
}

/* ================= 随机事件触发 ================= */
export function fireEvent(): void {
  const pool = EVENTS.flatMap((e) => Array(e.w).fill(e));
  for (let i = 0; i < 4; i++) {
    const r = pick(pool).f();
    if (r) {
      toast(r[0], r[1]);
      sfx.pop();
      return;
    }
  }
}

/* ================= 神迹 ================= */
function bindGods(): void {
  GODS[0].f = () => {
    S.buffs.rain = 60 + rainDurAdd();
    rainPts.visible = true;
    toast('神迹·赐雨！农田产量翻倍', IC.rain);
    return true;
  };
  GODS[1].f = () => {
    castMeteor();
    return true;
  };
  GODS[2].f = () => {
    S.food += 55;
    S.happy = Math.min(98, S.happy + 5);
    burst(V3(0, 2, 0), 0xffe98a, 80, 10, 1.8, 2, 7);
    toast('神迹·丰收！食物 +55', IC.bless);
    return true;
  };
  GODS[3].f = () => {
    S.buffs.haste = 25;
    toast('神迹·时光加速！', IC.haste);
    return true;
  };
  GODS[4].f = () => {
    if (!S.crisis || (S.crisis.type !== 'drought' && S.crisis.type !== 'tsunami')) {
      toast('当前没有海啸或干旱可平息', IC.warning);
      return false;
    }
    S.crisis = null;
    hideTsunamiWave();
    markCrisisSurvived();
    toast('神迹·平息！海啸与干旱已退去', IC.calm);
    updateCrisisBanner();
    return true;
  };
  GODS[5].f = () => {
    healAll();
    S.plagueShield = 90;
    if (S.crisis?.type === 'plague') {
      S.crisis = null;
      markCrisisSurvived();
    }
    toast('神迹·治愈！瘟疫退散，市民获得免疫', IC.heal);
    updateCrisisBanner();
    return true;
  };
}
bindGods();

export function castGod(k: string): void {
  const g = GODS.find((x) => x.k === k);
  if (!g) return;
  if ((S.cds[k] || 0) > 0) {
    sfx.error();
    return;
  }
  if (S.faith < g.cost) {
    sfx.error();
    toast('信仰不足！需要 ' + g.cost, IC.warning);
    return;
  }
  S.faith -= g.cost;
  S.cds[k] = g.cd * godCdMul();
  if (g.f() === false) {
    // 神迹未生效，退还消耗与冷却
    S.faith += g.cost;
    S.cds[k] = 0;
    return;
  }
  sfx.miracle();
  refreshHUD();
  renderDock();
}

/* ================= 危机系统 ================= */
const tsunamiWave = new THREE.Mesh(
  new THREE.RingGeometry(1, 1.06, 64),
  new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
tsunamiWave.rotation.x = -Math.PI / 2;
tsunamiWave.position.y = -0.25;
scene.add(tsunamiWave);

function showTsunamiWave(): void {
  tsunamiWave.visible = true;
}
function hideTsunamiWave(): void {
  tsunamiWave.visible = false;
}

export function updateCrisis(dt: number): void {
  if (S.plagueShield > 0) S.plagueShield = Math.max(0, S.plagueShield - dt);

  if (!S.crisis) {
    hideTsunamiWave();
    return;
  }

  S.crisis.t -= dt;
  const type = S.crisis.type;

  if (type === 'tsunami') {
    showTsunamiWave();
    const progress = Math.min(1, Math.max(0, S.crisis.t / 35));
    const scale = 10 + (1 - progress) * 32;
    tsunamiWave.scale.setScalar(scale);
    (tsunamiWave.material as THREE.MeshBasicMaterial).opacity = 0.2 + S.crisis.severity * 0.35 + Math.sin(S.crisis.t * 3) * 0.05;
  } else {
    hideTsunamiWave();
  }

  updateCrisisBanner();

  if (S.crisis.t <= 0) {
    const names: Record<Crisis['type'], string> = { drought: '大旱', tsunami: '海啸', plague: '瘟疫', meteor: '陨石' };
    toast(names[type] + ' 已经平息', IC.check);
    markCrisisSurvived();
    S.crisis = null;
    hideTsunamiWave();
    updateCrisisBanner();
  }
}

function castMeteor(isCrisis: boolean = false): void {
  const a = rand(Math.PI * 2);
  const d = rand(R() * 0.7);
  const tx = Math.cos(a) * d;
  const tz = Math.sin(a) * d;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8a3a }),
  );
  m.position.set(tx + 18, 26, tz + 14);
  scene.add(m);
  sfx.boom();
  tw(
    1.1,
    (k) => {
      m.position.set(lerp(tx + 18, tx, k), lerp(26, 0.3, k), lerp(tz + 14, tz, k));
    },
    (t) => t,
    () => {
      scene.remove(m);
      burst(V3(tx, 0.5, tz), 0xff8a3a, 50, 8, 1.2, -4, 7);
      burst(V3(tx, 0.5, tz), 0xffe98a, 30, 5, 1, -2, 5);
      addShake(0.6);
      sfx.boom();
      if (isCrisis) {
        // 危机陨石只造成视觉与停产，不摧毁任何建筑
        burst(V3(tx, 0.5, tz), 0xff5a3a, 16, 4, 1.2, 2, 5);
        toast('陨石坠岛！建筑停产，地标无损', IC.meteor);
      } else {
        const gold = randi(30, 55);
        const wood = randi(15, 30);
        S.gold += gold;
        S.wood += wood;
        floatText(V3(tx, 0, tz), '+' + gold + ' 金币 +' + wood + ' 木材', '#ffd76a');
        toast('流星坠岛！砸出矿藏', IC.meteor);
      }
      refreshHUD();
    },
  );
}

/* ================= 时代跃迁 ================= */
export function eraUp(): void {
  if (!eraReady() || S.transitioning) return;
  S.transitioning = true;
  S.sel = null;
  highlight.visible = false;
  document.body.classList.add('cine');
  const oldGold = eraReq(S.era).gold;
  S.gold -= oldGold;
  sfx.era();
  S.buffs.haste = Math.max(S.buffs.haste, 0);
  const oldScale = S.timeScale;
  S.timeScale = 10;
  setTimeout(() => {
    S.era++;
    setPalette(S.era);
    morphBuildings();
    remeshAllCitizens();
    showEraTransition();
    burst(V3(0, 4, 0), 0xffffff, 100, 14, 2, -1, 8);
  }, 2300);
  setTimeout(() => {
    S.timeScale = 0;
    hideEraTransition();
  }, 3800);
  setTimeout(() => {
    const choices = rollSkills(Math.min(3, SKILLS.length), S.skills);
    if (choices.length === 0) {
      endEraUp(oldScale);
      return;
    }
    S.skillChoices = choices.map((s) => s.k);
    showSkillChoices(choices, (k) => {
      S.skills.push(k);
      S.skillChoices = null;
      hideSkillChoices();
      endEraUp(oldScale);
    });
  }, 4100);
}

function endEraUp(oldScale: number): void {
  document.body.classList.remove('cine');
  S.timeScale = oldScale;
  S.transitioning = false;
  toast('文明进入' + ERAS[S.era].name + '！建筑已全面进化', ERAS[S.era].icon);
  refreshHUD();
  renderDock();
  saveGame();
}

function upgradeBuildingMesh(b: CellEntry, key: string, newEra: number): void {
  const [x, z] = key.split(',').map(Number);
  burst(b.g.position.clone().add(V3(0, 1, 0)), 0xffffff, 18, 4, 0.8, -2, 4);
  islandGroup.remove(b.g);
  b.g = makeBuilding(b.t, newEra);
  b.g.position.set(x * CELL, cellY(x, z) - 0.06, z * CELL);
  b.g.rotation.y = randi(0, 3) * Math.PI / 2;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.14, 0.18, 10),
    new THREE.MeshToonMaterial({ color: 0xb8b0a0 }),
  );
  base.position.y = -0.02;
  b.g.add(base);
  b.g.scale.setScalar(0.01);
  islandGroup.add(b.g);
  tw(0.6, (k) => b.g.scale.setScalar(Math.max(0.01, k)), easeOutBack);
  b.era = newEra;
  sfx.pop();
  rebuildRoads();
}

function morphBuildings(): void {
  let i = 0;
  let count = 0;
  S.cells.forEach((b, key) => {
    if (b.t === 'wonder') {
      b.relic = true;
      return;
    }
    count++;
    setTimeout(() => upgradeBuildingMesh(b, key, S.era), i * 90);
    i++;
  });
  // 所有升级动画结束后再重建一次道路（确保时代风格更新）
  setTimeout(() => rebuildRoads(), count * 90 + 700);
}

/* ================= 居民自动升级建筑 ================= */
let upgradeAcc = 0;
let nextUpgradeAt = rand(60, 120); // 下次升级时机（秒），1-2 分钟随机
const UPGRADE_RATIO = 0.5;  // 升级消耗 = 该建筑原始 cost 的 50%
const MAX_LEVEL = 5;        // 建筑最高等级（满级 +100% 收益）

export function autoUpgradeTick(dt: number): void {
  if (S.transitioning || S.over) return;
  upgradeAcc += dt;
  if (upgradeAcc < nextUpgradeAt) return;
  upgradeAcc = 0;
  nextUpgradeAt = rand(60, 120); // 重置下次随机间隔

  // 1. 优先：时代落后的建筑升级到当前时代外观（需 era>=1）
  if (S.era >= 1) {
    const eraCands: { key: string; b: CellEntry; def: BuildingDef }[] = [];
    S.cells.forEach((b, key) => {
      if (b.relic || b.t === 'wonder') return;
      if (b.era >= S.era) return;
      const def = CATALOG.find((d) => d.t === b.t);
      if (def) eraCands.push({ key, b, def });
    });
    if (eraCands.length) {
      const { key, b, def } = pick(eraCands);
      const cm = costMul();
      const cost: [number, number, number] = [
        Math.ceil(def.cost[0] * UPGRADE_RATIO * cm),
        Math.ceil(def.cost[1] * UPGRADE_RATIO * cm),
        Math.ceil(def.cost[2] * UPGRADE_RATIO * cm),
      ];
      if (canAfford(cost)) {
        pay(cost);
        upgradeBuildingMesh(b, key, S.era);
        floatText(b.g.position, icon(IC.arrowUp) + ' 升级→' + ERAS[S.era].name, '#9fd8ff');
        refreshHUD();
        return;
      }
    }
  }

  // 2. 其次：资源充足时提升建筑等级（每级 +20% 收益）
  const lvlCands: { key: string; b: CellEntry; def: BuildingDef }[] = [];
  S.cells.forEach((b, key) => {
    if (b.relic || b.t === 'wonder') return;
    if (b.level >= MAX_LEVEL) return;
    const def = CATALOG.find((d) => d.t === b.t);
    if (def) lvlCands.push({ key, b, def });
  });
  if (!lvlCands.length) return;
  const { b, def } = pick(lvlCands);
  const cm = costMul();
  const cost: [number, number, number] = [
    Math.ceil(def.cost[0] * UPGRADE_RATIO * cm),
    Math.ceil(def.cost[1] * UPGRADE_RATIO * cm),
    Math.ceil(def.cost[2] * UPGRADE_RATIO * cm),
  ];
  if (!canAfford(cost)) return;
  pay(cost);
  b.level++;
  S.upgrades++; // 累计升级次数，驱动难度递增
  // 升级特效：粒子 + 短暂放大脉冲
  burst(b.g.position.clone().add(V3(0, 1, 0)), 0xffe98a, 16, 3, 0.9, -2, 4);
  const baseScale = b.g.scale.x;
  tw(0.45, (k) => b.g.scale.setScalar(baseScale * (1 + 0.25 * Math.sin(k * Math.PI))), (t) => t);
  floatText(b.g.position, icon(IC.arrowUp) + ' Lv.' + b.level + ' · 收益 +20%', '#ffe98a');
  sfx.pop();
  refreshHUD();
}

/* ================= 终局：方舟发射 ================= */
let launching = false;
let launchT = 0;

export function startLaunch(): void {
  if (launching) return;
  launching = true;
  S.transitioning = true;
  document.body.classList.add('cine');
  sfx.launch();
  toast('方舟点火！全岛升空——', IC.eraRocket);
  PAL_T.night.set(0x020310);
  PAL_T.sky.set(0x05081c);
  PAL_T.fog.set(0x05081c);
  // 显示岛屿底部冰山造型
  showIslandUnderside();
}

export function updateLaunch(dt: number): void {
  if (!launching || S.over) return;
  launchT += dt;
  addShake(0.4);
  const k = clamp(launchT / 9, 0, 1);
  islandGroup.position.y = easeIn(k) * 120;
  islandGroup.rotation.y += dt * 0.05 * k;
  if (Math.random() < 0.6) {
    const pos = V3(rand(-6, 6), islandGroup.position.y - 8, rand(-6, 6));
    burst(pos, pick([0xff8a3a, 0xffd76a, 0xff5a3a]), 8, 5, 0.9, 2, 2);
  }
  if (k >= 1) {
    S.over = true;
    document.body.classList.remove('cine');
    showVictory();
    localStorage.removeItem('deus-isle-save');
  }
}

/* ================= 填海扩岛（手动选择任意位置） ================= */
const PATCH_RADIUS = 5;
const PATCH_MIN_DIST = 14;  // 离岛心最小距离（避免压主岛）
const PATCH_MAX_DIST = 32;  // 离岛心最大距离（10 次扩岛需要更大范围）
const MAX_EXPAND = 10;      // 最大扩岛次数

export function enterExpandMode(): void {
  if (S.expand >= MAX_EXPAND || S.transitioning || S.over) return;
  if (S.expandMode) {
    cancelExpandMode();
    return;
  }
  const c = expandCost(S.expand);
  if (!canAfford([c[0], c[1], 0])) {
    sfx.error();
    toast('资源不足！需要 ' + costText([c[0], c[1], 0]), IC.warning);
    return;
  }
  S.expandMode = true;
  S.sel = null;
  toast('点击海面任意位置填海造陆', IC.target);
  refreshHUD();
  renderDock();
}

export function cancelExpandMode(): void {
  if (!S.expandMode) return;
  S.expandMode = false;
  refreshHUD();
  renderDock();
}

export function isValidExpandPos(x: number, z: number): boolean {
  const d = Math.hypot(x, z);
  if (d < PATCH_MIN_DIST || d > PATCH_MAX_DIST) return false;
  // 必须在水面上（landH <= 0）
  if (landH(x, z) > 0) return false;
  // 不能与已有 patch 重叠
  for (const p of PATCHES) {
    const px = Math.cos(p.ang) * p.dist;
    const pz = Math.sin(p.ang) * p.dist;
    if (Math.hypot(px - x, pz - z) < p.r + PATCH_RADIUS - 1) return false;
  }
  return true;
}

export function confirmExpandAt(x: number, z: number): void {
  if (!S.expandMode || S.expand >= MAX_EXPAND) {
    cancelExpandMode();
    return;
  }
  if (!isValidExpandPos(x, z)) {
    sfx.error();
    toast('位置不合适：需在水面上，距岛心 ' + PATCH_MIN_DIST + '–' + PATCH_MAX_DIST + ' 之间', IC.warning);
    return;
  }
  const c = expandCost(S.expand);
  if (!canAfford([c[0], c[1], 0])) {
    sfx.error();
    toast('资源不足！需要 ' + costText([c[0], c[1], 0]), IC.warning);
    cancelExpandMode();
    return;
  }
  S.wood -= c[0];
  S.gold -= c[1];
  addPatch(x, z, PATCH_RADIUS);
  S.expand++;
  S.expandMode = false;
  buildIsland();
  sfx.build();
  addShake(0.3);
  burst(V3(x, 1, z), 0x8ad0ff, 60, 14, 1.4, -2, 6);
  toast('填海造陆！岛屿向该方向扩张', IC.island);
  refreshHUD();
  saveGame();
}
