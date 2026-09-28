import { memo, useEffect, useRef, useState } from 'react';
import {
  formatTime,
  lineEnd,
  lineStart,
  lineText,
  mergeLines,
  newId,
  retimeLine,
  setLineSpan,
  sortLines,
  spreadWords,
} from '../lib/lyrics';
import type { Line } from '../lib/types';

interface Props {
  lines: Line[];
  setLines: (fn: (prev: Line[]) => Line[]) => void;
  time: number;
  seek: (t: number) => void;
}

export function LyricsEditor({ lines, setLines, time, seek }: Props) {
  const activeIdx = lines.findIndex((l) => time >= lineStart(l) - 0.05 && time < lineEnd(l) + 0.3);
  const listRef = useRef<HTMLDivElement>(null);
  const [showTimes, setShowTimes] = useState(false);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.line.active');
    if (el && document.activeElement?.tagName !== 'INPUT') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  const update = (id: string, fn: (l: Line) => Line | null) =>
    setLines((prev) => prev.flatMap((l) => (l.id === id ? (fn(l) ? [fn(l)!] : []) : [l])));

  const addAtPlayhead = () =>
    setLines((prev) =>
      sortLines([...prev, { id: newId(), words: spreadWords(['new', 'lyric'], time, time + 1.5) }]),
    );

  if (!lines.length) {
    return <div className="note">No lyrics yet. Upload a video and hit <b>Auto-caption</b>, or add lines by hand.</div>;
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn small" onClick={addAtPlayhead}>
          + Line at {formatTime(time)}
        </button>
        <label className="check small-text muted" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={showTimes} onChange={(e) => setShowTimes(e.target.checked)} />
          Edit timings
        </label>
      </div>
      <div className="lines" ref={listRef}>
        {lines.map((l, i) => (
          <LineRow
            key={l.id}
            line={l}
            active={i === activeIdx}
            showTimes={showTimes}
            canMerge={i < lines.length - 1}
            onSeek={() => seek(lineStart(l))}
            onText={(text) => update(l.id, (x) => (text.trim() ? retimeLine(x, text) : null))}
            onSpan={(s, e) => setLines((prev) => sortLines(prev.map((x) => (x.id === l.id ? setLineSpan(x, s, e) : x))))}
            onDelete={() => update(l.id, () => null)}
            onMerge={() =>
              setLines((prev) => {
                const j = prev.findIndex((x) => x.id === l.id);
                if (j < 0 || j >= prev.length - 1) return prev;
                const next = [...prev];
                next.splice(j, 2, mergeLines(prev[j], prev[j + 1]));
                return next;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

const LineRow = memo(function LineRow(p: {
  line: Line;
  active: boolean;
  showTimes: boolean;
  canMerge: boolean;
  onSeek: () => void;
  onText: (t: string) => void;
  onSpan: (s: number, e: number) => void;
  onDelete: () => void;
  onMerge: () => void;
}) {
  const text = lineText(p.line);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const commit = () => {
    if (draft !== text) p.onText(draft);
  };
  const s = lineStart(p.line);
  const e = lineEnd(p.line);

  return (
    <div className={`line${p.active ? ' active' : ''}`}>
      <button className="t" onClick={p.onSeek} title="Jump here">
        {formatTime(s)}
      </button>
      <input
        type="text"
        value={draft}
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
          if (ev.key === 'Escape') setDraft(text);
        }}
      />
      <div className="tools">
        <button className="btn ghost small" title="Merge with next line" onClick={p.onMerge} disabled={!p.canMerge}>
          ⤓
        </button>
        <button className="btn ghost small" title="Delete line" onClick={p.onDelete}>
          ✕
        </button>
      </div>
      {p.showTimes && (
        <div className="line-times">
          start
          <input
            type="number"
            step={0.05}
            value={s.toFixed(2)}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              if (Number.isFinite(v)) p.onSpan(Math.max(0, v), Math.max(v + 0.1, e + (v - s)));
            }}
          />
          end
          <input
            type="number"
            step={0.05}
            value={e.toFixed(2)}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              if (Number.isFinite(v)) p.onSpan(s, Math.max(s + 0.1, v));
            }}
          />
          <span>({(e - s).toFixed(1)}s)</span>
        </div>
      )}
    </div>
  );
});
