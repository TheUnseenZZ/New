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
  flyIn: 'easeOut',
  flip: 'back',
  stretch: 'elastic',
  swing: 'elastic',
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
  /** non-uniform scale (squash & stretch, flips) on top of `scale` */
  sx: number;
  sy: number;
}

export const identity = (): Xf => ({ alpha: 1, scale: 1, dx: 0, dy: 0, rot: 0, blur: 0, split: 0, sx: 1, sy: 1 });

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
    case 'flyIn': {
      // Each element flies in from its own direction, spinning into place.
      const a = hash(seed, 3, 7) * Math.PI * 2;
      const dist = size * 9 * (1 - p);
      x.dx = Math.cos(a) * dist;
      x.dy = Math.sin(a) * dist;
      x.rot = (hash(seed, 4, 7) - 0.5) * 2.4 * (1 - p);
      x.alpha = clamp01(lin * 4);
      break;
    }
    case 'flip':
      x.sx = Math.max(0.02, p);
      x.alpha = clamp01(lin * 3);
      break;
    case 'stretch':
      x.sy = 1 + 1.4 * (1 - p);
      x.sx = 1 - 0.45 * (1 - p);
      x.alpha = clamp01(lin * 4);
      break;
    case 'swing':
      x.rot = -0.9 * (1 - p);
      x.dy = -size * 0.2 * (1 - p);
      x.alpha = clamp01(lin * 4);
      break;
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
    if (
      x.alpha >= 0.85 &&
      Math.abs(x.scale - 1) <= 0.12 &&
      Math.abs(x.sx - 1) <= 0.15 &&
      Math.abs(x.sy - 1) <= 0.15 &&
      x.blur <= 3 &&
      Math.abs(x.dy) <= size * 0.12 &&
      Math.abs(x.dx) <= size * 0.12 &&
      Math.abs(x.rot) < 0.1
    ) {
      return p * dur;
    }
  }
  return dur;
}

export function exitXf(anim: ExitAnim, q: number, size: number, seed = 0): Xf {
  const x = identity();
  const p = EASE.easeInOut(clamp01(q));
  const lin = clamp01(q);
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
    case 'scatter': {
      // Words blast outward in different directions.
      const a = hash(seed, 5, 11) * Math.PI * 2;
      const dist = size * 8 * lin * lin;
      x.dx = Math.cos(a) * dist;
      x.dy = Math.sin(a) * dist;
      x.rot = (hash(seed, 6, 11) - 0.5) * 3 * lin;
      x.alpha = 1 - clamp01((lin - 0.5) * 2);
      break;
    }
    case 'fall':
      // Gravity: accelerate down with a little spin.
      x.dy = size * 14 * lin * lin;
      x.dx = (hash(seed, 7, 13) - 0.5) * size * 2 * lin;
      x.rot = (hash(seed, 8, 13) - 0.5) * 1.6 * lin;
      break;
    case 'pop':
      x.scale = 1 + 0.5 * lin;
      x.alpha = 1 - lin;
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
    sx: a.sx * b.sx,
    sy: a.sy * b.sy,
  };
}
