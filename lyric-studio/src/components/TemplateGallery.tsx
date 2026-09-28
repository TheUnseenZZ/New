import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureFont } from '../lib/fonts';
import { spreadWords } from '../lib/lyrics';
import { CaptionRenderer } from '../lib/render';
import { H, W } from '../lib/tiktok';
import { DEFAULT_SETTINGS, type Line, type Template } from '../lib/types';

const SAMPLE: Line[] = [
  { id: 's1', words: spreadWords("i can't let you go tonight".split(' '), 0.2, 2.2) },
  { id: 's2', words: spreadWords('so hold me like before'.split(' '), 2.6, 4.2) },
];
const LOOP = 4.8;
const STILL_T = 1.5;

interface Props {
  templates: Template[];
  customIds: Set<string>;
  selected: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TemplateGallery({ templates, customIds, selected, onSelect, onDelete }: Props) {
  return (
    <div className="tpl-grid">
      {templates.map((t) => (
        <button key={t.id} className={`tpl${t.id === selected ? ' selected' : ''}`} onClick={() => onSelect(t.id)} title={t.vibe}>
          <Thumb template={t} />
          <span className="name">{t.name}</span>
          {customIds.has(t.id) && (
            <>
              <span className="badge">CUSTOM</span>
              <span
                className="del"
                role="button"
                title="Remove template"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t.id);
                }}
              >
                ✕
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

/** Tiny live render of the template on sample lyrics; animates while hovered. */
function Thumb({ template }: { template: Template }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState(false);
  const [fontReady, setFontReady] = useState(0);
  const renderer = useMemo(() => {
    const r = new CaptionRenderer();
    r.setData(SAMPLE, template, { ...DEFAULT_SETTINGS, templateId: template.id });
    return r;
  }, [template]);

  useEffect(() => {
    let alive = true;
    ensureFont(template.font).then(() => {
      if (!alive) return;
      renderer.invalidate();
      setFontReady((x) => x + 1);
    });
    return () => {
      alive = false;
    };
  }, [template, renderer]);

  useEffect(() => {
    const canvas = ref.current!;
    const scale = 0.2;
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d')!;
    const bg = backdrop(template.id);
    const draw = (t: number) => {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      renderer.drawFrame(ctx, t, bg, W, H);
    };
    if (!hover) {
      draw(STILL_T);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      draw(((performance.now() - t0) / 1000) % LOOP);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [hover, renderer, fontReady, template.id]);

  return <canvas ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} />;
}

const backdrops = new Map<string, HTMLCanvasElement>();
/** A moody gradient "fake footage" background per template. */
function backdrop(id: string) {
  let c = backdrops.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 108;
  c.height = 192;
  const g = c.getContext('2d')!;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const grad = g.createLinearGradient(0, 0, 108, 192);
  grad.addColorStop(0, `hsl(${h} 45% 28%)`);
  grad.addColorStop(1, `hsl(${(h + 60) % 360} 50% 10%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 108, 192);
  g.fillStyle = `hsla(${(h + 180) % 360} 70% 60% / 0.25)`;
  g.beginPath();
  g.arc(70, 60, 40, 0, Math.PI * 2);
  g.fill();
  backdrops.set(id, c);
  return c;
}
