/* ================= 多语言支持（中/英） ================= */

export type Lang = 'zh' | 'en';

export type TKey =
  | 'start' | 'loadSave' | 'settings' | 'about' | 'back'
  | 'saveList' | 'slot' | 'empty' | 'notSaved' | 'load' | 'delete' | 'people'
  | 'sound' | 'autoRotate' | 'language' | 'on' | 'off'
  | 'aboutP1' | 'aboutP2'
  // HUD
  | 'food' | 'wood' | 'gold' | 'faith' | 'pop' | 'happy'
  | 'eraUp' | 'finalEra' | 'launch' | 'expand' | 'cancelExpand' | 'maxExpand'
  | 'expandHint' | 'expandHint2'
  // 提示
  | 'tipBuild' | 'tipGoal' | 'saveOk' | 'saveFail' | 'loadOk' | 'loadFail'
  | 'tipSettings' | 'tipAbout'
  // 建造栏
  | 'built'
  // 存档面板
  | 'saveTitle' | 'autoHint'
  // 胜利
  | 'vPop' | 'vBuildings' | 'vWonders' | 'vTime' | 'again';

const dict: Record<Lang, Record<TKey, string>> = {
  zh: {
    start: '开始游戏',
    loadSave: '读取存档',
    settings: '设置',
    about: '关于',
    back: '返回',
    saveList: '存档列表',
    slot: '槽位',
    empty: '空',
    notSaved: '尚未保存',
    load: '读取',
    delete: '删除',
    people: '人',
    sound: '音效',
    autoRotate: '镜头自动旋转',
    language: '语言',
    on: '开',
    off: '关',
    aboutP1: '《神明小岛》是一款 3D 文明演化模拟游戏。你扮演一座小岛的守护神，引导子民从远古篝火一路走向星辰大海。',
    aboutP2: '历经七个纪元，建造奇观，回应祈祷，施展神迹，最终发射方舟飞向宇宙。',
    food: '食物',
    wood: '木材',
    gold: '金币',
    faith: '信仰',
    pop: '人口',
    happy: '幸福',
    eraUp: '时代跃迁',
    finalEra: '最终纪元',
    launch: '发射方舟',
    expand: '填海扩岛',
    cancelExpand: '取消选择',
    maxExpand: '岛屿已达最大',
    expandHint: '点击海面任意位置 / Esc',
    expandHint2: '建造「方舟发射台」以通关',
    tipBuild: '点击下方卡片，在岛上放置建筑',
    tipGoal: '目标：发展人口，建造奇观，让文明跃迁！',
    saveOk: '已保存到槽位',
    saveFail: '保存失败',
    loadOk: '已读取存档',
    loadFail: '读取失败',
    tipSettings: '设置功能开发中',
    tipAbout: '神明小岛 · Deus Isle — 文明演化模拟',
    built: '已建成',
    saveTitle: '存档 / 读档',
    autoHint: '自动存档会在每次操作后更新；手动档可保存 3 个独立进度。',
    vPop: '最终人口',
    vBuildings: '建筑总数',
    vWonders: '时代奇观',
    vTime: '文明历程',
    again: '再玩一次',
  },
  en: {
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
    sound: 'Sound',
    autoRotate: 'Auto Rotate',
    language: 'Language',
    on: 'On',
    off: 'Off',
    aboutP1: 'Deus Isle is a 3D civilization evolution sim. You play as the guardian deity of a small island, guiding your people from ancient campfires to the sea of stars.',
    aboutP2: 'Across seven eras, build wonders, answer prayers, perform miracles, and finally launch the ark into the cosmos.',
    food: 'Food',
    wood: 'Wood',
    gold: 'Gold',
    faith: 'Faith',
    pop: 'Pop',
    happy: 'Happy',
    eraUp: 'Era Up',
    finalEra: 'Final Era',
    launch: 'Launch Ark',
    expand: 'Expand Island',
    cancelExpand: 'Cancel',
    maxExpand: 'Max Size',
    expandHint: 'Click anywhere on sea / Esc',
    expandHint2: 'Build the Ark Launch Pad to win',
    tipBuild: 'Click a card below to place a building',
    tipGoal: 'Goal: grow population, build wonders, advance civilization!',
    saveOk: 'Saved to slot',
    saveFail: 'Save failed',
    loadOk: 'Save loaded',
    loadFail: 'Load failed',
    tipSettings: 'Settings coming soon',
    tipAbout: 'Deus Isle — Civilization Evolution Sim',
    built: 'Built',
    saveTitle: 'Save / Load',
    autoHint: 'Auto-save updates after each action; 3 manual slots available.',
    vPop: 'Final Population',
    vBuildings: 'Total Buildings',
    vWonders: 'Era Wonders',
    vTime: 'Civilization Duration',
    again: 'Play Again',
  },
};

let currentLang: Lang = 'zh';

export function getLang(): Lang {
  return currentLang;
}
export function setLang(l: Lang): void {
  currentLang = l;
}
export function t(key: TKey): string {
  return dict[currentLang][key] || dict.zh[key] || key;
}
/** 应用 i18n 到所有带 data-i18n 的元素 */
export function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as TKey;
    if (key) el.textContent = t(key);
  });
}
