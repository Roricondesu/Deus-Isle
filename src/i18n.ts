/* ================= 多语言支持（中/英） ================= */

export type Lang = 'zh' | 'en';

let _lang: Lang = 'zh';
export function lang(): Lang { return _lang; }

const LANG_KEY = 'deus-isle-lang';

export function setLang(l: Lang): void {
  _lang = l;
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
}

export function loadLang(): void {
  const saved = localStorage.getItem(LANG_KEY) as Lang | null;
  if (saved === 'zh' || saved === 'en') {
    _lang = saved;
  } else {
    // 浏览器语言检测
    const nav = navigator.language.toLowerCase();
    _lang = nav.startsWith('zh') ? 'zh' : 'en';
  }
  document.documentElement.lang = _lang === 'zh' ? 'zh-CN' : 'en';
}

type Dict = Record<string, string>;

const ZH: Dict = {
  // 主菜单
  start: '开始游戏',
  loadSave: '读取存档',
  settings: '设置',
  about: '关于',
  back: '返回',
  // 存档
  saveList: '存档列表',
  slot: '槽位',
  empty: '空',
  notSaved: '尚未保存',
  load: '读取',
  delete: '删除',
  people: '人',
  loaded: '已读取存档',
  loadFailed: '读取失败',
  // 设置
  sound: '音效',
  autoRotate: '镜头自动旋转',
  language: '语言',
  on: '开',
  off: '关',
  // 关于
  aboutP1: '《神明小岛》是一款 3D 文明演化模拟游戏。你扮演一座小岛的守护神，引导子民从远古篝火一路走向星辰大海。',
  aboutP2: '历经七个纪元，建造奇观，回应祈祷，施展神迹，最终发射方舟飞向宇宙。',
  // HUD
  food: '食物',
  wood: '木材',
  gold: '金币',
  faith: '信仰',
  pop: '人口',
  happy: '幸福',
  eraUp: '时代跃迁',
  finalEra: '最终纪元',
  launchArk: '发射方舟',
  fillExpand: '填海扩岛',
  cancelSelect: '取消选择',
  clickSeaAnywhere: '点击海面任意位置 / Esc',
  islandMax: '岛屿已达最大',
  save: '存档',
  // Toast
  tipBuild: '点击下方卡片，在岛上放置建筑',
  tipGoal: '目标：发展人口，建造奇观，让文明跃迁！',
  // 时代副标题
  eraSub1: '远古纪元',
  eraSub2: '石器纪元',
  eraSub3: '青铜纪元',
  eraSub4: '封建纪元',
  eraSub5: '工业纪元',
  eraSub6: '信息纪元',
  eraSub7: '星际纪元',
  // 纪元序号
  eraNum: '第',
  eraSuffix: '纪元',
  // 胜利
  finalPop: '最终人口',
  totalBuildings: '建筑总数',
  eraWonders: '时代奇观',
  civJourney: '文明历程',
  playAgain: '再玩一次',
  // 建造
  built: '已建成',
};

const EN: Dict = {
  start: 'Start Game',
  loadSave: 'Load Save',
  settings: 'Settings',
  about: 'About',
  back: 'Back',
  saveList: 'Save List',
  slot: 'Slot',
  empty: 'Empty',
  notSaved: 'Not saved',
  load: 'Load',
  delete: 'Delete',
  people: '',
  loaded: 'Save loaded',
  loadFailed: 'Load failed',
  sound: 'Sound',
  autoRotate: 'Auto Rotate',
  language: 'Language',
  on: 'On',
  off: 'Off',
  aboutP1: 'Deus Isle is a 3D civilization evolution sim. You are the guardian deity of a small island, guiding your people from ancient campfires to the sea of stars.',
  aboutP2: 'Through seven eras, build wonders, answer prayers, cast miracles, and finally launch the Ark into the cosmos.',
  food: 'Food',
  wood: 'Wood',
  gold: 'Gold',
  faith: 'Faith',
  pop: 'Pop',
  happy: 'Happy',
  eraUp: 'Era Up',
  finalEra: 'Final Era',
  launchArk: 'Launch Ark',
  fillExpand: 'Expand Island',
  cancelSelect: 'Cancel',
  clickSeaAnywhere: 'Click anywhere on sea / Esc',
  islandMax: 'Island at max',
  save: 'Save',
  tipBuild: 'Click cards below to place buildings',
  tipGoal: 'Goal: grow population, build wonders, advance civilization!',
  eraSub1: 'Ancient Era',
  eraSub2: 'Stone Era',
  eraSub3: 'Bronze Era',
  eraSub4: 'Feudal Era',
  eraSub5: 'Industrial Era',
  eraSub6: 'Info Era',
  eraSub7: 'Stellar Era',
  eraNum: 'Era',
  eraSuffix: '',
  finalPop: 'Final Pop',
  totalBuildings: 'Buildings',
  eraWonders: 'Wonders',
  civJourney: 'Journey',
  playAgain: 'Play Again',
  built: 'Built',
};

const DICTS: Record<Lang, Dict> = { zh: ZH, en: EN };

export function t(key: string): string {
  return DICTS[_lang][key] ?? key;
}

/** 给文档里所有带 data-i18n 的元素应用翻译 */
export function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });
}
