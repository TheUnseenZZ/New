import type { Easing, EnterAnim, ExitAnim } from './types';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const EASE: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c1 = 2.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

const DEFAULT_EASING: Record<EnterAnim, Easing> = {
  none: 'linear',
  fade: 'easeOut',
  pop: 'back',
  slam: 'easeOut',
  zoom: 'easeOut',
  slideUp: 'easeOut',
  slideDown: 'easeOut',
  blur: 'easeOut',
  drop: 'bounce',
  spin: 'back',
  glitch: 'linear',
  typewriter: 'linear',
};

export interface Xf {
  alpha: number;
  scale: number;
  dx: number;
  dy: number;
  rot: number;
  blur: number;
  /** extra rgb split during glitch-in */
  split: number;
}

export const identity = (): Xf => ({ alpha: 1, scale: 1, dx: 0, dy: 0, rot: 0, blur: 0, split: 0 });

/** Deterministic hash → [0,1). Export must look identical to preview, so no Math.random. */
export function hash(a: number, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Transform for an element that is `p` (0..1, un-eased) through its enter animation. */
export function enterXf(anim: EnterAnim, rawP: number, easing: Easing | undefined, size: number, seed: number, t: number): Xf {
  const x = identity();
  const p = EASE[easing ?? DEFAULT_EASING[anim]](clamp01(rawP));
  const lin = clamp01(rawP);
  switch (anim) {
    case 'fade':
      x.alpha = p;
      break;
    case 'pop':
      x.scale = 0.3 + 0.7 * p;
      x.alpha = clamp01(lin * 3);
      break;
    case 'slam':
      x.scale = 1.9 - 0.9 * p;
      x.alpha = clamp01(lin * 4);
      break;
    case 'zoom':
      x.scale = 0.6 + 0.4 * p;
      x.alpha = p;
      break;
    case 'slideUp':
      x.dy = (1 - p) * size * 0.6;
      x.alpha = p;
      break;
    case 'slideDown':
      x.dy = -(1 - p) * size * 0.6;
      x.alpha = p;
      break;
    case 'blur':
      x.blur = (1 - p) * 22;
      x.alpha = p;
      x.scale = 1.08 - 0.08 * p;
      break;
    case 'drop':
      x.dy = -(1 - p) * size * 2;
      x.alpha = clamp01(lin * 5);
      break;
    case 'spin':
      x.rot = (1 - p) * -0.6;
      x.scale = 0.4 + 0.6 * p;
      x.alpha = clamp01(lin * 3);
      break;
    case 'glitch': {
      if (lin < 1) {
        const tick = Math.floor(t * 30);
        x.dx = (hash(seed, tick, 1) - 0.5) * size * 0.5 * (1 - lin);
        x.dy = (hash(seed, tick, 2) - 0.5) * size * 0.15 * (1 - lin);
        x.alpha = hash(seed, tick, 3) < 0.3 ? 0.2 : 1;
        x.split = size * 0.12 * (1 - lin);
      }
      break;
    }
    case 'none':
    case 'typewriter':
      break;
  }
  return x;
}

/**
 * Seconds from the start of an enter animation until the text is readable (mostly opaque, near
 * full size, not blurred, roughly in place). The renderer starts animations this much before a
 * word is sung, so every template shows the word at the same moment regardless of its animation.
 */
export function readyTime(anim: EnterAnim, durationMs: number, easing: Easing | undefined): number {
  const dur = Math.max(0, durationMs) / 1000;
  if (!dur || anim === 'none' || anim === 'typewriter') return 0;
  if (anim === 'glitch') return dur * 0.5;
  const size = 100;
  for (let i = 0; i <= 50; i++) {
    const p = i / 50;
    const x = enterXf(anim, p, easing, size, 0, 0);
    if (x.alpha >= 0.85 && Math.abs(x.scale - 1) <= 0.12 && x.blur <= 3 && Math.abs(x.dy) <= size * 0.12 && Math.abs(x.rot) < 0.1) {
      return p * dur;
    }
  }
  return dur;
}

export function exitXf(anim: ExitAnim, q: number, size: number): Xf {
  const x = identity();
  const p = EASE.easeInOut(clamp01(q));
  switch (anim) {
    case 'fade':
      x.alpha = 1 - p;
      break;
    case 'blur':
      x.alpha = 1 - p;
      x.blur = p * 16;
      break;
    case 'slideUp':
      x.alpha = 1 - p;
      x.dy = -p * size * 0.5;
      break;
    case 'shrink':
      x.alpha = 1 - p;
      x.scale = 1 - 0.4 * p;
      break;
    case 'none':
      break;
  }
  return x;
}

export function combine(a: Xf, b: Xf): Xf {
  return {
    alpha: a.alpha * b.alpha,
    scale: a.scale * b.scale,
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    rot: a.rot + b.rot,
    blur: a.blur + b.blur,
    split: a.split + b.split,
  };
}
