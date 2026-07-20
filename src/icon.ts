/* ================= SVG 图标：基于 Iconify Web Component =================
 * 通过 <iconify-icon icon="mdi:fire"></iconify-icon> 渲染 SVG。
 * 提供两类 API：
 *   1. IC.xxx 常量 — 语义化的图标名，供新代码使用
 *   2. iconify(text) — 把字符串中嵌入的 emoji 自动替换为 SVG，兼容老代码
 */
export const IC = {
  // 资源 / HUD
  food: 'mdi:wheat',
  wood: 'ph:tree-fill',
  gold: 'mdi:circle-multiple',
  faith: 'mdi:star-shooting',
  pop: 'mdi:account-group',
  happy: 'mdi:emoticon-happy',
  // 时间 / 控制
  sun: 'mdi:weather-sunny',
  sunset: 'mdi:weather-sunset-down',
  moon: 'mdi:weather-night',
  soundOn: 'mdi:volume-high',
  soundOff: 'mdi:volume-mute',
  reset: 'mdi:reload',
  // 时代
  eraFire: 'mdi:fire',
  eraAmphora: 'fla:amphora',
  eraLantern: 'fla:lantern',
  eraFactory: 'mdi:factory',
  eraCity: 'mdi:city',
  eraGlobe: 'mdi:web',
  eraRocket: 'mdi:rocket',
  // 建筑
  house: 'mdi:home',
  farm: 'mdi:wheat',
  woodcutter: 'ph:tree-fill',
  market: 'mdi:store',
  temple: 'fla:torii',
  park: 'mdi:tree',
  wonder: 'mdi:bank',
  // 神迹
  rain: 'mdi:weather-pouring',
  meteor: 'mdi:meteor',
  bless: 'mdi:star-shooting',
  haste: 'mdi:hourglass',
  // 事件 / 提示
  ship: 'mdi:sail-boat',
  meteorShower: 'mdi:weather-night',
  fish: 'mdi:fish',
  eagle: 'mdi:bird',
  volcano: 'fla:volcano',
  star: 'mdi:star',
  camera: 'mdi:camera',
  baby: 'mdi:baby',
  skull: 'mdi:skull',
  warning: 'mdi:alert',
  pointDown: 'mdi:hand-pointing-down',
  target: 'mdi:target',
  bullhorn: 'mdi:bullhorn',
  check: 'mdi:check',
  // 通用按钮
  island: 'mdi:island',
  arrowUp: 'mdi:arrow-up-bold',
  mouse: 'mdi:mouse',
  chat: 'mdi:chat',
  sprout: 'mdi:sprout',
  scroll: 'mdi:scroll',
} as const;

export type IconName = (typeof IC)[keyof typeof IC];

/* emoji → iconify name 映射（用于 iconify() 自动转换） */
const EMOJI_MAP: Record<string, string> = {
  '🔥': IC.eraFire,
  '🌾': IC.food,
  '🪵': IC.wood,
  '🪙': IC.gold,
  '✨': IC.faith,
  '🧑': IC.pop,
  '😊': IC.happy,
  '☀️': IC.sun,
  '☀': IC.sun,
  '🌇': IC.sunset,
  '🌙': IC.moon,
  '🔊': IC.soundOn,
  '🔇': IC.soundOff,
  '↺': IC.reset,
  '🏝️': IC.island,
  '🏝': IC.island,
  '⏫': IC.arrowUp,
  '🖱️': IC.mouse,
  '🖱': IC.mouse,
  '💬': IC.chat,
  '🏛️': IC.wonder,
  '🏛': IC.wonder,
  '🚀': IC.eraRocket,
  '🌱': IC.sprout,
  '📜': IC.scroll,
  '📢': IC.bullhorn,
  '👶': IC.baby,
  '💀': IC.skull,
  '⚠️': IC.warning,
  '⚠': IC.warning,
  '👇': IC.pointDown,
  '🎯': IC.target,
  '✓': IC.check,
  '🏺': IC.eraAmphora,
  '🏮': IC.eraLantern,
  '🏭': IC.eraFactory,
  '🏙️': IC.eraCity,
  '🏙': IC.eraCity,
  '🌐': IC.eraGlobe,
  '🛖': IC.house,
  '🏪': IC.market,
  '⛩️': IC.temple,
  '⛩': IC.temple,
  '🌳': IC.park,
  '🌧️': IC.rain,
  '🌧': IC.rain,
  '☄️': IC.meteor,
  '☄': IC.meteor,
  '⏳': IC.haste,
  '🚢': IC.ship,
  '🌠': IC.meteorShower,
  '🐟': IC.fish,
  '🦅': IC.eagle,
  '🌋': IC.volcano,
  '🌟': IC.star,
  '📸': IC.camera,
};

/* 渲染单个图标为 HTML 字符串 */
export function icon(name: string, cls?: string): string {
  const c = cls ? ` class="${cls}"` : '';
  return `<iconify-icon icon="${name}"${c}></iconify-icon>`;
}

/* 把字符串中的 emoji 替换为对应的 <iconify-icon> */
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/gu;

export function iconify(text: string): string {
  if (!text) return text;
  return text.replace(EMOJI_RE, (e) => {
    const name = EMOJI_MAP[e];
    return name ? icon(name) : e;
  });
}
