import type { Line, Word } from './types';

let idCounter = 0;
export const newId = () => `l${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Whisper emits these for instrumental parts or hallucinates them on silence. */
const JUNK = /^[\s♪♫🎵🎶*.\-–—]*$|^\[.*\]$|^\(.*\)$/;

/** Raw word chunks from transformers.js → clean words. */
export function cleanWords(chunks: { text: string; timestamp: [number, number | null] }[]): Word[] {
  const words: Word[] = [];
  for (const c of chunks) {
    const text = c.text.trim();
    if (!text || JUNK.test(text)) continue;
    const start = c.timestamp[0] ?? 0;
    let end = c.timestamp[1] ?? start + 0.3;
    if (end <= start) end = start + 0.12;
    words.push({ text, start, end });
  }
  return words;
}

/** Split a flat word list into lyric lines using pauses, punctuation and length. */
export function wordsToLines(words: Word[], opts = { gap: 0.7, maxWords: 8 }): Line[] {
  const lines: Line[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) lines.push({ id: newId(), words: cur });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (prev && cur.length) {
      const gap = w.start - prev.end;
      const endsSentence = /[.!?,;:]$/.test(prev.text) && cur.length >= 3;
      if (gap > opts.gap || endsSentence || cur.length >= opts.maxWords) flush();
    }
    cur.push(w);
  });
  flush();
  return lines;
}

export const lineStart = (l: Line) => l.words[0]?.start ?? 0;
export const lineEnd = (l: Line) => l.words[l.words.length - 1]?.end ?? 0;
export const lineText = (l: Line) => l.words.map((w) => w.text).join(' ');

/**
 * The user edited a line's text. Keep original timings if the word count matches,
 * otherwise spread the new words across the line's time span by character length.
 */
export function retimeLine(line: Line, text: string): Line {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return { ...line, words: [] };
  if (tokens.length === line.words.length) {
    return { ...line, words: line.words.map((w, i) => ({ ...w, text: tokens[i] })) };
  }
  return { ...line, words: spreadWords(tokens, lineStart(line), Math.max(lineEnd(line), lineStart(line) + 0.4)) };
}

export function spreadWords(tokens: string[], start: number, end: number): Word[] {
  const weights = tokens.map((t) => Math.max(2, t.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = start;
  return tokens.map((text, i) => {
    const d = ((end - start) * weights[i]) / total;
    const w = { text, start: t, end: t + d };
    t += d;
    return w;
  });
}

/** Move a line's start/end, scaling its word timings to fit. */
export function setLineSpan(line: Line, start: number, end: number): Line {
  const s0 = lineStart(line);
  const e0 = lineEnd(line);
  const k = e0 > s0 ? (end - start) / (e0 - s0) : 1;
  return {
    ...line,
    words: line.words.map((w) => ({ ...w, start: start + (w.start - s0) * k, end: start + (w.end - s0) * k })),
  };
}

export function mergeLines(a: Line, b: Line): Line {
  return { id: a.id, words: [...a.words, ...b.words] };
}

export function sortLines(lines: Line[]) {
  return [...lines].sort((a, b) => lineStart(a) - lineStart(b));
}

const pad = (n: number, l = 2) => String(Math.floor(n)).padStart(l, '0');
function srtTime(s: number) {
  s = Math.max(0, s);
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)},${pad((s % 1) * 1000, 3)}`;
}

export function toSrt(lines: Line[]) {
  return lines
    .filter((l) => l.words.length)
    .map((l, i) => `${i + 1}\n${srtTime(lineStart(l))} --> ${srtTime(lineEnd(l))}\n${lineText(l)}\n`)
    .join('\n');
}

export function formatTime(s: number) {
  if (!Number.isFinite(s)) s = 0;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
