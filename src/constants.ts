/* ================= 游戏静态数据：时代、建筑、神迹、祈祷、事件 ================= */
import { randi } from './utils';
import { IC } from './icon';

export const CELL = 2.3;

/* 时代调色板与名称 */
export const ERAS = [
  { name: '远古时期', icon: IC.eraFire, sky: 0xaee2ff, night: 0x0a1030, dusk: 0xffb27a, fog: 0xaee2ff, water: 0x2f8fd0, grass: 0x7ec850, sand: 0xf0dfb0, rock: 0x8a7f6a, leaf: 0x4f9e3f, sun: 0xfff2d8 },
  { name: '古典时代', icon: IC.eraAmphora, sky: 0xb8d8f0, night: 0x0c1236, dusk: 0xff9a5a, fog: 0xc8d8e8, water: 0x2aa5c9, grass: 0xa8bf62, sand: 0xe8d29a, rock: 0xa89a7a, leaf: 0x7a9e4a, sun: 0xffe8c0 },
  { name: '中世纪', icon: IC.eraLantern, sky: 0xcfe8e0, night: 0x0a1430, dusk: 0xff9a7a, fog: 0xd0e8e0, water: 0x3a9db8, grass: 0x6fbf63, sand: 0xe0d0a0, rock: 0x7a8a7a, leaf: 0x3f8e4f, sun: 0xfff0d0 },
  { name: '工业时代', icon: IC.eraFactory, sky: 0xc2c2b2, night: 0x0c0e24, dusk: 0xe88a5a, fog: 0xc2bcae, water: 0x3d7f8e, grass: 0x7da05a, sand: 0xcfc0a0, rock: 0x6a6a6a, leaf: 0x5a7a42, sun: 0xf0e0c0 },
  { name: '现代', icon: IC.eraCity, sky: 0x9fd4ff, night: 0x081028, dusk: 0xff9a8a, fog: 0xa8d4f0, water: 0x2f8fd0, grass: 0x69b868, sand: 0xf0e0b0, rock: 0x8a8a8a, leaf: 0x4aa050, sun: 0xfff4e0 },
  { name: '未来纪元', icon: IC.eraGlobe, sky: 0xa8b8f0, night: 0x0a0e30, dusk: 0xc88aff, fog: 0xb0bcec, water: 0x30c0e0, grass: 0x5ac8a0, sand: 0xd0e0e8, rock: 0x7a8aa0, leaf: 0x3fc0a0, sun: 0xe0f0ff },
  { name: '太空时代', icon: IC.eraRocket, sky: 0x3a4a80, night: 0x05081c, dusk: 0x8a6ad0, fog: 0x44508a, water: 0x1a4a80, grass: 0x4a8a78, sand: 0xb0c0d0, rock: 0x5a6a8a, leaf: 0x3a8a80, sun: 0xc0d8ff },
];

export const ERA_TITLE_SUB = [
  '钻木取火 · 文明初啼',
  '金字塔下 · 众神之国',
  '青瓦飞檐 · 礼乐之邦',
  '蒸汽轰鸣 · 钢铁洪流',
  '霓虹闪烁 · 摩天丛林',
  '量子之光 · 生态穹顶',
  '星辰大海 · 方舟起航',
];

/* 建筑配色（墙/顶/点缀），按时代 */
export const BC = [
  { wall: 0xb08a5a, roof: 0x8a6238, acc: 0xe0c890 },
  { wall: 0xeadfc2, roof: 0xc9a86a, acc: 0x3a6ea5 },
  { wall: 0x9a5a3a, roof: 0x3a3f4a, acc: 0xd43a2a },
  { wall: 0x8a4a3a, roof: 0x484850, acc: 0x8a9aaa },
  { wall: 0xdfe6ee, roof: 0x5a7a9a, acc: 0x3a5a7a },
  { wall: 0xe8f2fa, roof: 0x2a3a5a, acc: 0x35e0e6 },
  { wall: 0xc8d2e4, roof: 0x1a2a4a, acc: 0x8aaaff },
];

export interface BuildingDef {
  t: string;
  icon: string;
  cost: [number, number, number]; // [木, 金, 信仰]
  names: string[];
  tip: string;
}

/* 建筑目录 */
export const CATALOG: BuildingDef[] = [
  { t: 'house', icon: IC.house, cost: [20, 0, 0], names: ['茅屋', '泥砖屋', '中式瓦房', '砖石里弄', '公寓楼', '生态居所', '失重舱居'], tip: '住房 · 人口容量+4' },
  { t: 'farm', icon: IC.farm, cost: [15, 0, 0], names: ['采集地', '灌溉农田', '梯田', '机械化农场', '都市农场', '垂直农场', '水培穹舱'], tip: '生产食物' },
  { t: 'wood', icon: IC.woodcutter, cost: [10, 0, 0], names: ['伐木场', '采木工坊', '林场', '锯木厂', '建材站', '合成材料坊', '物质打印站'], tip: '生产木材' },
  { t: 'market', icon: IC.market, cost: [25, 10, 0], names: ['以物易市', '绿洲集市', '古代市集', '百货商号', '购物中心', '全息商城', '星际交易所'], tip: '产出金币 · 幸福+2' },
  { t: 'temple', icon: IC.temple, cost: [35, 15, 0], names: ['图腾祭坛', '太阳神庙', '宗祠庙宇', '教堂', '文化广场', '冥想圣殿', '星辉圣所'], tip: '产出信仰 · 幸福+3' },
  { t: 'park', icon: IC.park, cost: [15, 10, 0], names: ['圣地林苑', '皇家花园', '园林', '街心公园', '中央公园', '浮空花园', '生态穹园'], tip: '幸福+5' },
  { t: 'wonder', icon: IC.wonder, cost: [60, 40, 20], names: ['巨石图腾阵', '金字塔', '玲珑宝塔', '大钟楼', '天际塔', '生态穹顶', '方舟发射台'], tip: '时代奇观 · 跃迁必需' },
];

export const CATMAP: Record<string, string> = {
  house: '住房', farm: '农业', wood: '工业', market: '商业',
  temple: '信仰', park: '环境', wonder: '奇观',
};

export const wonderCost = (e: number): [number, number, number] =>
  [60 + e * 40, 40 + e * 30, 20 + e * 10];

export const eraReq = (e: number): { pop: number; gold: number } =>
  ({ pop: 8 + e * 7, gold: 50 + e * 45 });

export const EXPAND_COST: [number, number][] = [
  [80, 60],
  [150, 120],
  [250, 200],
  [380, 300],
  [540, 420],
  [740, 560],
  [980, 720],
  [1260, 900],
  [1580, 1100],
  [1940, 1320],
];

/* 市民服装颜色 */
export const CIT_COL = [0x9a6a42, 0xe8e0d0, 0x4a5a8a, 0x5a5a62, 0x3a6ab8, 0xe8f0f8, 0xf0f4ff];

/* 祈祷任务 */
export const PRAYERS = [
  { txt: '祈求食物', fn(): string { return '+20 食物'; } },
  { txt: '想要更多住房', fn(): string { return '+15 木材'; } },
  { txt: '祈求平安', fn(): string { return '幸福+6'; } },
  { txt: '盼望财富', fn(): string { return '+18 金币'; } },
  { txt: '希望风调雨顺', fn(): string { return '降下甘霖'; } },
];

/* 随机事件定义在 game.ts 中，因为需要修改 S 状态 */

/* 神迹定义（f 在 game.ts 中绑定到 state） */
export interface GodDef {
  k: string;
  icon: string;
  name: string;
  cost: number;
  cd: number;
  tip: string;
  f: () => boolean;
}

export const GODS: GodDef[] = [
  { k: 'rain', icon: IC.rain, name: '赐雨', cost: 15, cd: 40, tip: '农田产量×2（60秒）', f() { return true; } },
  { k: 'meteor', icon: IC.meteor, name: '流星矿', cost: 25, cd: 60, tip: '天降流星，砸出金币与木材', f() { return true; } },
  { k: 'bless', icon: IC.bless, name: '丰收祝福', cost: 20, cd: 35, tip: '立即获得食物与幸福', f() { return true; } },
  { k: 'haste', icon: IC.haste, name: '时光加速', cost: 10, cd: 30, tip: '时间流速×3（25秒）', f() { return true; } },
  { k: 'calm', icon: IC.calm, name: '平息海啸', cost: 30, cd: 50, tip: '驱散海啸与干旱危机', f() { return true; } },
  { k: 'heal', icon: IC.heal, name: '治愈瘟疫', cost: 35, cd: 55, tip: '治愈所有病人并免疫瘟疫', f() { return true; } },
];

/* 时代技能：每时代可选择一项，肉鸽式叠加 */
export interface SkillEffect {
  type: string;
  value: number;
}

export interface SkillDef {
  k: string;
  icon: string;
  name: string;
  desc: string;
  effects: SkillEffect[];
}

export const SKILLS: SkillDef[] = [
  { k: 'farmTech', icon: IC.farm, name: '农业革命', desc: '农田产出 +30%', effects: [{ type: 'farmMul', value: 0.30 }] },
  { k: 'woodTech', icon: IC.woodcutter, name: '林业技术', desc: '伐木产出 +30%', effects: [{ type: 'woodMul', value: 0.30 }] },
  { k: 'marketTech', icon: IC.market, name: '商业繁荣', desc: '市场产出 +30%', effects: [{ type: 'marketMul', value: 0.30 }] },
  { k: 'templeTech', icon: IC.temple, name: '信仰凝聚', desc: '神庙产出 +30%，神迹冷却 -10%', effects: [{ type: 'templeMul', value: 0.30 }, { type: 'godCdMul', value: 0.10 }] },
  { k: 'popTech', icon: IC.pop, name: '人口红利', desc: '人口容量 +25%', effects: [{ type: 'popCapMul', value: 0.25 }] },
  { k: 'buildTech', icon: IC.house, name: '建筑大师', desc: '建筑成本 -15%', effects: [{ type: 'costMul', value: 0.15 }] },
  { k: 'crisisTech', icon: IC.warning, name: '防灾工事', desc: '危机持续时间 -25%', effects: [{ type: 'crisisDurMul', value: 0.25 }] },
  { k: 'speedTech', icon: IC.haste, name: '迅捷工人', desc: '市民移动速度 +25%', effects: [{ type: 'citizenSpeedMul', value: 0.25 }] },
  { k: 'happyTech', icon: IC.happy, name: '众志成诚', desc: '危机期间幸福下降 -30%', effects: [{ type: 'crisisHappyMul', value: 0.30 }] },
  { k: 'rainTech', icon: IC.rain, name: '天降甘霖', desc: '赐雨持续时间 +30秒', effects: [{ type: 'rainDurAdd', value: 30 }] },
];

export const SKILLMAP: Record<string, SkillDef> = SKILLS.reduce((m, s) => { m[s.k] = s; return m; }, {} as Record<string, SkillDef>);

/** 随机抽取 n 个不重复的技能 */
export function rollSkills(n: number, exclude: string[] = []): SkillDef[] {
  const pool = SKILLS.filter((s) => !exclude.includes(s.k));
  const out: SkillDef[] = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
