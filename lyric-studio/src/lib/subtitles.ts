import { newId, spreadWords } from './lyrics';
import type { Line, Word } from './types';

export interface ImportResult {
  lines: Line[];
  format: 'SRT' | 'VTT' | 'LRC';
  /** Seconds removed from every timestamp (e.g. DaVinci Resolve's 01:00:00:00 timeline start). */
  shifted: number;
  /** true when every word came with its own timestamp (not estimated inside the cue). */
  wordTimed: boolean;
}

/** "01:02:03,450", "02:03.450", "1:02:03.45" → seconds */
function parseClock(s: string): number {
  const parts = s.trim().replace(',', '.').split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const TAGS = /<\/?(?:i|b|u|c|v|ruby|rt|lang|font)[^>]*>|\{\\[^}]*\}/gi;
const INLINE_TIME = /<(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}>/;

/** Build words for one cue. Uses inline word timestamps if present (VTT karaoke / enhanced LRC). */
function cueWords(text: string, start: number, end: number, tag: RegExp): { words: Word[]; timed: boolean } {
  if (tag.test(text)) {
    // Split into [time, text] segments: "<00:01.2>now <00:01.5>we ..."
    const segs: { t: number; text: string }[] = [];
    const re = new RegExp(tag.source.replace(/^</, '<(').replace(/>$/, ')>'), 'g');
    let last = start;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    const pieces: { t: number; text: string }[] = [];
    while ((m = re.exec(text))) {
      pieces.push({ t: last, text: text.slice(lastIdx, m.index) });
      last = parseClock(m[1]);
      lastIdx = m.index + m[0].length;
    }
    pieces.push({ t: last, text: text.slice(lastIdx) });
    for (const p of pieces) {
      const tokens = p.text.replace(TAGS, '').split(/\s+/).filter(Boolean);
      tokens.forEach((tok, i) => segs.push({ t: p.t + i * 0.01, text: tok }));
    }
    const words = segs.map((s, i) => ({ text: s.text, start: s.t, end: segs[i + 1]?.t ?? Math.max(end, s.t + 0.3) }));
    return { words, timed: true };
  }
  const tokens = text.replace(TAGS, '').split(/\s+/).filter(Boolean);
  return { words: tokens.length ? spreadWords(tokens, start, Math.max(end, start + 0.2)) : [], timed: false };
}

function parseCues(src: string): { lines: Line[]; timed: boolean } {
  const lines: Line[] = [];
  let timed = true;
  const blocks = src.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const rows = block.split('\n').filter((r) => r.trim() !== '');
    const ti = rows.findIndex((r) => r.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = rows[ti].split('-->');
    const start = parseClock(a);
    const end = parseClock(b.trim().split(/\s+/)[0]);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const text = rows.slice(ti + 1).join(' ');
    const { words, timed: t } = cueWords(text, start, end, INLINE_TIME);
    if (!words.length) continue;
    timed &&= t;
    lines.push({ id: newId(), words });
  }
  return { lines, timed };
}

function parseLrc(src: string): { lines: Line[]; timed: boolean } {
  const rows: { t: number; text: string }[] = [];
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    // A row may carry several stamps: "[00:12.00][01:30.00]chorus line"
    const stamps = [...raw.matchAll(/\[(\d{1,3}:\d{2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const s of stamps) rows.push({ t: parseClock(s[1].replace(/:(\d{1,3})$/, '.$1')), text });
  }
  rows.sort((a, b) => a.t - b.t);
  const lines: Line[] = [];
  let timed = true;
  rows.forEach((r, i) => {
    if (!r.text) return;
    const next = rows[i + 1]?.t ?? r.t + 4;
    // Lines end at the next line, but don't linger through long instrumental gaps.
    const end = Math.min(next, r.t + Math.max(1.5, r.text.split(/\s+/).length * 0.6));
    const { words, timed: t } = cueWords(r.text, r.t, end, /<\d{1,2}:\d{2}[.:]\d{1,3}>/);
    if (!words.length) return;
    timed &&= t;
    lines.push({ id: newId(), words });
  });
  return { lines, timed };
}

/**
 * Parse SRT (DaVinci Resolve, Premiere, CapCut…), WebVTT (incl. YouTube word timestamps) or LRC
 * (incl. enhanced word-level LRC). `videoDuration` lets us undo timeline-timecode offsets.
 */
export function parseSubtitles(src: string, videoDuration: number): ImportResult {
  const text = src.replace(/^﻿/, '');
  const isLrc = /^\s*\[\d{1,3}:\d{2}/m.test(text) && !text.includes('-->');
  const format: ImportResult['format'] = isLrc ? 'LRC' : /^\s*WEBVTT/.test(text) ? 'VTT' : 'SRT';
  const { lines, timed } = isLrc ? parseLrc(text) : parseCues(text);
  if (!lines.length) throw new Error('No subtitles found in that file. Supported: .srt, .vtt, .lrc');

  // Editors like DaVinci Resolve start timelines at 01:00:00:00, so cues come out an hour late.
  // If everything starts after the video ends, drop whole hours until it fits.
  const first = Math.min(...lines.map((l) => l.words[0].start));
  let shifted = 0;
  if (videoDuration > 0 && first >= videoDuration && first >= 3600) {
    shifted = Math.floor(first / 3600) * 3600;
  }
  if (shifted) {
    for (const l of lines) for (const w of l.words) (w.start -= shifted), (w.end -= shifted);
  }
  lines.sort((a, b) => a.words[0].start - b.words[0].start);
  return { lines, format, shifted, wordTimed: timed };
}
