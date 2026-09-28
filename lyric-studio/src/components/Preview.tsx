import { useEffect, useRef, useState, type RefObject } from 'react';
import { formatTime } from '../lib/lyrics';
import type { CaptionRenderer } from '../lib/render';
import { drawSafeZoneOverlay, H, W } from '../lib/tiktok';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl?: string;
  renderer: CaptionRenderer;
  /** bump to force a redraw while paused (lyrics/template/settings changed) */
  version: number;
  showSafeZone: boolean;
  onTime: (t: number) => void;
  onDuration?: (d: number) => void;
}

export function Preview({ videoRef, videoUrl, renderer, version, showSafeZone, onTime, onDuration }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDurationState] = useState(0);
  const setDuration = (d: number) => {
    setDurationState(d);
    onDuration?.(d);
  };
  const stateRef = useRef({ version, showSafeZone });
  stateRef.current = { version, showSafeZone };
  // Bumped when the video element has a new frame ready while paused (after seek/load).
  const frameKey = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let raf = 0;
    let last = { t: -1, version: -1, safe: false, frame: -1 };
    let lastReported = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = videoRef.current;
      const t = v?.currentTime ?? 0;
      const { version, showSafeZone } = stateRef.current;
      const frame = frameKey.current;
      const live = v && !v.paused;
      if (!live && t === last.t && version === last.version && showSafeZone === last.safe && frame === last.frame) return;
      last = { t, version, safe: showSafeZone, frame };
      const ready = v && v.readyState >= 2 && v.videoWidth;
      renderer.drawFrame(ctx, t, ready ? v : null, v?.videoWidth ?? 0, v?.videoHeight ?? 0);
      if (showSafeZone) drawSafeZoneOverlay(ctx);
      if (Math.abs(t - lastReported) > 0.05) {
        lastReported = t;
        setTime(t);
        onTime(t);
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [renderer, videoRef, onTime]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v || !videoUrl) return;
    if (v.paused) v.play();
    else v.pause();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="stage">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} />
        {!videoUrl && (
          <div className="canvas-empty">
            <div>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎬</div>
              Drop a vertical video to start.
              <br />
              Your file never leaves your computer.
            </div>
          </div>
        )}
        <video
          ref={videoRef}
          className="hidden-video"
          src={videoUrl}
          playsInline
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (Number.isFinite(v.duration)) return setDuration(v.duration);
            // Browser-recorded WebM has no duration header; seeking far forces the browser to find it.
            v.currentTime = 1e9;
            v.addEventListener('durationchange', function fix() {
              if (!Number.isFinite(v.duration)) return;
              v.removeEventListener('durationchange', fix);
              setDuration(v.duration);
              v.currentTime = 0;
            });
          }}
          onLoadedData={() => frameKey.current++}
          onSeeked={() => frameKey.current++}
        />
      </div>
      <div className="transport">
        <button className="play" onClick={toggle} disabled={!videoUrl} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor" /></svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={time}
          disabled={!videoUrl}
          onChange={(e) => {
            const v = videoRef.current;
            if (v) v.currentTime = Number(e.target.value);
          }}
        />
        <span className="time">
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
