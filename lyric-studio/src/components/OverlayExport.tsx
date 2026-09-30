import { useRef, useState } from 'react';
import { fpsLabel, type SourceInfo } from '../lib/exportInfo';
import type { CaptionRenderer } from '../lib/render';

const RATES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
const SIZES = [
  [1080, 1920],
  [1440, 2560],
  [2160, 3840],
] as const;

/** Nearest editor-friendly frame rate to the clip's measured rate. */
const snapRate = (fps: number) => RATES.reduce((best, r) => (Math.abs(r - fps) < Math.abs(best - fps) ? r : best), 30);

interface Props {
  info: SourceInfo | null;
  duration: number;
  baseName: string;
  disabled: boolean;
  /** Fresh renderer with the current lyrics + style (so edits during export don't leak in). */
  makeRenderer: () => CaptionRenderer;
}

export function OverlayExport({ info, duration, baseName, disabled, makeRenderer }: Props) {
  const clipRate = info ? snapRate(info.fps) : 30;
  const clipSize: readonly [number, number] = info && info.width >= 2000 && info.height >= 3500 ? [2160, 3840] : info && info.width >= 1400 ? [1440, 2560] : [1080, 1920];
  const [rate, setRate] = useState<number | null>(null);
  const [size, setSize] = useState<readonly [number, number] | null>(null);
  const [shading, setShading] = useState(false);
  const [state, setState] = useState<{ busy: boolean; progress: number; url?: string; frames?: number; error?: string }>({
    busy: false,
    progress: 0,
  });
  const abort = useRef<AbortController | null>(null);

  const fps = rate ?? clipRate;
  const [w, h] = size ?? clipSize;
  const len = info?.duration || duration;
  const frames = Math.round(len * fps);

  const run = async () => {
    const ac = new AbortController();
    abort.current = ac;
    if (state.url) URL.revokeObjectURL(state.url);
    setState({ busy: true, progress: 0 });
    try {
      const { exportOverlay } = await import('../lib/overlay');
      const { blob, frames } = await exportOverlay(
        makeRenderer(),
        { width: w, height: h, fps, duration: len, shading },
        baseName,
        (p) => setState((s) => ({ ...s, progress: p })),
        ac.signal,
      );
      setState({ busy: false, progress: 1, url: URL.createObjectURL(blob), frames });
    } catch (e) {
      const err = e as Error;
      setState({ busy: false, progress: 0, error: err.name === 'AbortError' ? undefined : err.message });
    }
  };

  return (
    <div className="export-box">
      <div>
        <b>Transparent captions</b> <span className="muted small-text">for DaVinci Resolve / Premiere / After Effects</span>
      </div>
      <div className="muted small-text">
        Just the captions on a transparent background, to stack on top of your clip in your editor. Your footage is
        never re-encoded here, so it keeps its full quality.
      </div>
      <div className="two">
        <label className="field">
          Frame rate
          <select value={rate ?? ''} onChange={(e) => setRate(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Match clip ({fpsLabel(clipRate)} fps)</option>
            {RATES.map((r) => (
              <option key={r} value={r}>
                {fpsLabel(r)} fps
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Size
          <select value={size ? size[0] : ''} onChange={(e) => setSize(SIZES.find(([sw]) => sw === Number(e.target.value)) ?? null)}>
            <option value="">
              Match clip ({clipSize[0]}×{clipSize[1]})
            </option>
            {SIZES.map(([sw, sh]) => (
              <option key={sw} value={sw}>
                {sw}×{sh}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check small-text">
        <input type="checkbox" checked={shading} onChange={(e) => setShading(e.target.checked)} />
        Include the style's darkening / vignette (otherwise fully clear except text and payoff moments)
      </label>
      <div className="muted small-text">
        PNG sequence with transparency · {frames} frames · {w}×{h} · {fpsLabel(fps)} fps
      </div>
      {!state.busy ? (
        <button className="btn primary block" onClick={run} disabled={disabled}>
          ⬇ Export transparent captions (.zip)
        </button>
      ) : (
        <div className="status">
          Rendering frames… {Math.round(state.progress * 100)}%
          <div className="progress">
            <div style={{ width: `${state.progress * 100}%` }} />
          </div>
          <button className="btn small" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      {state.error && <div className="error">{state.error}</div>}
      {state.url && (
        <>
          <a className="btn block" href={state.url} download={`${baseName}_captions.zip`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            Save {baseName}_captions.zip
          </a>
          <div className="note">
            ✓ {state.frames} transparent frames. In DaVinci: unzip → in the Media Pool click <b>⋯ → Frame Display Mode →
            Sequence</b> → drag the folder in (it must come in as <b>one</b> clip) → put it on Video 2 above your clip, both
            starting on the same frame. Full steps are in the README inside the zip.
          </div>
        </>
      )}
    </div>
  );
}
