import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImportTemplate } from './components/ImportTemplate';
import { LyricsEditor } from './components/LyricsEditor';
import { Preview } from './components/Preview';
import { TemplateGallery } from './components/TemplateGallery';
import { LibraryPanel } from './components/LibraryPanel';
import { OverlayExport } from './components/OverlayExport';
import { StylePanel } from './components/StylePanel';
import { Timeline } from './components/Timeline';
import { computePeaks, type Peaks } from './lib/waveform';
import { parseSubtitles } from './lib/subtitles';
import { shiftLines } from './lib/library';
import { codecName, fpsLabel, mbps, outputSize, targetBitrate, type SourceInfo } from './lib/exportInfo';
import { ensureFont } from './lib/fonts';
import { toSrt } from './lib/lyrics';
import { applyOverrides, CaptionRenderer } from './lib/render';
import { BUILT_IN, loadCustomTemplates, saveCustomTemplates } from './lib/templates';
import { LANGUAGES, MODELS, transcribe } from './lib/transcribe';
import { DEFAULT_SETTINGS, type Line, type Settings, type Template } from './lib/types';

const SETTINGS_KEY = 'lyric-studio:settings';
const projectKey = (f: File) => `lyric-studio:project:${f.name}:${f.size}:${f.lastModified}`;

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore: storage is a convenience only */
  }
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>();
  const [lines, setLinesState] = useState<Line[]>([]);
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readJSON<Settings>(SETTINGS_KEY) }));
  const [custom, setCustom] = useState<Template[]>(loadCustomTemplates);
  const [time, setTime] = useState(0);
  const [fontTick, setFontTick] = useState(0);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [model, setModel] = useState<string>(MODELS[0].id);
  const [language, setLanguage] = useState<string | null>(null);
  const [asr, setAsr] = useState<{ busy: boolean; message?: string; progress?: number; error?: string }>({ busy: false });

  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [exp, setExp] = useState<{ busy: boolean; progress: number; phase?: string; url?: string; error?: string; warnings?: string[]; summary?: string }>({
    busy: false,
    progress: 0,
  });
  const abortRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const subsInput = useRef<HTMLInputElement>(null);

  const templates = useMemo(() => [...BUILT_IN, ...custom], [custom]);
  const customIds = useMemo(() => new Set(custom.map((t) => t.id)), [custom]);
  const template = templates.find((t) => t.id === settings.templateId) ?? templates[0];

  // One renderer instance shared by preview and export so they always match.
  const renderer = useMemo(() => new CaptionRenderer(), []);
  const version = useMemo(() => {
    renderer.setData(lines, template, settings);
    return Math.random();
  }, [renderer, lines, template, settings, fontTick]);

  // Load whatever font the (customized) style ends up using.
  const effectiveFont = useMemo(() => applyOverrides(template, settings).font, [template, settings]);
  const fontKey = `${effectiveFont.family}|${effectiveFont.weight}|${effectiveFont.italic}`;
  useEffect(() => {
    let alive = true;
    ensureFont(effectiveFont).then(() => alive && setFontTick((x) => x + 1));
    return () => {
      alive = false;
    };
  }, [fontKey]);

  useEffect(() => writeJSON(SETTINGS_KEY, settings), [settings]);
  useEffect(() => {
    if (file) writeJSON(projectKey(file), { lines });
  }, [file, lines]);

  // Undo history: snapshot lines before each edit. Timeline drags update "live" and snapshot once per drag.
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const past = useRef<Line[][]>([]);
  const future = useRef<Line[][]>([]);
  const checkpoint = useCallback(() => {
    past.current.push(linesRef.current);
    if (past.current.length > 200) past.current.shift();
    future.current = [];
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(linesRef.current);
    setLinesState(prev);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(linesRef.current);
    setLinesState(next);
  }, []);
  const setLines = useCallback(
    (fn: (prev: Line[]) => Line[]) => {
      checkpoint();
      setLinesState(fn);
    },
    [checkpoint],
  );
  const liveLines = useCallback((fn: (prev: Line[]) => Line[]) => setLinesState(fn), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
      e.preventDefault();
      if (e.key.toLowerCase() === 'y' || e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const [duration, setDuration] = useState(0);
  useEffect(() => {
    setSourceInfo(null);
    if (!file) return;
    let alive = true;
    import('./lib/export')
      .then(({ probeVideo }) => probeVideo(file))
      .then((info) => alive && setSourceInfo(info))
      .catch(() => {
        /* unreadable container: export will report the problem */
      });
    return () => {
      alive = false;
    };
  }, [file]);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  useEffect(() => {
    setPeaks(null);
    if (!file) return;
    let alive = true;
    computePeaks(file)
      .then((pk) => alive && setPeaks(pk))
      .catch(() => {
        /* no audio or undecodable: timeline just shows no waveform */
      });
    return () => {
      alive = false;
    };
  }, [file]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, t);
  }, []);

  const openFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v|mkv)$/i.test(f.name)) {
      setNotice('That doesn’t look like a video file.');
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setExp({ busy: false, progress: 0 });
    setAsr({ busy: false });
    past.current = [];
    future.current = [];
    const saved = readJSON<{ lines: Line[] }>(projectKey(f));
    if (saved?.lines?.length) {
      setLinesState(saved.lines);
      setNotice('Restored your captions from last time for this video.');
    } else {
      setLinesState([]);
      setNotice(null);
    }
  };

  const runTranscribe = async () => {
    if (!file) return;
    if (lines.length && !confirm('Replace your current lyrics with a fresh auto-caption?')) return;
    setAsr({ busy: true, message: 'Starting…' });
    try {
      const result = await transcribe(file, { model, language }, (message, progress) =>
        setAsr({ busy: true, message, progress }),
      );
      checkpoint();
      setLinesState(result);
      setAsr({
        busy: false,
        message: result.length
          ? `Found ${result.reduce((a, l) => a + l.words.length, 0)} words in ${result.length} lines. Fix any misheard words below.`
          : undefined,
        error: result.length ? undefined : 'No vocals detected. Try the Accurate model or set the language.',
      });
    } catch (e) {
      setAsr({ busy: false, error: (e as Error).message });
    }
  };

  const runExport = async () => {
    if (!file) return;
    videoRef.current?.pause();
    const ac = new AbortController();
    abortRef.current = ac;
    if (exp.url) URL.revokeObjectURL(exp.url);
    setExp({ busy: true, progress: 0 });
    try {
      // Export uses its own renderer snapshot so edits during export don't glitch the output.
      const r = new CaptionRenderer();
      r.setData(lines, template, settings);
      const { exportVideo } = await import('./lib/export');
      const { blob, warnings, summary } = await exportVideo(
        file,
        r,
        settings.exportOpts ?? DEFAULT_SETTINGS.exportOpts,
        (p, phase) => setExp((s) => ({ ...s, progress: p, phase: phase ?? s.phase })),
        ac.signal,
      );
      setExp({ busy: false, progress: 1, url: URL.createObjectURL(blob), warnings, summary });
    } catch (e) {
      const err = e as Error;
      setExp({ busy: false, progress: 0, error: err.name === 'AbortError' ? undefined : err.message });
    }
  };

  const baseName = file ? file.name.replace(/\.[^.]+$/, '') : 'lyric-video';

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        openFile(e.dataTransfer.files[0]);
      }}
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">Aa</div>
          Lyric Studio
        </div>
        <span className="muted small-text">Animated lyric captions for TikTok & Reels. Runs 100% in your browser.</span>
        <div className="spacer" />
      </header>

      {/* Left: source + lyrics */}
      <section className="panel">
        <div className="panel-head">
          <h2>1 · Video & lyrics</h2>
        </div>
        <div className="panel-body stack">
          <div className={`dropzone${dragOver ? ' over' : ''}`} onClick={() => fileInput.current?.click()}>
            <strong>{file ? file.name : 'Drop your video here'}</strong>
            <span className="muted small-text">{file ? 'Click to choose a different video' : 'or click to browse · MP4, MOV, WebM'}</span>
            <input ref={fileInput} type="file" accept="video/*" hidden onChange={(e) => openFile(e.target.files?.[0])} />
          </div>
          {notice && <div className="note">{notice}</div>}

          <div className="two">
            <label className="field">
              Speech model
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={asr.busy}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Language
              <select value={language ?? ''} onChange={(e) => setLanguage(e.target.value || null)} disabled={asr.busy}>
                {LANGUAGES.map((l) => (
                  <option key={l.label} value={l.code ?? ''}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="muted small-text">{MODELS.find((m) => m.id === model)?.note}</div>
          <button className="btn primary block" onClick={runTranscribe} disabled={!file || asr.busy}>
            {asr.busy ? 'Working…' : lines.length ? '↻ Re-run auto-caption' : '✦ Auto-caption'}
          </button>
          {asr.busy && (
            <div className="status">
              {asr.message}
              <div className={`progress${asr.progress == null ? ' indeterminate' : ''}`}>
                <div style={{ width: `${asr.progress ?? 0}%` }} />
              </div>
            </div>
          )}
          <button className="btn block" onClick={() => subsInput.current?.click()} disabled={!file}>
            ⤓ Import subtitles (.srt / .vtt / .lrc)
          </button>
          <input
            ref={subsInput}
            type="file"
            accept=".srt,.vtt,.lrc,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (lines.length && !confirm('Replace your current lyrics with the imported subtitles?')) return;
              try {
                const res = parseSubtitles(await f.text(), duration);
                setLines(() => res.lines);
                const words = res.lines.reduce((a, l) => a + l.words.length, 0);
                setAsr({
                  busy: false,
                  message:
                    `Imported ${res.lines.length} lines (${words} words) from ${res.format}.` +
                    (res.shifted ? ` Removed the ${res.shifted / 3600}h timeline offset (DaVinci starts at 01:00:00:00).` : '') +
                    (res.wordTimed ? '' : ' Word timings inside each subtitle are estimated. Fine-tune in the timeline or with Tap-sync.'),
                });
              } catch (err) {
                setAsr({ busy: false, error: (err as Error).message });
              }
            }}
          />
          {!asr.busy && asr.message && <div className="note">{asr.message}</div>}
          {asr.error && <div className="error">{asr.error}</div>}

          <LibraryPanel
            lines={lines}
            peaks={peaks}
            settings={settings}
            defaultName={baseName}
            hasVideo={!!file}
            onUse={(l, saved) => {
              setLines(() => l);
              if (saved) setSettings((cur) => ({ ...DEFAULT_SETTINGS, ...saved, showSafeZone: cur.showSafeZone }));
            }}
            onShift={(dt) => setLines((prev) => shiftLines(prev, dt))}
          />

          <div className="section-title">Lyrics</div>
          <LyricsEditor lines={lines} setLines={setLines} time={time} seek={seek} />
        </div>
      </section>

      {/* Center: preview */}
      <Preview
        videoRef={videoRef}
        videoUrl={videoUrl}
        renderer={renderer}
        version={version}
        showSafeZone={settings.showSafeZone}
        onTime={setTime}
        onDuration={setDuration}
      />

      {/* Right: style + export */}
      <section className="panel">
        <div className="panel-head">
          <h2>2 · Style & export</h2>
          <button className="btn small" onClick={() => setImporting(true)} title="Add a template from JSON">
            + Template
          </button>
        </div>
        <div className="panel-body stack">
          <TemplateGallery
            templates={templates}
            customIds={customIds}
            selected={template.id}
            onSelect={(id) => id !== settings.templateId && setSettings((s) => ({ ...s, templateId: id, style: {} }))}
            onDelete={(id) => {
              const next = custom.filter((t) => t.id !== id);
              setCustom(next);
              saveCustomTemplates(next);
            }}
          />
          <div className="vibe">
            <b>{template.name}</b> · {template.vibe}{' '}
            <button
              className="btn ghost small"
              title="Copy this template's JSON, e.g. to ask Claude for a variation"
              onClick={() => navigator.clipboard?.writeText(JSON.stringify(template, null, 2))}
            >
              Copy JSON
            </button>
          </div>

          <StylePanel template={template} style={settings.style} onChange={(st) => set('style', st)} />

          <div className="section-title">Adjust</div>
          <label className="field">
            Text size · {Math.round(settings.sizeScale * 100)}%
            <input type="range" min={0.5} max={1.6} step={0.05} value={settings.sizeScale} onChange={(e) => set('sizeScale', Number(e.target.value))} />
          </label>
          <label className="field">
            Vertical position
            <input type="range" min={-0.5} max={0.5} step={0.01} value={settings.yOffset} onChange={(e) => set('yOffset', Number(e.target.value))} />
          </label>
          <label className="field">
            Lyric timing · {settings.timingOffset > 0 ? '+' : ''}
            {settings.timingOffset.toFixed(2)}s {settings.timingOffset < 0 ? '(earlier)' : settings.timingOffset > 0 ? '(later)' : ''}
            <input type="range" min={-1} max={1} step={0.02} value={settings.timingOffset} onChange={(e) => set('timingOffset', Number(e.target.value))} />
          </label>
          <div className="field">
            <span className="muted small-text">Framing</span>
            <div className="seg">
              <button className={settings.fit === 'cover' ? 'on' : ''} onClick={() => set('fit', 'cover')}>
                Fill 9:16
              </button>
              <button className={settings.fit === 'contain' ? 'on' : ''} onClick={() => set('fit', 'contain')}>
                Fit + blur
              </button>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={settings.showSafeZone} onChange={(e) => set('showSafeZone', e.target.checked)} />
            Show TikTok safe zone <span className="muted small-text">(preview only)</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.stripPunctuation} onChange={(e) => set('stripPunctuation', e.target.checked)} />
            Hide commas & periods
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.colorOverride.enabled}
              onChange={(e) => set('colorOverride', { ...settings.colorOverride, enabled: e.target.checked })}
            />
            Custom colors
          </label>
          {settings.colorOverride.enabled && (
            <div className="row">
              <label className="field">
                Text
                <input type="color" value={settings.colorOverride.fill} onChange={(e) => set('colorOverride', { ...settings.colorOverride, fill: e.target.value })} />
              </label>
              <label className="field">
                Accent
                <input type="color" value={settings.colorOverride.accent} onChange={(e) => set('colorOverride', { ...settings.colorOverride, accent: e.target.value })} />
              </label>
            </div>
          )}

          <div className="section-title">Export</div>
          <OverlayExport
            info={sourceInfo}
            duration={duration}
            baseName={baseName}
            disabled={!file || !lines.length}
            makeRenderer={() => {
              const r = new CaptionRenderer();
              r.setData(lines, template, settings);
              return r;
            }}
          />
          <div className="sub-title">Or a finished MP4 (video + captions)</div>
          <ExportSettings
            info={sourceInfo}
            opts={settings.exportOpts ?? DEFAULT_SETTINGS.exportOpts}
            onChange={(o) => set('exportOpts', o)}
          />
          {!exp.busy ? (
            <button className="btn primary block" onClick={runExport} disabled={!file}>
              ⬇ Export MP4 (1080×1920)
            </button>
          ) : (
            <div className="status">
              {exp.phase ?? 'Rendering…'} {Math.round(exp.progress * 100)}%
              <div className="progress">
                <div style={{ width: `${exp.progress * 100}%` }} />
              </div>
              <button className="btn small" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            </div>
          )}
          {exp.error && <div className="error">{exp.error}</div>}
          {exp.url && (
            <div className="stack">
              <video className="result-video" src={exp.url} controls playsInline />
              {exp.summary && <div className="note">✓ {exp.summary}</div>}
              <a className="btn block" href={exp.url} download={`${baseName}-lyrics.mp4`} style={{ textAlign: 'center', textDecoration: 'none' }}>
                Save {baseName}-lyrics.mp4
              </a>
              {exp.warnings?.map((w) => (
                <div key={w} className="note">
                  {w}
                </div>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn small" disabled={!lines.length} onClick={() => download(new Blob([toSrt(lines)], { type: 'text/plain' }), `${baseName}.srt`)}>
              .srt
            </button>
            <button
              className="btn small"
              disabled={!lines.length}
              onClick={() =>
                download(new Blob([JSON.stringify({ version: 1, lines, settings }, null, 2)], { type: 'application/json' }), `${baseName}.lyrics.json`)
              }
            >
              Save project
            </button>
            <button className="btn small" onClick={() => projectInput.current?.click()}>
              Load project
            </button>
            <input
              ref={projectInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const data = JSON.parse(await f.text());
                  if (Array.isArray(data.lines)) setLines(() => data.lines);
                  if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
                } catch {
                  setNotice('That project file could not be read.');
                }
              }}
            />
          </div>
          <div className="muted small-text">Best in desktop Chrome or Edge. Export runs on your machine and can take about as long as the clip.</div>
        </div>
      </section>

      <Timeline
        lines={lines}
        live={liveLines}
        checkpoint={checkpoint}
        undo={undo}
        redo={redo}
        videoRef={videoRef}
        duration={duration}
        peaks={peaks}
        offset={settings.timingOffset}
        seek={seek}
      />

      {importing && (
        <ImportTemplate
          existingIds={new Set(templates.map((t) => t.id))}
          onClose={() => setImporting(false)}
          onImport={(t) => {
            const next = [...custom, t];
            setCustom(next);
            saveCustomTemplates(next);
            setSettings((s) => ({ ...s, templateId: t.id, style: {} }));
            setImporting(false);
          }}
        />
      )}
    </div>
  );
}

function ExportSettings({
  info,
  opts,
  onChange,
}: {
  info: SourceInfo | null;
  opts: import('./lib/exportInfo').ExportOptions;
  onChange: (o: import('./lib/exportInfo').ExportOptions) => void;
}) {
  const out = outputSize(info, opts.resolution);
  const br = targetBitrate(info, opts, out);
  const srcOut = outputSize(info, 'source');
  return (
    <div className="export-box">
      {info ? (
        <div className="small-text">
          <span className="muted">Your clip: </span>
          {info.width}×{info.height} · {fpsLabel(info.fps)} fps{info.variableFps ? ' (variable)' : ''} · {codecName(info.videoCodec)}{' '}
          {mbps(info.videoBitrate)}
          {info.audioCodec && ` · ${codecName(info.audioCodec)} ${info.audioBitrate ? Math.round(info.audioBitrate / 1000) + ' kbps' : ''}`}
          {info.hdr && ' · HDR'}
        </div>
      ) : (
        <div className="small-text muted">Open a video to see its quality settings.</div>
      )}
      <div className="two">
        <label className="field">
          Resolution
          <select
            value={String(opts.resolution)}
            onChange={(e) => onChange({ ...opts, resolution: e.target.value === 'source' ? 'source' : (Number(e.target.value) as 1080 | 1440 | 2160) })}
          >
            <option value="source">Match clip ({srcOut.width}×{srcOut.height})</option>
            <option value="1080">1080×1920</option>
            <option value="1440">1440×2560</option>
            <option value="2160">2160×3840 (4K)</option>
          </select>
        </label>
        <label className="field">
          Codec
          <select value={opts.codec} onChange={(e) => onChange({ ...opts, codec: e.target.value as 'source' | 'avc' | 'hevc' })}>
            <option value="source">Same as clip ({codecName(info?.videoCodec ?? 'avc')})</option>
            <option value="avc">H.264 (most compatible)</option>
            <option value="hevc">HEVC / H.265</option>
          </select>
        </label>
      </div>
      <label className="field">
        Video bitrate
        <div className="row">
          <select
            value={opts.bitrate === 'source' ? 'source' : 'custom'}
            onChange={(e) =>
              onChange({ ...opts, bitrate: e.target.value === 'source' ? 'source' : Math.round(((br ?? 12e6) / 1e6) * 10) / 10 })
            }
            style={{ flex: 1 }}
          >
            <option value="source">
              Match clip
              {br && opts.bitrate === 'source'
                ? info?.videoBitrate && Math.abs(br - info.videoBitrate) / info.videoBitrate > 0.03
                  ? ` (${mbps(br)}, same quality per pixel at ${out.width}×${out.height})`
                  : ` (${mbps(br)})`
                : ''}
            </option>
            <option value="custom">Custom</option>
          </select>
          {opts.bitrate !== 'source' && (
            <>
              <input
                type="number"
                min={1}
                max={200}
                step={0.5}
                value={opts.bitrate}
                onChange={(e) => onChange({ ...opts, bitrate: Math.max(1, Number(e.target.value) || 1) })}
                style={{ width: 80 }}
              />
              <span className="muted small-text">Mbps</span>
            </>
          )}
        </div>
      </label>
      <div className="muted small-text">
        Frame rate: {info ? `${fpsLabel(info.fps)} fps, every original frame kept` : 'same as clip'} · Audio: copied from the clip untouched
      </div>
      <label className="check small-text">
        <input
          type="checkbox"
          checked={(opts.bitrateMode ?? 'constant') === 'constant'}
          onChange={(e) => onChange({ ...opts, bitrateMode: e.target.checked ? 'constant' : 'variable' })}
        />
        Constant bitrate (hit the number exactly, like your editor's CBR)
      </label>
    </div>
  );
}
