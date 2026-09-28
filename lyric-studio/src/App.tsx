import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImportTemplate } from './components/ImportTemplate';
import { LyricsEditor } from './components/LyricsEditor';
import { Preview } from './components/Preview';
import { TemplateGallery } from './components/TemplateGallery';
import { ensureFont } from './lib/fonts';
import { toSrt } from './lib/lyrics';
import { CaptionRenderer } from './lib/render';
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

  const [exp, setExp] = useState<{ busy: boolean; progress: number; url?: string; error?: string; warnings?: string[] }>({
    busy: false,
    progress: 0,
  });
  const abortRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const templates = useMemo(() => [...BUILT_IN, ...custom], [custom]);
  const customIds = useMemo(() => new Set(custom.map((t) => t.id)), [custom]);
  const template = templates.find((t) => t.id === settings.templateId) ?? templates[0];

  // One renderer instance shared by preview and export so they always match.
  const renderer = useMemo(() => new CaptionRenderer(), []);
  const version = useMemo(() => {
    renderer.setData(lines, template, settings);
    return Math.random();
  }, [renderer, lines, template, settings, fontTick]);

  useEffect(() => {
    let alive = true;
    ensureFont(template.font).then(() => alive && setFontTick((x) => x + 1));
    return () => {
      alive = false;
    };
  }, [template]);

  useEffect(() => writeJSON(SETTINGS_KEY, settings), [settings]);
  useEffect(() => {
    if (file) writeJSON(projectKey(file), { lines });
  }, [file, lines]);

  const setLines = useCallback((fn: (prev: Line[]) => Line[]) => setLinesState(fn), []);
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
      const { blob, warnings } = await exportVideo(file, r, (p) => setExp((s) => ({ ...s, progress: p })), ac.signal);
      setExp({ busy: false, progress: 1, url: URL.createObjectURL(blob), warnings });
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
          {!asr.busy && asr.message && <div className="note">{asr.message}</div>}
          {asr.error && <div className="error">{asr.error}</div>}

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
            onSelect={(id) => set('templateId', id)}
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
          {!exp.busy ? (
            <button className="btn primary block" onClick={runExport} disabled={!file}>
              ⬇ Export MP4 (1080×1920)
            </button>
          ) : (
            <div className="status">
              Rendering… {Math.round(exp.progress * 100)}%
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
                  if (Array.isArray(data.lines)) setLinesState(data.lines);
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

      {importing && (
        <ImportTemplate
          existingIds={new Set(templates.map((t) => t.id))}
          onClose={() => setImporting(false)}
          onImport={(t) => {
            const next = [...custom, t];
            setCustom(next);
            saveCustomTemplates(next);
            set('templateId', t.id);
            setImporting(false);
          }}
        />
      )}
    </div>
  );
}
