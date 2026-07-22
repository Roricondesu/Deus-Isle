/* ================= SVG 图标：基于 Iconify Web Component =================
 * 通过 <iconify-icon icon="mdi:fire"></iconify-icon> 渲染 SVG。
 * 提供语义化图标常量 IC 与 icon() 辅助函数。
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
  eraAmphora: 'mdi:grave-stone',
  eraLantern: 'mdi:lightbulb',
  eraFactory: 'mdi:factory',
  eraCity: 'mdi:city',
  eraGlobe: 'mdi:web',
  eraRocket: 'mdi:rocket',
  // 建筑
  house: 'mdi:home',
  farm: 'mdi:wheat',
  woodcutter: 'ph:tree-fill',
  market: 'mdi:store',
  temple: 'mdi:candle',
  park: 'mdi:tree',
  wonder: 'mdi:bank',
  // 神迹
  rain: 'mdi:weather-pouring',
  meteor: 'mdi:meteor',
  bless: 'mdi:star-shooting',
  haste: 'mdi:hourglass',
  calm: 'mdi:weather-windy',
  heal: 'mdi:hospital-box',
  // 危机
  drought: 'mdi:weather-sunny-alert',
  tsunami: 'mdi:waves',
  plague: 'mdi:virus',
  // 事件 / 提示
  ship: 'mdi:sail-boat',
  meteorShower: 'mdi:weather-night',
  fish: 'mdi:fish',
  eagle: 'mdi:bird',
  volcano: 'mdi:triangle',
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
  chevronDown: 'mdi:chevron-down',
  pause: 'mdi:pause',
} as const;

export type IconName = (typeof IC)[keyof typeof IC];

/* 渲染单个图标为 HTML 字符串 */
export function icon(name: string, cls?: string): string {
  const c = cls ? ` class="${cls}"` : '';
  return `<iconify-icon icon="${name}"${c}></iconify-icon>`;
}

/* 安全地处理纯文本：转义 HTML 特殊字符，不再做 emoji 转换 */
export function iconify(text: string): string {
  if (!text) return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
