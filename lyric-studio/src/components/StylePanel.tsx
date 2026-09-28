import { useState } from 'react';
import type { EnterAnim, Placement, StyleOverrides, Template } from '../lib/types';

/** Curated Google Fonts, grouped by feel. Any other Google Font can be typed in. */
export const FONTS: { group: string; families: string[] }[] = [
  { group: 'Bold & condensed', families: ['Oswald', 'Anton', 'Bebas Neue', 'Roboto Condensed', 'Archivo Black', 'Montserrat'] },
  { group: 'Clean', families: ['Inter', 'Poppins', 'Space Grotesk', 'Syne', 'Unbounded', 'Bricolage Grotesque'] },
  { group: 'Playful', families: ['Bagel Fat One', 'Fredoka', 'Titan One', 'Shrikhand', 'DynaPuff', 'Bungee', 'Rubik Mono One', 'Chango'] },
  { group: 'Serif', families: ['Playfair Display', 'Instrument Serif', 'EB Garamond', 'DM Serif Display'] },
  { group: 'Hand & texture', families: ['Caveat', 'Permanent Marker', 'Special Elite'] },
  { group: 'Tech & retro', families: ['Space Mono', 'Press Start 2P', 'Orbitron', 'Monoton'] },
];

const ENTER_LABELS: [EnterAnim, string][] = [
  ['none', 'Hard cut'],
  ['pop', 'Pop'],
  ['slam', 'Slam'],
  ['fade', 'Fade'],
  ['blur', 'Blur in'],
  ['slideUp', 'Slide up'],
  ['slideDown', 'Slide down'],
  ['zoom', 'Zoom'],
  ['drop', 'Drop & bounce'],
  ['spin', 'Spin'],
  ['flyIn', 'Fly in'],
  ['flip', 'Flip'],
  ['stretch', 'Stretch'],
  ['swing', 'Swing'],
  ['glitch', 'Glitch'],
  ['typewriter', 'Typewriter'],
];

const PLACEMENT_LABELS: [Placement, string][] = [
  ['block', 'Centered block'],
  ['scatter', 'Scatter around'],
  ['zigzag', 'Zigzag edges'],
  ['stairs', 'Staircase'],
  ['orbit', 'Orbit'],
  ['wander', 'Somewhere new each time'],
  ['bounce', 'DVD bounce'],
];

interface Props {
  template: Template;
  style: StyleOverrides;
  onChange: (s: StyleOverrides) => void;
}

export function StylePanel({ template, style, onChange }: Props) {
  const set = <K extends keyof StyleOverrides>(k: K, v: StyleOverrides[K] | undefined) => {
    const next = { ...style };
    if (v === undefined || v === '') delete next[k];
    else next[k] = v;
    onChange(next);
  };
  const known = FONTS.some((g) => g.families.includes(style.fontFamily ?? ''));
  const [customFont, setCustomFont] = useState(!known && !!style.fontFamily);
  const customized = Object.keys(style).length > 0;

  return (
    <div className="stack style-panel">
      <div className="row">
        <div className="section-title" style={{ flex: 1 }}>
          Customize
        </div>
        {customized && (
          <button className="btn ghost small" onClick={() => onChange({})} title="Back to the template's own settings">
            Reset to template
          </button>
        )}
      </div>

      <div className="sub-title">Text</div>
      <label className="field">
        Font
        {!customFont ? (
          <select
            value={style.fontFamily ?? ''}
            onChange={(e) => {
              if (e.target.value === '__custom') {
                setCustomFont(true);
                return;
              }
              set('fontFamily', e.target.value || undefined);
            }}
          >
            <option value="">Template ({template.font.family})</option>
            {FONTS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.families.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__custom">Other Google Font…</option>
          </select>
        ) : (
          <div className="row">
            <input
              type="text"
              placeholder="Exact Google Fonts name, e.g. Righteous"
              defaultValue={style.fontFamily ?? ''}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onBlur={(e) => set('fontFamily', e.target.value.trim() || undefined)}
              style={{ flex: 1 }}
            />
            <button
              className="btn small"
              onClick={() => {
                setCustomFont(false);
                set('fontFamily', undefined);
              }}
            >
              List
            </button>
          </div>
        )}
      </label>
      <div className="two">
        <label className="field">
          Weight
          <select value={style.fontWeight ?? ''} onChange={(e) => set('fontWeight', e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Template ({template.font.weight})</option>
            {[300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Letters
          <select value={style.case ?? ''} onChange={(e) => set('case', (e.target.value || undefined) as StyleOverrides['case'])}>
            <option value="">Template</option>
            <option value="upper">ALL CAPS</option>
            <option value="lower">all lowercase</option>
            <option value="none">As typed</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={style.italic ?? !!template.font.italic}
          onChange={(e) => set('italic', e.target.checked === !!template.font.italic ? undefined : e.target.checked)}
        />
        Italic
      </label>

      <div className="sub-title">Motion</div>
      <div className="field">
        <span className="muted small-text">Words on screen</span>
        <div className="seg">
          {(
            [
              [undefined, 'Template'],
              ['line', 'Whole line'],
              ['chunk', '2–3 words'],
              ['word', 'One word'],
            ] as const
          ).map(([v, label]) => (
            <button key={label} className={style.mode === v ? 'on' : ''} onClick={() => set('mode', v)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="two">
        <label className="field">
          Entrance
          <select value={style.enter ?? ''} onChange={(e) => set('enter', (e.target.value || undefined) as EnterAnim | undefined)}>
            <option value="">Template ({ENTER_LABELS.find(([k]) => k === template.enter.anim)?.[1] ?? template.enter.anim})</option>
            {ENTER_LABELS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Movement
          <select value={style.placement ?? ''} onChange={(e) => set('placement', (e.target.value || undefined) as Placement | undefined)}>
            <option value="">
              Template ({PLACEMENT_LABELS.find(([k]) => k === (template.layout.placement ?? 'block'))?.[1]})
            </option>
            {PLACEMENT_LABELS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="sub-title">Payoff moments</div>
      <div className="muted small-text">
        A payoff gives one word its own full moment (like Blackout's black screen). Pick words exactly in the timeline:
        select a word → <b>Payoff On/Off</b>, or press <kbd>P</kbd>.
      </div>
      <div className="two">
        <label className="field">
          When
          <select value={style.payoffs ?? ''} onChange={(e) => set('payoffs', (e.target.value || undefined) as StyleOverrides['payoffs'])}>
            <option value="">
              Template ({template.emphasis?.trigger === 'lineEnd' ? 'every line end' : 'only picked words'})
            </option>
            <option value="lineEnd">End of every line</option>
            <option value="picked">Only words I pick</option>
          </select>
        </label>
        <label className="field">
          Background
          <select value={style.payoffBg ?? ''} onChange={(e) => set('payoffBg', e.target.value || undefined)}>
            <option value="">Template</option>
            <option value="#000000">Black screen</option>
            <option value="#FFFFFF">White screen</option>
            <option value="accent">Accent color</option>
            <option value="none">Keep the video</option>
          </select>
        </label>
      </div>
    </div>
  );
}
