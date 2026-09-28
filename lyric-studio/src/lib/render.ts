import { clamp01, combine, EASE, enterXf, exitXf, hash, identity, type Xf } from './anim';
import { H, SAFE_RECT, W } from './tiktok';
import type { Line, Settings, Template, Word } from './types';

export interface Group {
  index: number;
  words: Word[];
  start: number;
  end: number;
  /** when the group becomes visible (start - lead) */
  showFrom: number;
  /** when it disappears (before the next group or end + hold) */
  showUntil: number;
}

interface Placed {
  k: number;
  text: string;
  /** word center */
  x: number;
  y: number;
  w: number;
}

interface Layout {
  words: Placed[];
  px: number;
  font: string;
  spacing: string;
  /** block center, the pivot for group-level transforms */
  bx: number;
  by: number;
}

const EDGE_PUNCT = /^[.,;:"“”«»…]+|[.,;:"“”«»…]+$/g;

export function fontString(f: Template['font'], px: number) {
  return `${f.italic ? 'italic ' : ''}${f.weight} ${Math.round(px * 10) / 10}px "${f.family}", sans-serif`;
}

/** Apply the user's color override on top of a template. */
export function applyOverrides(tpl: Template, s: Settings): Template {
  if (!s.colorOverride.enabled) return tpl;
  const { fill, accent } = s.colorOverride;
  return {
    ...tpl,
    color: { ...tpl.color, fill, gradient: undefined, palette: undefined },
    active: tpl.active ? { ...tpl.active, color: accent, boxColor: accent } : { mode: 'color', color: accent },
  };
}

/** Split lyric lines into on-screen groups according to the template's layout mode. */
export function buildGroups(lines: Line[], tpl: Template, offset: number): Group[] {
  const chunks: Word[][] = [];
  const maxWords = Math.max(1, tpl.layout.maxWords ?? 3);
  for (const line of lines) {
    const ws = line.words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset }));
    if (!ws.length) continue;
    if (tpl.layout.mode === 'line') {
      chunks.push(ws);
    } else if (tpl.layout.mode === 'word') {
      ws.forEach((w) => chunks.push([w]));
    } else {
      // Split on long pauses first, then into balanced chunks (7 words / max 3 → 3+2+2, not 3+3+1).
      const phrases: Word[][] = [[]];
      ws.forEach((w, i) => {
        if (i > 0 && w.start - ws[i - 1].end > 0.45) phrases.push([]);
        phrases[phrases.length - 1].push(w);
      });
      for (const ph of phrases) {
        const n = Math.ceil(ph.length / maxWords);
        const size = Math.ceil(ph.length / n);
        for (let i = 0; i < ph.length; i += size) chunks.push(ph.slice(i, i + size));
      }
    }
  }
  chunks.sort((a, b) => a[0].start - b[0].start);

  const lead = tpl.timing?.lead ?? 0.05;
  const hold = tpl.timing?.hold ?? 0.6;
  const groups: Group[] = chunks.map((words, index) => ({
    index,
    words,
    start: words[0].start,
    end: words[words.length - 1].end,
    showFrom: Math.max(0, words[0].start - lead),
    showUntil: 0,
  }));
  groups.forEach((g, i) => {
    const next = groups[i + 1];
    let until = g.end + hold;
    if (next) until = Math.min(until, next.showFrom);
    g.showUntil = Math.max(until, g.showFrom + 0.08);
  });
  return groups;
}

/** Wrap word widths into rows, balanced so rows have similar width (TikTok-style blocks). */
function wrap(widths: number[], space: number, maxW: number): number[][] {
  const greedy = (limit: number) => {
    const rows: number[][] = [[]];
    let cur = 0;
    widths.forEach((w, i) => {
      const row = rows[rows.length - 1];
      const add = row.length ? space + w : w;
      if (row.length && cur + add > limit) {
        rows.push([i]);
        cur = w;
      } else {
        row.push(i);
        cur += add;
      }
    });
    return rows;
  };
  const base = greedy(maxW);
  if (base.length < 2) return base;
  let lo = Math.max(...widths);
  let hi = maxW;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (greedy(mid).length <= base.length) hi = mid;
    else lo = mid;
  }
  return greedy(hi);
}

export class CaptionRenderer {
  tpl!: Template;
  settings!: Settings;
  groups: Group[] = [];
  private layouts = new Map<number, Layout>();
  private grain = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

  setData(lines: Line[], tpl: Template, settings: Settings) {
    this.tpl = applyOverrides(tpl, settings);
    this.settings = settings;
    this.groups = buildGroups(lines, this.tpl, settings.timingOffset);
    this.layouts.clear();
  }

  /** Call after web fonts finish loading so text gets re-measured. */
  invalidate() {
    this.layouts.clear();
  }

  displayText(text: string) {
    let t = this.settings.stripPunctuation ? text.replace(EDGE_PUNCT, '') : text;
    if (!t) t = text;
    const c = this.tpl.font.case;
    if (c === 'upper') t = t.toLocaleUpperCase();
    else if (c === 'lower') t = t.toLocaleLowerCase();
    return t;
  }

  private layout(ctx: CanvasRenderingContext2D, g: Group): Layout {
    const cached = this.layouts.get(g.index);
    if (cached) return cached;
    const T = this.tpl;
    const f = T.font;
    const maxW = SAFE_RECT.w * (T.layout.maxWidth ?? 0.9);
    const maxLines = T.layout.maxLines ?? 3;
    const texts = g.words.map((w) => this.displayText(w.text));

    let px = f.size * this.settings.sizeScale;
    let rows: number[][] = [];
    let widths: number[] = [];
    let space = 0;
    let font = '';
    let spacing = '0px';
    for (let attempt = 0; attempt < 12; attempt++) {
      font = fontString(f, px);
      spacing = `${(f.letterSpacing ?? 0) * px}px`;
      ctx.font = font;
      ctx.letterSpacing = spacing;
      widths = texts.map((t) => ctx.measureText(t).width);
      space = ctx.measureText(' ').width;
      const widest = Math.max(...widths);
      if (widest > maxW) {
        px *= (maxW / widest) * 0.98;
        continue;
      }
      rows = wrap(widths, space, maxW);
      if (rows.length > maxLines && px > 30) {
        px *= 0.9;
        continue;
      }
      break;
    }
    if (!rows.length) rows = wrap(widths, space, maxW);

    const lineH = px * (f.lineHeight ?? 1.1);
    const blockH = rows.length * lineH;
    const S = SAFE_RECT;
    let cy =
      T.layout.anchor === 'upper'
        ? S.y + S.h * 0.25
        : T.layout.anchor === 'lower'
          ? S.bottom - blockH / 2 - 40
          : H / 2;
    cy += this.settings.yOffset * S.h;
    const pad = px * 0.3;
    cy = Math.min(Math.max(cy, S.y + blockH / 2 + pad), S.bottom - blockH / 2 - pad);

    const words: Placed[] = [];
    let bx = W / 2;
    rows.forEach((row, r) => {
      const rowW = row.reduce((a, i) => a + widths[i], 0) + space * (row.length - 1);
      let x =
        T.layout.align === 'left'
          ? S.x + 24
          : Math.min(Math.max(W / 2, S.x + rowW / 2), S.right - rowW / 2) - rowW / 2;
      if (r === 0) bx = T.layout.align === 'left' ? S.x + 24 + rowW / 2 : x + rowW / 2;
      const y = cy - blockH / 2 + lineH * (r + 0.5);
      for (const i of row) {
        words.push({ k: i, text: texts[i], x: x + widths[i] / 2, y, w: widths[i] });
        x += widths[i] + space;
      }
    });
    const out = { words, px, font, spacing, bx, by: cy };
    this.layouts.set(g.index, out);
    return out;
  }

  /** Draw one complete output frame at time t (seconds). */
  drawFrame(ctx: CanvasRenderingContext2D, t: number, src: CanvasImageSource | null, sw: number, sh: number) {
    const fr = this.tpl.frame ?? {};
    // Most recent group start drives frame punches/flashes.
    let last: Group | undefined;
    for (const g of this.groups) {
      if (g.showFrom <= t) last = g;
      else break;
    }
    const since = last ? t - last.showFrom : 99;

    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (src && sw && sh) {
      const zoom = 1 + (fr.punchZoom ?? 0) * (1 - EASE.easeOut(clamp01(since / 0.28)));
      this.drawSource(ctx, src, sw, sh, zoom);
    }
    if (fr.dim) {
      ctx.fillStyle = `rgba(0,0,0,${fr.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (fr.vignette) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${fr.vignette})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (fr.flash && since < 0.15) {
      ctx.fillStyle = `rgba(255,255,255,${fr.flash * (1 - since / 0.15)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    this.drawCaptions(ctx, t);

    if (fr.grain) this.drawGrain(ctx, fr.grain, t);
  }

  private drawSource(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, zoom: number) {
    const cover = Math.max(W / sw, H / sh);
    if (this.settings.fit === 'contain') {
      ctx.save();
      ctx.filter = 'blur(40px) brightness(0.6)';
      const s = cover * 1.15;
      ctx.drawImage(src, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
      ctx.restore();
      const c = Math.min(W / sw, H / sh) * zoom;
      ctx.drawImage(src, (W - sw * c) / 2, (H - sh * c) / 2, sw * c, sh * c);
    } else {
      const s = cover * zoom;
      ctx.drawImage(src, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
    }
  }

  private drawGrain(ctx: CanvasRenderingContext2D, amount: number, t: number) {
    let pattern = this.grain.get(ctx);
    if (!pattern) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      pattern = ctx.createPattern(c, 'repeat')!;
      this.grain.set(ctx, pattern);
    }
    const tick = Math.floor(t * 24);
    const ox = Math.floor(hash(tick, 1) * 256);
    const oy = Math.floor(hash(tick, 2) * 256);
    ctx.save();
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = 'overlay';
    ctx.translate(ox, oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(-ox, -oy, W, H);
    ctx.restore();
  }

  drawCaptions(ctx: CanvasRenderingContext2D, t: number) {
    for (const g of this.groups) {
      if (g.showFrom > t) break;
      if (t >= g.showUntil) continue;
      this.drawGroup(ctx, g, t);
    }
  }

  private drawGroup(ctx: CanvasRenderingContext2D, g: Group, t: number) {
    const T = this.tpl;
    const L = this.layout(ctx, g);
    const fx = T.fx ?? {};
    const lead = T.timing?.lead ?? 0.05;
    const enterDur = Math.max(0.001, T.enter.duration / 1000);
    const exitDur = T.exit.anim === 'none' ? 0 : Math.max(0.001, T.exit.duration / 1000);
    const stagger = (T.enter.stagger ?? 0) / 1000;
    const groupLevelEnter = T.reveal === 'all' && stagger === 0;

    // Group-level transform: exit, tilt, and (for simple reveals) the enter animation.
    let gx = identity();
    if (groupLevelEnter) {
      gx = enterXf(T.enter.anim, (t - g.showFrom) / enterDur, T.enter.easing, L.px, g.index, t);
    }
    // Exit only once the last word is sung; back-to-back groups just hard-cut (TikTok style).
    const exitStart = Math.max(g.end, g.showUntil - exitDur);
    if (exitDur && t > exitStart && exitStart < g.showUntil) {
      gx = combine(gx, exitXf(T.exit.anim, (t - exitStart) / (g.showUntil - exitStart), L.px));
    }
    if (fx.tilt) gx.rot += ((hash(g.index, 0, 9) - 0.5) * 2 * fx.tilt * Math.PI) / 180;

    let activeIdx = -1;
    g.words.forEach((w, k) => {
      if (w.start <= t) activeIdx = k;
    });
    const activeWord = g.words[activeIdx];
    const nextWord = g.words[activeIdx + 1];
    const activeLive = activeWord && t < Math.max(activeWord.end + 0.2, nextWord ? nextWord.start : 0);

    const baseFill = T.color.palette?.length ? T.color.palette[g.index % T.color.palette.length] : T.color.fill;
    const useGradient = !T.color.palette?.length && T.color.gradient && T.color.gradient.length > 1;
    const act = T.active ?? { mode: 'none' as const };

    ctx.save();
    ctx.translate(L.bx + gx.dx, L.by + gx.dy);
    ctx.rotate(gx.rot);
    ctx.scale(gx.scale, gx.scale);
    ctx.translate(-L.bx, -L.by);

    for (const pw of L.words) {
      const w = g.words[pw.k];
      const appear = T.reveal === 'all' ? g.showFrom + pw.k * stagger : Math.max(g.showFrom, w.start - lead);
      if (t < appear) continue;
      const age = t - appear;

      // Group translate/rotate/scale are already on the ctx; alpha, blur and split carry per word.
      const x = groupLevelEnter
        ? identity()
        : enterXf(T.enter.anim, age / enterDur, T.enter.easing, L.px, g.index * 97 + pw.k, t);
      x.alpha *= gx.alpha;
      x.blur += gx.blur;
      x.split += gx.split;

      if (fx.shake) {
        const dur = (fx.shakeDuration ?? 180) / 1000;
        const since = T.reveal === 'all' ? t - g.showFrom : age;
        if (since < dur) {
          const amt = fx.shake * (1 - since / dur);
          const tick = Math.floor(t * 60);
          x.dx += (hash(g.index, tick, 11) - 0.5) * 2 * amt;
          x.dy += (hash(g.index, tick, 12) - 0.5) * 2 * amt;
        }
      }
      if (fx.wobble) x.rot += (Math.sin(t * 2.2 + pw.k * 1.3 + g.index) * fx.wobble * Math.PI) / 180;
      if (fx.float) x.dy += Math.sin(t * 1.6 + pw.k * 0.9 + g.index) * fx.float;
      if (fx.flicker && hash(g.index * 31 + pw.k, Math.floor(t * 20), 7) < fx.flicker) x.alpha *= 0.3;

      const isActive = pw.k === activeIdx && activeLive;
      const isSung = pw.k <= activeIdx;
      if (T.reveal === 'all' && !isSung && T.upcoming) x.alpha *= T.upcoming.opacity;
      if (act.scale && isActive) {
        x.scale *= 1 + (act.scale - 1) * EASE.easeOut(clamp01((t - w.start) / 0.1));
      }

      let text = pw.text;
      if (T.reveal === 'char' || T.enter.anim === 'typewriter') {
        const dur = Math.min(0.6, Math.max(0.12, w.end - w.start));
        const n = Math.ceil(clamp01((t - w.start) / dur) * text.length);
        text = text.slice(0, Math.max(1, n));
      }

      let fill = baseFill;
      if ((act.mode === 'color' && isActive) || (act.mode === 'sung' && isSung)) fill = act.color ?? fill;

      this.drawWord(ctx, pw, text, x, L, {
        fill,
        gradient: useGradient && fill === baseFill ? T.color.gradient : undefined,
        box: act.mode === 'box' && isActive ? act : undefined,
        underline: act.mode === 'underline' && isActive ? (act.color ?? fill) : undefined,
      });
    }
    ctx.restore();
  }

  private drawWord(
    ctx: CanvasRenderingContext2D,
    pw: Placed,
    text: string,
    x: Xf,
    L: Layout,
    o: { fill: string; gradient?: string[]; box?: Template['active']; underline?: string },
  ) {
    if (x.alpha <= 0.001) return;
    const T = this.tpl;
    const px = L.px;
    const split = (T.fx?.rgbSplit ?? 0) + x.split;

    ctx.save();
    ctx.globalAlpha *= clamp01(x.alpha);
    ctx.translate(pw.x + x.dx, pw.y + x.dy);
    ctx.rotate(x.rot);
    ctx.scale(x.scale, x.scale);
    if (x.blur > 0.3) ctx.filter = `blur(${x.blur.toFixed(1)}px)`;
    ctx.font = L.font;
    ctx.letterSpacing = L.spacing;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const x0 = -pw.w / 2;

    if (o.box) {
      const pad = o.box.boxPadding ?? px * 0.18;
      ctx.fillStyle = o.box.boxColor ?? '#7c3aed';
      ctx.beginPath();
      ctx.roundRect(x0 - pad, -px * 0.56 - pad * 0.45, pw.w + pad * 2, px * 1.08 + pad * 0.9, o.box.boxRadius ?? px * 0.18);
      ctx.fill();
    }

    if (split > 0.3) {
      ctx.save();
      ctx.globalAlpha *= 0.85;
      ctx.fillStyle = '#ff1f4b';
      ctx.fillText(text, x0 - split, 0);
      ctx.fillStyle = '#19e6ff';
      ctx.fillText(text, x0 + split, 0);
      ctx.restore();
    }

    let fillStyle: string | CanvasGradient = o.fill;
    if (o.gradient) {
      const gr = ctx.createLinearGradient(0, -px * 0.5, 0, px * 0.5);
      o.gradient.forEach((c, i) => gr.addColorStop(i / (o.gradient!.length - 1), c));
      fillStyle = gr;
    }

    const { stroke, shadow, glow } = T.color;
    const setShadow = () => {
      if (shadow) {
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = shadow.blur;
        ctx.shadowOffsetX = shadow.x;
        ctx.shadowOffsetY = shadow.y;
      }
    };
    const clearShadow = () => {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    };

    if (glow) {
      ctx.save();
      ctx.shadowColor = glow.color;
      ctx.shadowBlur = glow.blur;
      ctx.fillStyle = glow.color;
      ctx.fillText(text, x0, 0);
      ctx.restore();
    }
    if (stroke && stroke.width > 0) {
      setShadow();
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = stroke.width * 2;
      ctx.strokeStyle = stroke.color;
      ctx.strokeText(text, x0, 0);
      clearShadow();
    } else {
      setShadow();
    }
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x0, 0);
    clearShadow();

    if (o.underline) {
      ctx.fillStyle = o.underline;
      ctx.fillRect(x0, px * 0.5, ctx.measureText(text).width, Math.max(4, px * 0.07));
    }
    ctx.restore();
  }
}
