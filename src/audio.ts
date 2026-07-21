import { $ } from './utils';
import { icon, IC } from './icon';

/* ================= 极简 WebAudio 音效合成 ================= */
let AC: AudioContext | null = null;
export let muted = false;
export function setMuted(v: boolean): void {
  muted = v;
}

function ac(): AudioContext {
  if (!AC) AC = new (window.AudioContext || (window as any).webkitAudioContext)();
  return AC;
}

export function beep(
  f: number,
  dur: number = 0.15,
  type: OscillatorType = 'sine',
  vol: number = 0.18,
  delay: number = 0,
  slide: number = 0,
): void {
  if (muted) return;
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    if (slide)
      o.frequency.exponentialRampToValueAtTime(
        Math.max(30, f + slide),
        a.currentTime + delay + dur,
      );
    g.gain.setValueAtTime(0, a.currentTime + delay);
    g.gain.linearRampToValueAtTime(vol, a.currentTime + delay + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + delay + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + delay);
    o.stop(a.currentTime + delay + dur + 0.05);
  } catch (e) {
    /* ignore */
  }
}

export const sfx = {
  build() {
    beep(300, 0.12, 'triangle', 0.22, 0, 180);
    beep(520, 0.1, 'sine', 0.14, 0.07);
  },
  faith() {
    beep(880, 0.25, 'sine', 0.12);
    beep(1320, 0.3, 'sine', 0.08, 0.08);
  },
  error() {
    beep(160, 0.18, 'square', 0.12, 0, -60);
  },
  click() {
    beep(660, 0.05, 'sine', 0.08);
  },
  miracle() {
    beep(220, 0.5, 'sawtooth', 0.1, 0, 660);
    beep(1100, 0.6, 'sine', 0.1, 0.15, 440);
  },
  boom() {
    beep(90, 0.5, 'sawtooth', 0.3, 0, -55);
    beep(50, 0.7, 'triangle', 0.3, 0.05, -25);
  },
  era() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => beep(f, 0.4, 'triangle', 0.16, i * 0.13));
  },
  pop() {
    beep(740, 0.07, 'sine', 0.1, 0, 240);
  },
  launch() {
    beep(60, 2.2, 'sawtooth', 0.25, 0, 140);
    beep(120, 2.0, 'triangle', 0.15, 0.3, 260);
  },
};

export function setupAudioToggle(): void {
  const btn = $('btn-mute');
  btn.onclick = () => {
    setMuted(!muted);
    btn.innerHTML = muted
      ? icon(IC.soundOff)
      : icon(IC.soundOn);
  };
}

export function unlockAudio(): void {
  ac();
}
