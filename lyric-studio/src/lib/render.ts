import { clamp01, combine, EASE, enterXf, exitXf, hash, identity, readyTime, type Xf } from './anim';
import { H, SAFE_RECT, W } from './tiktok';
import type { EnterAnim, Line, Settings, Template, Word } from './types';

export interface Group {
  index: number;
  words: Word[];
  start: number;
  end: number;
  /** when the group becomes visible (start - ready - lead) */
  showFrom: number;
  /** when the next group takes over (or end + hold) */
  showUntil: number;
  /** when it's fully gone (showUntil, or later if the exit overlaps the next group) */
  hideAt: number;
  /** payoff word (template emphasis) */
  emph: boolean;
}

interface Placed {
  k: number;
  text: string;
  /** word center */
  x: number;
  y: number;
  /** unscaled text width */
  w: number;
  /** per-word size and rotation (scatter / zigzag / stairs) */
  s: number;
  r: number;
}

interface Layout {
  words: Placed[];
  px: number;
  font: string;
  spacing: string;
  /** block center, the pivot for group-level transforms */
  bx: number;
  by: number;
  /** text block bounds, for cards and bouncing */
  box: { x: number; y: number; w: number; h: number };
}

const EDGE_PUNCT = /^[.,;:"“”«»…]+|[.,;:"“”«»…]+$/g;
/** Users mark payoff words in the editor by wrapping them in stars: *strangers* */
export const isMarked = (text: string) => /^\*.+\*[.,!?;:]*$/.test(text) || /^\*[^*]+$/.test(text);
const stripMarks = (text: string) => text.replace(/\*/g, '');

/** Sensible durations when the user swaps a template's entrance animation. */
const ENTER_MS: Record<EnterAnim, number> = {
  none: 1,
  fade: 300,
  pop: 220,
  slam: 150,
  zoom: 250,
  slideUp: 300,
  slideDown: 300,
  blur: 450,
  drop: 450,
  spin: 350,
  glitch: 260,
  typewriter: 1,
  flyIn: 450,
  flip: 300,
  stretch: 450,
  swing: 500,
};

const DEFAULT_EMPHASIS: NonNullable<Template['emphasis']> = {
  trigger: 'none',
  background: '#000000',
  fill: '#FFFFFF',
  scale: 1.2,
};

export function fontString(f: Template['font'], px: number) {
  return `${f.italic ? 'italic ' : ''}${f.weight} ${Math.round(px * 10) / 10}px "${f.family}", sans-serif`;
}

function contrastText(bg: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#000000' : '#FFFFFF';
}

/** Apply the user's customizations (fonts, motion, payoffs, colors) on top of a template. */
export function applyOverrides(tpl: Template, s: Settings): Template {
  const st = s.style ?? {};
  const t: Template = {
    ...tpl,
    font: { ...tpl.font },
    color: { ...tpl.color },
    layout: { ...tpl.layout },
    enter: { ...tpl.enter },
  };
  if (st.fontFamily) t.font.family = st.fontFamily;
  if (st.fontWeight) t.font.weight = st.fontWeight;
  if (st.italic !== undefined) t.font.italic = st.italic;
  if (st.case) t.font.case = st.case;
  if (st.mode) {
    t.layout.mode = st.mode;
    if (st.mode === 'chunk' && !t.layout.maxWords) t.layout.maxWords = 3;
  }
  if (st.placement) t.layout.placement = st.placement;
  if (st.enter) t.enter = { ...t.enter, anim: st.enter, duration: ENTER_MS[st.enter], easing: undefined };

  const accent = s.colorOverride.enabled ? s.colorOverride.accent : (tpl.active?.color ?? '#E01E26');
  if (s.colorOverride.enabled) {
    const { fill } = s.colorOverride;
    t.color = { ...t.color, fill, gradient: undefined, palette: undefined, letterPalette: undefined };
    t.active = tpl.active ? { ...tpl.active, color: accent, boxColor: accent } : { mode: 'color', color: accent };
  }

  // Every template supports payoff moments; ones without their own style get a blackout by default.
  const emph = { ...(tpl.emphasis ?? DEFAULT_EMPHASIS) };
  if (st.payoffs === 'lineEnd') emph.trigger = 'lineEnd';
  else if (st.payoffs === 'picked') emph.trigger = 'none';
  const bg = st.payoffBg;
  if (bg && bg !== 'template') {
    if (bg === 'none') {
      // Keep the video; templates without their own payoff style just show the word bigger.
      emph.background = undefined;
      if (!tpl.emphasis) emph.fill = undefined;
    } else {
      emph.background = bg === 'accent' ? accent : bg;
      emph.fill = contrastText(emph.background);
    }
  }
  t.emphasis = emph;
  return t;
}

/** Split lyric lines into on-screen groups according to the template's layout mode. */
export function buildGroups(lines: Line[], tpl: Template, offset: number): Group[] {
  const chunks: Word[][] = [];
  const emphChunks = new Set<Word[]>();
  const maxWords = Math.max(1, tpl.layout.maxWords ?? 3);
  const pushSegment = (ws: Word[]) => {
    if (!ws.length) return;
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
        if (!ph.length) continue;
        const n = Math.ceil(ph.length / maxWords);
        const size = Math.ceil(ph.length / n);
        for (let i = 0; i < ph.length; i += size) chunks.push(ph.slice(i, i + size));
      }
    }
  };
  const trigger = tpl.emphasis?.trigger ?? 'none';
  // A word's own On/Off always wins; *stars* count as On; otherwise the trigger decides.
  const isPayoff = (w: Word, i: number, n: number) =>
    w.emph === false ? false : w.emph === true || isMarked(w.text) || (trigger === 'lineEnd' && i === n - 1 && n > 1);

  for (const line of lines) {
    const ws = line.words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset }));
    if (!ws.length) continue;
    // Payoff words become their own group; everything between them groups normally.
    let seg: Word[] = [];
    ws.forEach((w, i) => {
      if (!isPayoff(w, i, ws.length)) return void seg.push(w);
      pushSegment(seg);
      seg = [];
      const single = [w];
      chunks.push(single);
      emphChunks.add(single);
    });
    pushSegment(seg);
  }
  chunks.sort((a, b) => a[0].start - b[0].start);

  // Every template makes the first word readable exactly when it's sung: start the entrance early by
  // its "ready" time. `lead` only pre-shows whole groups (reveal "all", e.g. karaoke lines).
  const ready = readyTime(tpl.enter.anim, tpl.enter.duration, tpl.enter.easing);
  const lead = tpl.reveal === 'all' ? (tpl.timing?.lead ?? 0) : 0;
  const hold = tpl.timing?.hold ?? 0.6;
  const overlapExit = tpl.exit.overlap && tpl.exit.anim !== 'none' ? tpl.exit.duration / 1000 : 0;
  const groups: Group[] = chunks.map((words, index) => ({
    index,
    words,
    start: words[0].start,
    end: words[words.length - 1].end,
    showFrom: Math.max(0, words[0].start - lead - ready),
    showUntil: 0,
    hideAt: 0,
    emph: emphChunks.has(words),
  }));
  groups.forEach((g, i) => {
    const next = groups[i + 1];
    let until = g.end + hold;
    if (next) until = Math.min(until, next.showFrom);
    g.showUntil = Math.max(until, g.showFrom + 0.08);
    g.hideAt = g.showUntil + overlapExit;
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

/** 0→1→0 triangle wave, for bouncing off edges. */
const tri = (u: number) => 1 - Math.abs((((u % 2) + 2) % 2) - 1);

export class CaptionRenderer {
  tpl!: Template;
  settings!: Settings;
  groups: Group[] = [];
  /**
   * Canvas pixels per layout pixel (2 when exporting 4K, 0.2 for gallery thumbnails). Shadows and
   * blur filters ignore the canvas transform, so they're multiplied by this to look the same at any size.
   */
  pixelScale = 1;
  /** In transparent (overlay) mode, also draw the style's darkening and vignette layers. */
  overlayShading = false;
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
    const raw = stripMarks(text) || text;
    let t = this.settings.stripPunctuation ? raw.replace(EDGE_PUNCT, '') : raw;
    if (!t) t = raw;
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
    const placement = T.layout.placement ?? 'block';
    const perWord = placement === 'scatter' || placement === 'stairs' || placement === 'zigzag';
    const maxW = SAFE_RECT.w * (T.layout.maxWidth ?? 0.9);
    const maxLines = perWord ? 99 : (T.layout.maxLines ?? 3);
    const texts = g.words.map((w) => this.displayText(w.text));

    let px = f.size * this.settings.sizeScale * (g.emph ? (T.emphasis?.scale ?? 1) : 1);
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

    const S = SAFE_RECT;
    const lineH = px * (f.lineHeight ?? 1.1);
    const anchorY = (blockH: number) => {
      let cy =
        T.layout.anchor === 'upper'
          ? S.y + S.h * 0.25
          : T.layout.anchor === 'lower'
            ? S.bottom - blockH / 2 - 40
            : H / 2;
      cy += this.settings.yOffset * S.h;
      const pad = px * 0.3;
      return Math.min(Math.max(cy, S.y + blockH / 2 + pad), S.bottom - blockH / 2 - pad);
    };

    const words: Placed[] = [];
    const jitter = T.layout.sizeJitter ?? 0;
    const sizeOf = (k: number) => {
      if (!jitter) return 1;
      const s = 1 + (hash(g.index, k, 21) - 0.5) * 2 * jitter;
      return Math.max(0.55, Math.min(1.8, s));
    };
    // Keep scaled words inside the safe width.
    const fitS = (k: number, s: number) => Math.min(s, (S.w - 20) / Math.max(1, widths[k]));

    if (placement === 'scatter') {
      // Throw words around a region of the safe zone, avoiding overlaps where possible.
      const regionH = S.h * 0.72;
      const cy = anchorY(regionH);
      const top = cy - regionH / 2;
      const boxes: { x: number; y: number; w: number; h: number }[] = [];
      const tilt = ((T.fx?.tilt ?? 10) * Math.PI) / 180;
      texts.forEach((text, k) => {
        const s = fitS(k, sizeOf(k));
        const w = widths[k] * s;
        const h = px * s * 1.05;
        let best = { x: W / 2, y: cy, overlap: Infinity };
        for (let c = 0; c < 40; c++) {
          const x = S.x + w / 2 + hash(g.index * 131 + k, c, 41) * Math.max(0, S.w - w);
          const y = top + h / 2 + hash(g.index * 131 + k, c, 43) * Math.max(0, regionH - h);
          let overlap = 0;
          for (const b of boxes) {
            const ox = Math.max(0, Math.min(x + w / 2, b.x + b.w) - Math.max(x - w / 2, b.x));
            const oy = Math.max(0, Math.min(y + h / 2, b.y + b.h) - Math.max(y - h / 2, b.y));
            overlap += ox * oy;
          }
          if (overlap < best.overlap) best = { x, y, overlap };
          if (overlap === 0) break;
        }
        boxes.push({ x: best.x - w / 2, y: best.y - h / 2, w, h });
        words.push({ k, text, x: best.x, y: best.y, w: widths[k], s, r: (hash(g.index, k, 47) - 0.5) * 2 * tilt });
      });
    } else if (placement === 'stairs' || placement === 'zigzag') {
      const sizes = texts.map((_, k) => fitS(k, sizeOf(k)));
      const heights = sizes.map((s) => px * s * (f.lineHeight ?? 1.1));
      let total = heights.reduce((a, b) => a + b, 0);
      // Shrink everything if the column is taller than the safe zone.
      const shrink = Math.min(1, (S.h * 0.9) / total);
      total *= shrink;
      const cy = anchorY(total);
      let y = cy - total / 2;
      const n = texts.length;
      const widest = Math.max(...texts.map((_, k) => widths[k] * sizes[k] * shrink));
      const step = n > 1 ? Math.min((S.w - 40 - widest) / (n - 1), widest * 0.6) : 0;
      const stairW = step * (n - 1) + widest;
      const stairLeft = Math.max(S.x + 20, W / 2 - stairW / 2);
      texts.forEach((text, k) => {
        const s = sizes[k] * shrink;
        const w = widths[k] * s;
        const h = heights[k] * shrink;
        let x: number;
        if (placement === 'stairs') x = Math.min(S.right - 20 - w / 2, stairLeft + k * step + w / 2);
        else x = k % 2 === 0 ? S.x + 20 + w / 2 : S.right - 20 - w / 2;
        words.push({ k, text, x, y: y + h / 2, w: widths[k], s, r: 0 });
        y += h;
      });
    } else {
      // Block (also the base for orbit / wander / bounce).
      const blockH = rows.length * lineH;
      let cy = anchorY(blockH);
      rows.forEach((row, r) => {
        const sum = row.reduce((a, i) => a + widths[i], 0);
        const spread = T.layout.spread && row.length > 1;
        // Spread rows use the full allowed width with even gaps between words.
        const gap = spread ? (maxW - sum) / (row.length - 1) : space;
        const rowW = sum + gap * (row.length - 1);
        let x =
          T.layout.align === 'left'
            ? S.x + 24
            : Math.min(Math.max(W / 2, S.x + rowW / 2), S.right - rowW / 2) - rowW / 2;
        const y = cy - blockH / 2 + lineH * (r + 0.5);
        for (const i of row) {
          words.push({ k: i, text: texts[i], x: x + widths[i] / 2, y, w: widths[i], s: 1, r: 0 });
          x += widths[i] + gap;
        }
      });
      if (placement === 'wander') {
        // Each group lands somewhere new inside the safe zone.
        const minX = Math.min(...words.map((p) => p.x - p.w / 2));
        const maxX = Math.max(...words.map((p) => p.x + p.w / 2));
        const bw = maxX - minX;
        const nx = S.x + bw / 2 + hash(g.index, 1, 53) * Math.max(0, S.w - bw);
        const ny = S.y + blockH / 2 + px * 0.3 + hash(g.index, 2, 53) * Math.max(0, S.h - blockH - px * 0.6);
        const dx = nx - (minX + bw / 2);
        const dy = ny - cy;
        for (const p of words) (p.x += dx), (p.y += dy);
        cy = ny;
      }
    }

    // Bounds of everything placed (for cards, bouncing and group pivots).
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of words) {
      minX = Math.min(minX, p.x - (p.w * p.s) / 2);
      maxX = Math.max(maxX, p.x + (p.w * p.s) / 2);
      minY = Math.min(minY, p.y - (px * p.s) / 2);
      maxY = Math.max(maxY, p.y + (px * p.s) / 2);
    }
    const box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    const out: Layout = { words, px, font, spacing, bx: minX + box.w / 2, by: minY + box.h / 2, box };
    this.layouts.set(g.index, out);
    return out;
  }

  /** Draw one complete output frame at time t (seconds). */
  /**
   * `transparent` draws only what belongs on top of the footage (captions, dim, vignette, payoff
   * backgrounds, flashes) on a clear canvas, for overlaying in an editor. Effects that need the video
   * pixels themselves (camera punch-zoom, blurred fit background, film grain) are left out.
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    t: number,
    src: CanvasImageSource | null,
    sw: number,
    sh: number,
    transparent = false,
  ) {
    const fr = this.tpl.frame ?? {};
    // Most recent group start drives frame punches/flashes.
    let last: Group | undefined;
    for (const g of this.groups) {
      if (g.showFrom <= t) last = g;
      else break;
    }
    const since = last ? t - last.showFrom : 99;

    ctx.save();
    if (transparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }
    if (!transparent && src && sw && sh) {
      const zoom = 1 + (fr.punchZoom ?? 0) * (1 - EASE.easeOut(clamp01(since / 0.28)));
      this.drawSource(ctx, src, sw, sh, zoom);
    }
    const shade = !transparent || this.overlayShading;
    if (fr.dim && shade) {
      ctx.fillStyle = `rgba(0,0,0,${fr.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (fr.vignette && shade) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${fr.vignette})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const emphBg = this.tpl.emphasis?.background;
    if (emphBg && this.groups.some((g) => g.emph && g.showFrom <= t && t < g.showUntil)) {
      ctx.fillStyle = emphBg;
      ctx.fillRect(0, 0, W, H);
    }
    if (fr.flash && since < 0.15) {
      ctx.fillStyle = `rgba(255,255,255,${fr.flash * (1 - since / 0.15)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    this.drawCaptions(ctx, t);

    if (fr.grain && !transparent) this.drawGrain(ctx, fr.grain, t);
  }

  /**
   * Whether anything time-dependent is drawn at t (captions, payoff backgrounds, flashes). Frames where
   * this is false all look identical, which lets the overlay export encode them only once.
   */
  hasContent(t: number) {
    if (this.groups.some((g) => g.showFrom <= t && t < g.hideAt)) return true;
    const flash = this.tpl.frame?.flash;
    return !!flash && this.groups.some((g) => g.showFrom <= t && t - g.showFrom < 0.15);
  }

  private drawSource(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, zoom: number) {
    const cover = Math.max(W / sw, H / sh);
    if (this.settings.fit === 'contain') {
      ctx.save();
      ctx.filter = `blur(${40 * this.pixelScale}px) brightness(0.6)`;
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
      if (t >= g.hideAt) continue;
      this.drawGroup(ctx, g, t);
    }
  }

  private drawGroup(ctx: CanvasRenderingContext2D, g: Group, t: number) {
    const T = this.tpl;
    const L = this.layout(ctx, g);
    const fx = T.fx ?? {};
    const placement = T.layout.placement ?? 'block';
    const speed = T.layout.speed ?? 1;
    // Words start entering early by the animation's ready time, so they're readable as they're sung.
    const ready = readyTime(T.enter.anim, T.enter.duration, T.enter.easing);
    const enterDur = Math.max(0.001, T.enter.duration / 1000);
    const exitDur = T.exit.anim === 'none' ? 0 : Math.max(0.001, T.exit.duration / 1000);
    const stagger = (T.enter.stagger ?? 0) / 1000;
    const letters = !!(T.enter.letterStagger || fx.wave || T.color.letterPalette?.length);
    const groupLevelEnter = T.reveal === 'all' && stagger === 0 && !T.enter.letterStagger;

    // Group-level transform: enter (simple reveals), tilt, and moving placements.
    let gx = identity();
    if (groupLevelEnter) {
      gx = enterXf(T.enter.anim, (t - g.showFrom) / enterDur, T.enter.easing, L.px, g.index, t);
    }
    // Exit: after the last word is sung. Back-to-back groups hard-cut unless the exit overlaps.
    let exitQ = -1;
    if (exitDur) {
      if (T.exit.overlap) {
        if (t >= g.showUntil) exitQ = (t - g.showUntil) / exitDur;
      } else {
        const exitStart = Math.max(g.end, g.showUntil - exitDur);
        if (t > exitStart && exitStart < g.showUntil) exitQ = (t - exitStart) / (g.showUntil - exitStart);
      }
    }
    if (fx.tilt && placement !== 'scatter') gx.rot += ((hash(g.index, 0, 9) - 0.5) * 2 * fx.tilt * Math.PI) / 180;

    let bounceColor: string | undefined;
    if (placement === 'bounce') {
      // DVD-logo style: continuous motion across groups, bouncing off the safe-zone edges.
      const S = SAFE_RECT;
      const rx = Math.max(1, S.w - L.box.w);
      const ry = Math.max(1, S.h - L.box.h);
      const u = (t * 230 * speed) / rx;
      const v = (t * 170 * speed) / ry + 0.37;
      gx.dx += S.x + L.box.w / 2 + tri(u) * rx - L.bx;
      gx.dy += S.y + L.box.h / 2 + tri(v) * ry - L.by;
      const pal = T.color.palette;
      if (pal?.length) bounceColor = pal[(Math.floor(u) + Math.floor(v)) % pal.length];
    }

    let activeIdx = -1;
    g.words.forEach((w, k) => {
      if (w.start <= t) activeIdx = k;
    });
    const activeWord = g.words[activeIdx];
    const nextWord = g.words[activeIdx + 1];
    const activeLive = activeWord && t < Math.max(activeWord.end + 0.2, nextWord ? nextWord.start : 0);

    const emph = g.emph ? T.emphasis : undefined;
    const baseFill =
      emph?.fill ??
      bounceColor ??
      (T.color.palette?.length && placement !== 'bounce' ? T.color.palette[g.index % T.color.palette.length] : T.color.fill);
    const useGradient = !emph?.fill && !T.color.palette?.length && T.color.gradient && T.color.gradient.length > 1;
    // On a solid emphasis background, blend modes would just wash the text out.
    const blend = emph?.background ? undefined : T.color.blend;
    const act = T.active ?? { mode: 'none' as const };

    ctx.save();
    ctx.translate(L.bx + gx.dx, L.by + gx.dy);
    ctx.rotate(gx.rot);
    ctx.scale(gx.scale * gx.sx, gx.scale * gx.sy);
    ctx.translate(-L.bx, -L.by);

    const card = T.color.card;
    if (card && !(emph && emph.noCard) && L.words.some((pw) => t >= (T.reveal === 'all' ? g.showFrom : g.words[pw.k].start - ready))) {
      const pad = card.padding ?? L.px * 0.35;
      const ex = exitQ >= 0 ? exitXf(T.exit.anim, exitQ, L.px, g.index) : identity();
      ctx.save();
      ctx.globalAlpha *= clamp01(gx.alpha * ex.alpha);
      ctx.fillStyle = card.color;
      ctx.beginPath();
      ctx.roundRect(L.box.x - pad, L.box.y - pad * 0.6, L.box.w + pad * 2, L.box.h + pad * 1.2, card.radius ?? 0);
      ctx.fill();
      ctx.restore();
    }

    const n = L.words.length;
    for (const pw of L.words) {
      const w = g.words[pw.k];
      const appear = T.reveal === 'all' ? g.showFrom + pw.k * stagger : Math.max(g.showFrom, w.start - ready);
      if (t < appear) continue;
      const age = t - appear;

      // Group translate/rotate/scale are already on the ctx; alpha, blur and split carry per word.
      let x =
        groupLevelEnter || T.enter.letterStagger
          ? identity()
          : enterXf(T.enter.anim, age / enterDur, T.enter.easing, L.px, g.index * 97 + pw.k, t);
      x.alpha *= gx.alpha;
      x.blur += gx.blur;
      x.split += gx.split;
      // Each word exits on its own (so "scatter" / "fall" send words in different directions).
      if (exitQ >= 0) x = combine(x, exitXf(T.exit.anim, exitQ - pw.k * 0.04, L.px, g.index * 97 + pw.k));

      let px = pw.x;
      let py = pw.y;
      if (placement === 'orbit') {
        // Words ride a slowly turning ring around the block center; text stays upright.
        const R = Math.min(SAFE_RECT.w * 0.36, Math.max(L.px * 1.4, L.box.w * 0.35));
        const a = (pw.k / Math.max(1, n)) * Math.PI * 2 + t * speed * 0.9 + g.index;
        px = L.bx + Math.cos(a) * R;
        py = L.by + Math.sin(a) * R * 0.85;
      }

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
      if (fx.drift) {
        const a = hash(g.index, pw.k, 31) * Math.PI * 2;
        x.dx += Math.cos(a) * fx.drift * age;
        x.dy += Math.sin(a) * fx.drift * age;
      }
      if (fx.jelly) {
        const tt = age - enterDur * 0.6;
        if (tt > 0) {
          const amp = fx.jelly * Math.exp(-tt * 5) * Math.sin(tt * 24);
          x.sx *= 1 + amp;
          x.sy *= 1 - amp;
        }
      }
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
        const count = Math.ceil(clamp01((t - w.start) / dur) * text.length);
        text = text.slice(0, Math.max(1, count));
      }

      let fill = baseFill;
      if ((act.mode === 'color' && isActive) || (act.mode === 'sung' && isSung)) fill = act.color ?? fill;

      this.drawWord(ctx, { ...pw, x: px, y: py }, text, x, L, t, {
        fill,
        gradient: useGradient && fill === baseFill ? T.color.gradient : undefined,
        box: act.mode === 'box' && isActive ? act : undefined,
        underline: act.mode === 'underline' && isActive ? (act.color ?? fill) : undefined,
        blend,
        letters: letters ? { age, seed: g.index * 97 + pw.k, offset: pw.k * 3 } : undefined,
        solidFill: !!emph?.fill || !!bounceColor || fill !== baseFill,
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
    t: number,
    o: {
      fill: string;
      gradient?: string[];
      box?: Template['active'];
      underline?: string;
      blend?: string;
      letters?: { age: number; seed: number; offset: number };
      /** a highlight/payoff color that should win over the letter palette */
      solidFill?: boolean;
    },
  ) {
    if (x.alpha <= 0.001) return;
    const T = this.tpl;
    const px = L.px;
    const split = (T.fx?.rgbSplit ?? 0) + x.split;

    ctx.save();
    ctx.globalAlpha *= clamp01(x.alpha);
    ctx.translate(pw.x + x.dx, pw.y + x.dy);
    ctx.rotate(x.rot + pw.r);
    ctx.scale(x.scale * x.sx * pw.s, x.scale * x.sy * pw.s);
    const blur = x.blur + (T.fx?.soften ?? 0);
    if (blur > 0.3) ctx.filter = `blur(${(blur * this.pixelScale).toFixed(1)}px)`;
    if (o.blend && o.blend !== 'normal') ctx.globalCompositeOperation = o.blend as GlobalCompositeOperation;
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

    const { stroke, shadow, glow } = T.color;
    // Shadows are in device pixels and also ignore our scale transforms: compensate for both.
    const ps = this.pixelScale * Math.abs(x.scale * pw.s);
    const setShadow = () => {
      if (shadow) {
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = shadow.blur * ps;
        ctx.shadowOffsetX = shadow.x * ps;
        ctx.shadowOffsetY = shadow.y * ps;
      }
    };
    const clearShadow = () => {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    };

    /** Draw one run of text with split / glow / stroke / shadow / fill, left edge at lx. */
    const paint = (str: string, lx: number, fillStyle: string | CanvasGradient) => {
      if (split > 0.3) {
        ctx.save();
        ctx.globalAlpha *= 0.85;
        ctx.fillStyle = '#ff1f4b';
        ctx.fillText(str, lx - split, 0);
        ctx.fillStyle = '#19e6ff';
        ctx.fillText(str, lx + split, 0);
        ctx.restore();
      }
      if (glow) {
        ctx.save();
        ctx.shadowColor = glow.color;
        ctx.shadowBlur = glow.blur * ps;
        ctx.fillStyle = glow.color;
        ctx.fillText(str, lx, 0);
        ctx.restore();
      }
      if (stroke && stroke.width > 0) {
        setShadow();
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = stroke.width * 2;
        ctx.strokeStyle = stroke.color;
        ctx.strokeText(str, lx, 0);
        clearShadow();
      } else {
        setShadow();
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(str, lx, 0);
      clearShadow();
    };

    let fillStyle: string | CanvasGradient = o.fill;
    if (o.gradient) {
      const gr = ctx.createLinearGradient(0, -px * 0.5, 0, px * 0.5);
      o.gradient.forEach((c, i) => gr.addColorStop(i / (o.gradient!.length - 1), c));
      fillStyle = gr;
    }

    if (o.letters) {
      // Letter-by-letter: staggered entrances, a wave through the word, per-letter colors.
      const ls = (T.enter.letterStagger ?? 0) / 1000;
      const dur = Math.max(0.001, T.enter.duration / 1000);
      const wave = T.fx?.wave ?? 0;
      const pal = o.solidFill ? undefined : T.color.letterPalette;
      const chars = [...text];
      let prefix = '';
      chars.forEach((ch, i) => {
        const left = ctx.measureText(prefix).width;
        prefix += ch;
        if (ch === ' ') return;
        const cw = ctx.measureText(ch).width;
        const lx = ls ? enterXf(T.enter.anim, (o.letters!.age - i * ls) / dur, T.enter.easing, px, o.letters!.seed * 31 + i, t) : identity();
        if (ls && o.letters!.age < i * ls) return;
        if (lx.alpha <= 0.001) return;
        const wy = wave ? Math.sin(t * 5 + (i + o.letters!.offset) * 0.55) * wave : 0;
        ctx.save();
        ctx.globalAlpha *= clamp01(lx.alpha);
        ctx.translate(x0 + left + cw / 2 + lx.dx, wy + lx.dy);
        ctx.rotate(lx.rot);
        ctx.scale(lx.scale * lx.sx, lx.scale * lx.sy);
        if (lx.blur > 0.3) ctx.filter = `blur(${(lx.blur * this.pixelScale).toFixed(1)}px)`;
        paint(ch, -cw / 2, pal?.length ? pal[(i + o.letters!.offset) % pal.length] : fillStyle);
        ctx.restore();
      });
    } else {
      paint(text, x0, fillStyle);
    }

    if (o.underline) {
      ctx.fillStyle = o.underline;
      ctx.fillRect(x0, px * 0.5, ctx.measureText(text).width, Math.max(4, px * 0.07));
    }
    ctx.restore();
  }
}
