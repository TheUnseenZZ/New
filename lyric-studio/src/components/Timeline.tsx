import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { formatTime, lineEnd, lineStart, setLineSpan, sortLines } from '../lib/lyrics';
import type { Line, Word } from '../lib/types';
import type { Peaks } from '../lib/waveform';

interface Props {
  lines: Line[];
  /** Update lines without recording undo history (used while dragging). */
  live: (fn: (prev: Line[]) => Line[]) => void;
  /** Save an undo point before a change. */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  duration: number;
  peaks: Peaks | null;
  /** Global timing offset: blocks are drawn where they actually render. */
  offset: number;
  seek: (t: number) => void;
}

type Sel = { lineId: string; word: number | null } | null;
type Mode = 'move' | 'start' | 'end';

const MIN = 0.05;
const RULER_H = 22;
const WAVE_H = 58;
const LINE_Y = RULER_H + WAVE_H + 6;
const LINE_H = 26;
const WORD_Y = LINE_Y + LINE_H + 6;
const WORD_H = 38;
const CONTENT_H = WORD_Y + WORD_H + 8;
const SNAP_PX = 8;
const TAP_KEY = 't';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export const Timeline = memo(function Timeline(p: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [viewW, setViewW] = useState(800);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [pps, setPps] = useState<number | null>(null); // px per second; null = fit
  const [sel, setSel] = useState<Sel>(null);
  const [speed, setSpeed] = useState(1);
  const [tap, setTap] = useState<{ on: boolean; idx: number }>({ on: false, idx: 0 });

  const duration = Math.max(p.duration || 0, p.lines.length ? lineEnd(p.lines[p.lines.length - 1]) + p.offset + 1 : 0, 1);
  const fitPps = Math.max(8, (viewW - 24) / duration);
  const scale = pps ?? fitPps;
  const contentW = Math.max(viewW, duration * scale + 24);
  const x = (t: number) => t * scale;

  // Keep latest values for event handlers without re-binding.
  const st = useRef({ ...p, scale, sel, tap, duration });
  st.current = { ...p, scale, sel, tap, duration };

  useLayoutEffect(() => {
    const el = scrollRef.current!;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Playhead + auto-follow, driven by rAF so the rest of the timeline doesn't re-render every frame.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = p.videoRef.current;
      const t = v?.currentTime ?? 0;
      const px = t * st.current.scale;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${px}px)`;
      if (timeRef.current) timeRef.current.textContent = formatTime(t);
      const sc = scrollRef.current;
      if (v && !v.paused && sc && !dragRef.current) {
        if (px > sc.scrollLeft + sc.clientWidth - 60 || px < sc.scrollLeft) sc.scrollLeft = px - sc.clientWidth * 0.2;
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [p.videoRef]);

  useEffect(() => {
    const v = p.videoRef.current;
    if (v) v.playbackRate = speed;
  }, [speed, p.videoRef, p.duration]);

  // Waveform + ruler, drawn only for the visible window.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = viewW * dpr;
    c.height = (RULER_H + WAVE_H) * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, viewW, RULER_H + WAVE_H);

    // ruler
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const step = steps.find((s) => s * scale >= 70) ?? 60;
    g.fillStyle = '#9a9aab';
    g.strokeStyle = '#3a3a48';
    g.font = '10px Inter, sans-serif';
    g.textBaseline = 'top';
    const t0 = scrollLeft / scale;
    const t1 = (scrollLeft + viewW) / scale;
    for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
      const px = x(t) - scrollLeft;
      g.beginPath();
      g.moveTo(px + 0.5, RULER_H - 8);
      g.lineTo(px + 0.5, RULER_H);
      g.stroke();
      g.fillText(step < 1 ? `${t.toFixed(step < 0.5 ? 2 : 1)}s` : formatTime(t).replace(/\.0$/, ''), px + 3, 3);
    }
    g.fillStyle = '#1b1b24';
    g.fillRect(0, RULER_H, viewW, WAVE_H);

    // waveform
    if (p.peaks) {
      const { data, rate } = p.peaks;
      const mid = RULER_H + WAVE_H / 2;
      g.fillStyle = 'rgba(37, 244, 238, 0.45)';
      for (let px = 0; px < viewW; px++) {
        const a = Math.floor(((scrollLeft + px) / scale) * rate);
        const b = Math.max(a + 1, Math.floor(((scrollLeft + px + 1) / scale) * rate));
        let m = 0;
        for (let i = a; i < b && i < data.length; i++) if (data[i] > m) m = data[i];
        const h = Math.max(1, m * (WAVE_H - 8));
        g.fillRect(px, mid - h / 2, 1, h);
      }
    } else {
      g.fillStyle = '#5a5a6a';
      g.fillText('waveform loads after you pick a video…', 8, RULER_H + WAVE_H / 2 - 5);
    }
  }, [p.peaks, scale, scrollLeft, viewW]);

  // ---- editing helpers ----------------------------------------------------------------------

  /** Snap raw time `t` to the playhead or other lines' edges (unless Alt is held). */
  const snap = useCallback((t: number, excludeLine: string, noSnap: boolean) => {
    if (noSnap) return t;
    const s = st.current;
    const targets: number[] = [(s.videoRef.current?.currentTime ?? 0) - s.offset];
    for (const l of s.lines) if (l.id !== excludeLine && l.words.length) targets.push(lineStart(l), lineEnd(l));
    let best = t;
    let bestD = SNAP_PX / s.scale;
    for (const tg of targets) {
      const d = Math.abs(tg - t);
      if (d < bestD) {
        best = tg;
        bestD = d;
      }
    }
    return best;
  }, []);

  /** Apply a drag of `dt` seconds to a snapshot of the line. */
  const applyDrag = (orig: Line, wi: number | null, mode: Mode, dt: number, noSnap: boolean): Line => {
    const ws = orig.words.map((w) => ({ ...w }));
    if (wi === null) {
      const s0 = lineStart(orig);
      const e0 = lineEnd(orig);
      if (mode === 'move') {
        let ns = snap(s0 + dt, orig.id, noSnap);
        const ne = snap(e0 + dt, orig.id, noSnap);
        if (ns === s0 + dt && ne !== e0 + dt) ns = ne - (e0 - s0); // end snapped instead
        ns = Math.max(0, ns);
        return { ...orig, words: ws.map((w) => ({ ...w, start: w.start + ns - s0, end: w.end + ns - s0 })) };
      }
      if (mode === 'start') return setLineSpan(orig, clamp(snap(s0 + dt, orig.id, noSnap), 0, e0 - MIN * ws.length), e0);
      return setLineSpan(orig, s0, Math.max(s0 + MIN * ws.length, snap(e0 + dt, orig.id, noSnap)));
    }
    const w = ws[wi];
    const prev: Word | undefined = ws[wi - 1];
    const next: Word | undefined = ws[wi + 1];
    const o = orig.words[wi];
    // Words that touch share an edge: trimming one moves its neighbour too (like a razor edit).
    const touchPrev = prev && Math.abs(orig.words[wi - 1].end - o.start) < 0.03;
    const touchNext = next && Math.abs(orig.words[wi + 1].start - o.end) < 0.03;
    const lo = prev ? (touchPrev ? prev.start + MIN : prev.end) : 0;
    const hi = next ? (touchNext ? next.end - MIN : next.start) : Infinity;
    if (mode === 'move') {
      const d = o.end - o.start;
      let s = snap(o.start + dt, orig.id, noSnap);
      const e = snap(o.end + dt, orig.id, noSnap);
      if (s === o.start + dt && e !== o.end + dt) s = e - d;
      const loM = prev ? prev.end : 0;
      const hiM = next ? next.start : Infinity;
      s = clamp(s, loM, hiM - d);
      w.start = s;
      w.end = s + d;
    } else if (mode === 'start') {
      w.start = clamp(snap(o.start + dt, orig.id, noSnap), lo, o.end - MIN);
      if (touchPrev) prev.end = w.start;
    } else {
      w.end = clamp(snap(o.end + dt, orig.id, noSnap), o.start + MIN, hi);
      if (touchNext) next.start = w.end;
    }
    return { ...orig, words: ws };
  };

  const dragRef = useRef<{
    lineId: string;
    wi: number | null;
    mode: Mode;
    x0: number;
    orig: Line;
    moved: boolean;
  } | null>(null);

  const onBlockDown = (e: React.PointerEvent, line: Line, wi: number | null, mode: Mode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { lineId: line.id, wi, mode, x0: e.clientX, orig: line, moved: false };
    setSel({ lineId: line.id, word: wi });
  };

  const onBlockMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < 3) return;
      d.moved = true;
      p.checkpoint();
    }
    const next = applyDrag(d.orig, d.wi, d.mode, dx / scale, e.altKey);
    p.live((prev) => prev.map((l) => (l.id === d.lineId ? next : l)));
  };

  const onBlockUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      if (d.wi === null) p.live((prev) => sortLines(prev));
    } else {
      const w = d.wi === null ? d.orig.words[0] : d.orig.words[d.wi];
      if (w) p.seek(w.start + p.offset);
    }
  };

  // Scrubbing on ruler / waveform / empty space.
  const scrubbing = useRef(false);
  const scrubTo = (clientX: number) => {
    const sc = scrollRef.current!;
    const px = clientX - sc.getBoundingClientRect().left + sc.scrollLeft;
    p.seek(clamp(px / scale, 0, duration));
  };

  // Ctrl/Cmd + wheel zooms around the mouse.
  useEffect(() => {
    const sc = scrollRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const s = st.current.scale;
      const mouseX = e.clientX - sc.getBoundingClientRect().left;
      const tAtMouse = (sc.scrollLeft + mouseX) / s;
      const nextScale = clamp(s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 8, 800);
      setPps(nextScale);
      requestAnimationFrame(() => (sc.scrollLeft = tAtMouse * nextScale - mouseX));
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);

  // ---- keyboard: nudge, set-to-playhead, tap-to-sync --------------------------------------------

  const flat = useMemo(() => p.lines.flatMap((l) => l.words.map((_, wi) => ({ lineId: l.id, wi }))), [p.lines]);
  const tapDown = useRef<{ lineId: string; wi: number } | null>(null);

  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };
    const updateWord = (lineId: string, _wi: number, fn: (ws: Word[]) => void) =>
      st.current.live((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const ws = l.words.map((w) => ({ ...w }));
          fn(ws);
          return { ...l, words: ws };
        }),
      );

    const onDown = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey) return;
      const s = st.current;
      const now = (s.videoRef.current?.currentTime ?? 0) - s.offset;

      if (s.tap.on && e.key.toLowerCase() === TAP_KEY) {
        e.preventDefault();
        if (e.repeat) return;
        const target = flat[s.tap.idx];
        if (!target) return;
        s.checkpoint();
        tapDown.current = target;
        // Previous word (possibly in the previous line) ends where this one starts, if it overran.
        const prevRef = flat[s.tap.idx - 1];
        if (prevRef) {
          updateWord(prevRef.lineId, prevRef.wi, (ws) => {
            if (ws[prevRef.wi].end > now) ws[prevRef.wi].end = Math.max(ws[prevRef.wi].start + MIN, now);
          });
        }
        updateWord(target.lineId, target.wi, (ws) => {
          const w = ws[target.wi];
          const d = Math.max(MIN, w.end - w.start);
          w.start = now;
          w.end = now + Math.min(d, 0.6);
        });
        setSel({ lineId: target.lineId, word: target.wi });
        return;
      }

      const sel = s.sel;
      if (!sel) return;
      const line = s.lines.find((l) => l.id === sel.lineId);
      if (!line) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const dt = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.1 : 1 / 30);
        s.checkpoint();
        const next = applyDrag(line, sel.word, 'move', dt, true);
        s.live((prev) => sortLines(prev.map((l) => (l.id === line.id ? next : l))));
      } else if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        s.checkpoint();
        if (sel.word === null) {
          const s0 = lineStart(line);
          const e0 = lineEnd(line);
          const next = e.key === '[' ? setLineSpan(line, Math.min(now, e0 - MIN), e0) : setLineSpan(line, s0, Math.max(now, s0 + MIN));
          s.live((prev) => sortLines(prev.map((l) => (l.id === line.id ? next : l))));
        } else {
          updateWord(line.id, sel.word, (ws) => {
            const w = ws[sel.word!];
            if (e.key === '[') w.start = Math.min(now, w.end - MIN);
            else w.end = Math.max(now, w.start + MIN);
          });
        }
      } else if (e.key.toLowerCase() === 'p' && sel.word !== null && !s.tap.on) {
        e.preventDefault();
        const cur = line.words[sel.word]?.emph;
        const next = cur === undefined ? true : cur === true ? false : undefined;
        s.checkpoint();
        s.live((prev) =>
          prev.map((l) =>
            l.id !== line.id
              ? l
              : {
                  ...l,
                  words: l.words.map((w, i) => {
                    if (i !== sel.word) return w;
                    const { emph: _drop, ...rest } = w;
                    void _drop;
                    return next === undefined ? rest : { ...rest, emph: next };
                  }),
                },
          ),
        );
      } else if (e.key === 'Tab' && sel.word !== null) {
        e.preventDefault();
        const i = flat.findIndex((f) => f.lineId === sel.lineId && f.wi === sel.word);
        const n = flat[clamp(i + (e.shiftKey ? -1 : 1), 0, flat.length - 1)];
        if (n) setSel({ lineId: n.lineId, word: n.wi });
      }
    };

    const onUp = (e: KeyboardEvent) => {
      const s = st.current;
      if (!s.tap.on || e.key.toLowerCase() !== TAP_KEY || !tapDown.current) return;
      const target = tapDown.current;
      tapDown.current = null;
      const now = (s.videoRef.current?.currentTime ?? 0) - s.offset;
      updateWord(target.lineId, target.wi, (ws) => {
        const w = ws[target.wi];
        // A quick tap keeps a sensible length; a hold sets the exact end.
        if (now - w.start > 0.12) w.end = now;
      });
      setTap((t) => ({ ...t, idx: Math.min(t.idx + 1, flat.length) }));
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [flat]);

  const selWord = sel && sel.word !== null ? p.lines.find((l) => l.id === sel.lineId)?.words[sel.word] : undefined;
  const setPayoff = (v: boolean | undefined) => {
    if (!sel || sel.word === null) return;
    p.checkpoint();
    p.live((prev) =>
      prev.map((l) =>
        l.id !== sel.lineId
          ? l
          : {
              ...l,
              words: l.words.map((w, i) => {
                if (i !== sel.word) return w;
                const { emph: _drop, ...rest } = w;
                void _drop;
                return v === undefined ? rest : { ...rest, emph: v };
              }),
            },
      ),
    );
  };

  const startTap = () => {
    if (tap.on) return setTap({ on: false, idx: 0 });
    const now = (p.videoRef.current?.currentTime ?? 0) - p.offset;
    // Start from the selected word, else the first word at/after the playhead.
    let idx = sel && sel.word !== null ? flat.findIndex((f) => f.lineId === sel.lineId && f.wi === sel.word) : -1;
    if (idx < 0) {
      idx = flat.findIndex((f) => {
        const l = p.lines.find((x) => x.id === f.lineId)!;
        return l.words[f.wi].start >= now - 0.3;
      });
    }
    setTap({ on: true, idx: Math.max(0, idx) });
    scrollRef.current?.focus();
  };

  const tapTarget = tap.on ? flat[tap.idx] : undefined;
  const tapWord = tapTarget ? p.lines.find((l) => l.id === tapTarget.lineId)?.words[tapTarget.wi]?.text : undefined;

  // Only render blocks near the viewport (long songs have hundreds of words).
  const visT0 = scrollLeft / scale - 2;
  const visT1 = (scrollLeft + viewW) / scale + 2;

  return (
    <section className="panel timeline">
      <div className="tl-toolbar">
        <button className="btn small" onClick={p.undo} title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button className="btn small" onClick={p.redo} title="Redo (Ctrl+Shift+Z)">
          ↷
        </button>
        <span className="tl-sep" />
        <span className="muted small-text">Zoom</span>
        <input
          type="range"
          className="tl-zoom"
          min={Math.log(8)}
          max={Math.log(800)}
          step={0.01}
          value={Math.log(scale)}
          onChange={(e) => setPps(Math.exp(Number(e.target.value)))}
        />
        <button className="btn small" onClick={() => setPps(null)}>
          Fit
        </button>
        <span className="tl-sep" />
        <span className="muted small-text">Speed</span>
        <div className="seg tl-speed">
          {[0.5, 0.75, 1].map((s) => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <span className="tl-sep" />
        <button className={`btn small${tap.on ? ' primary' : ''}`} onClick={startTap} disabled={!flat.length}>
          {tap.on ? '■ Stop tap-sync' : '● Tap-sync'}
        </button>
        {tap.on && (
          <span className="small-text tl-tap">
            Hold <kbd>T</kbd> while each word is sung · next: <b>{tapWord ?? 'done ✓'}</b>
          </span>
        )}
        {selWord && (
          <>
            <span className="tl-sep" />
            <span className="muted small-text">
              Payoff “{selWord.text.replace(/\*/g, '')}”
            </span>
            <div className="seg tl-speed" title="Give this word its own moment (P cycles)">
              {(
                [
                  [undefined, 'Auto'],
                  [true, '★ On'],
                  [false, 'Off'],
                ] as const
              ).map(([v, label]) => (
                <button key={label} className={selWord.emph === v ? 'on' : ''} onClick={() => setPayoff(v)}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        <span className="spacer" />
        <span className="small-text muted tl-help">
          Drag blocks · drag edges to trim · <kbd>Alt</kbd> no snap · <kbd>←</kbd>
          <kbd>→</kbd> nudge · <kbd>[</kbd>
          <kbd>]</kbd> set start/end · <kbd>P</kbd> payoff
        </span>
        <span className="time" ref={timeRef} />
      </div>
      <div
        className="tl-scroll"
        ref={scrollRef}
        tabIndex={0}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          scrubbing.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setSel(null);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => scrubbing.current && scrubTo(e.clientX)}
        onPointerUp={() => (scrubbing.current = false)}
      >
        <div className="tl-content" style={{ width: contentW, height: CONTENT_H }}>
          <canvas
            ref={canvasRef}
            className="tl-wave"
            style={{ left: scrollLeft, width: viewW, height: RULER_H + WAVE_H }}
          />
          <div className="tl-lane-label" style={{ top: LINE_Y, left: scrollLeft + 4 }}>
            lines
          </div>
          <div className="tl-lane-label" style={{ top: WORD_Y, left: scrollLeft + 4 }}>
            words
          </div>
          {p.lines.map((l) => {
            if (!l.words.length) return null;
            const s0 = lineStart(l) + p.offset;
            const e0 = lineEnd(l) + p.offset;
            if (e0 < visT0 || s0 > visT1) return null;
            const lineSel = sel?.lineId === l.id && sel.word === null;
            return (
              <div key={l.id}>
                <Block
                  className={`tl-line${lineSel ? ' sel' : ''}`}
                  left={x(s0)}
                  width={x(e0) - x(s0)}
                  top={LINE_Y}
                  height={LINE_H}
                  label={l.words.map((w) => w.text).join(' ')}
                  onDown={(e, mode) => onBlockDown(e, l, null, mode)}
                  onMove={onBlockMove}
                  onUp={onBlockUp}
                />
                {l.words.map((w, wi) => {
                  const ws = w.start + p.offset;
                  const we = w.end + p.offset;
                  const isSel = sel?.lineId === l.id && sel.word === wi;
                  const isTap = tapTarget?.lineId === l.id && tapTarget.wi === wi;
                  return (
                    <Block
                      key={wi}
                      className={`tl-word${isSel ? ' sel' : ''}${isTap ? ' tap' : ''}${w.emph === true ? ' payoff-on' : w.emph === false ? ' payoff-off' : ''}`}
                      left={x(ws)}
                      width={x(we) - x(ws)}
                      top={WORD_Y}
                      height={WORD_H}
                      label={w.text}
                      onDown={(e, mode) => onBlockDown(e, l, wi, mode)}
                      onMove={onBlockMove}
                      onUp={onBlockUp}
                    />
                  );
                })}
              </div>
            );
          })}
          <div className="tl-playhead" ref={playheadRef} style={{ height: CONTENT_H }} />
        </div>
      </div>
    </section>
  );
});

function Block(b: {
  className: string;
  left: number;
  width: number;
  top: number;
  height: number;
  label: string;
  onDown: (e: React.PointerEvent, mode: Mode) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
}) {
  const w = Math.max(4, b.width);
  // Tiny blocks keep a draggable middle; handles shrink to fit.
  const handle = Math.min(8, Math.max(2, w / 4));
  return (
    <div
      className={b.className}
      style={{ left: b.left, width: w, top: b.top, height: b.height }}
      title={b.label}
      onPointerDown={(e) => b.onDown(e, 'move')}
      onPointerMove={b.onMove}
      onPointerUp={b.onUp}
      onPointerCancel={b.onUp}
    >
      <span className="tl-label">{b.label}</span>
      <div className="tl-h l" style={{ width: handle }} onPointerDown={(e) => b.onDown(e, 'start')} />
      <div className="tl-h r" style={{ width: handle }} onPointerDown={(e) => b.onDown(e, 'end')} />
    </div>
  );
}
