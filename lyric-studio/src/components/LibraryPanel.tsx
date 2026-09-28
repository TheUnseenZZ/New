import { useRef, useState } from 'react';
import {
  decodeFingerprint,
  encodeFingerprint,
  findShift,
  loadLibrary,
  saveLibrary,
  shiftLines,
  type LibraryEntry,
} from '../lib/library';
import { newId } from '../lib/lyrics';
import type { Line, Settings } from '../lib/types';
import type { Peaks } from '../lib/waveform';

interface Props {
  lines: Line[];
  peaks: Peaks | null;
  settings: Settings;
  defaultName: string;
  hasVideo: boolean;
  /** Replace the project's lyrics (with undo), optionally also the style. */
  onUse: (lines: Line[], settings?: Settings) => void;
  /** Shift all current lyrics by dt seconds (with undo). */
  onShift: (dt: number) => void;
}

const CONFIDENT = 0.35;

export function LibraryPanel({ lines, peaks, settings, defaultName, hasVideo, onUse, onShift }: Props) {
  const [list, setList] = useState<LibraryEntry[]>(loadLibrary);
  const [withStyle, setWithStyle] = useState(false);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean; shift?: boolean } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const persist = (next: LibraryEntry[]) => {
    setList(next);
    const err = saveLibrary(next);
    if (err) setMsg({ text: err, warn: true });
  };

  const save = () => {
    const name = window.prompt('Save these synced lyrics as…', defaultName)?.trim();
    if (!name) return;
    const existing = list.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (existing && !window.confirm(`Replace the saved “${existing.name}”?`)) return;
    const entry: LibraryEntry = {
      id: existing?.id ?? newId(),
      name,
      savedAt: Date.now(),
      lines,
      audio: peaks ? encodeFingerprint(peaks) : undefined,
      settings,
    };
    persist([entry, ...list.filter((e) => e.id !== entry.id)]);
    setMsg({ text: `Saved “${name}”. Use it in any future project from this list.` });
  };

  const use = (e: LibraryEntry) => {
    if (lines.length && !window.confirm(`Replace your current lyrics with “${e.name}”?`)) return;
    let out = e.lines;
    let text = `Loaded “${e.name}”.`;
    let warn = false;
    if (e.audio && peaks) {
      const { shift, confidence } = findShift(decodeFingerprint(e.audio), peaks);
      const pct = Math.round(confidence * 100);
      if (confidence >= CONFIDENT) {
        out = shiftLines(e.lines, shift);
        text +=
          Math.abs(shift) < 0.05
            ? ` Audio matches (${pct}%), timings kept as saved.`
            : ` Found this clip in the song (${pct}% match) and moved the lyrics ${shift > 0 ? '+' : ''}${shift.toFixed(2)}s.`;
      } else {
        warn = true;
        text += ` Couldn't confidently find this clip in the saved song (${pct}% match), so timings are as saved. Use Shift below or drag lines in the timeline.`;
      }
    } else if (!e.audio) {
      text += ' It was saved without audio, so timings are as saved. Use Shift if needed.';
    } else {
      warn = true;
      text += ' The waveform is still loading, so it could not auto-align. Try again in a moment, or use Shift.';
    }
    // Keep the saved line ids unique in case the same lyrics are loaded twice.
    out = out.map((l) => ({ ...l, id: newId() }));
    onUse(out, withStyle ? e.settings : undefined);
    setMsg({ text, warn, shift: true });
  };

  const remove = (e: LibraryEntry) => {
    if (!window.confirm(`Delete “${e.name}” from your saved subtitles?`)) return;
    persist(list.filter((x) => x.id !== e.id));
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ version: 1, library: list }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lyric-studio-library.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  const importAll = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const incoming: LibraryEntry[] = Array.isArray(data?.library) ? data.library : [];
      const valid = incoming.filter((e) => e && typeof e.name === 'string' && Array.isArray(e.lines));
      if (!valid.length) throw new Error();
      const byId = new Map(list.map((e) => [e.id, e]));
      for (const e of valid) byId.set(e.id, e);
      persist([...byId.values()].sort((a, b) => b.savedAt - a.savedAt));
      setMsg({ text: `Imported ${valid.length} saved subtitle set${valid.length > 1 ? 's' : ''}.` });
    } catch {
      setMsg({ text: "That file isn't a Lyric Studio library export.", warn: true });
    }
  };

  return (
    <div className="library">
      <div className="row">
        <div className="section-title" style={{ flex: 1 }}>
          Saved subtitles
        </div>
        <button className="btn small" onClick={save} disabled={!lines.length} title="Save these synced lyrics for future projects">
          💾 Save current
        </button>
      </div>

      {list.length === 0 ? (
        <div className="muted small-text">
          After syncing a song, save it here. Next time you make a video with the same song, pick it and the lyrics
          line up to the new clip automatically.
        </div>
      ) : (
        <div className="lib-list">
          {list.map((e) => {
            const words = e.lines.reduce((a, l) => a + l.words.length, 0);
            return (
              <div key={e.id} className="lib-item">
                <div className="lib-meta">
                  <b>{e.name}</b>
                  <span className="muted small-text">
                    {words} words · {new Date(e.savedAt).toLocaleDateString()}
                    {e.audio ? '' : ' · no audio match'}
                  </span>
                </div>
                <button className="btn small" onClick={() => use(e)} disabled={!hasVideo} title={hasVideo ? 'Use in this project' : 'Open a video first'}>
                  Use
                </button>
                <button className="btn ghost small" onClick={() => remove(e)} title="Delete">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {list.length > 0 && (
        <label className="check small-text">
          <input type="checkbox" checked={withStyle} onChange={(e) => setWithStyle(e.target.checked)} />
          Also load the style it was saved with
        </label>
      )}

      {msg && <div className={msg.warn ? 'error' : 'note'}>{msg.text}</div>}
      {msg?.shift && (
        <div className="row small-text">
          <span className="muted">Shift all lyrics</span>
          {[-1, -0.1, 0.1, 1].map((d) => (
            <button key={d} className="btn small" onClick={() => onShift(d)}>
              {d > 0 ? '+' : ''}
              {d}s
            </button>
          ))}
        </div>
      )}

      <div className="row small-text">
        <button className="btn ghost small" onClick={exportAll} disabled={!list.length}>
          Export library
        </button>
        <button className="btn ghost small" onClick={() => importRef.current?.click()}>
          Import library
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) importAll(f);
          }}
        />
      </div>
    </div>
  );
}
