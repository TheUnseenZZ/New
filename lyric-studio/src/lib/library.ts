import type { Line, Settings } from './types';
import type { Peaks } from './waveform';

/** A synced set of lyrics saved for reuse in future projects. */
export interface LibraryEntry {
  id: string;
  name: string;
  savedAt: number;
  lines: Line[];
  /** Loudness fingerprint of the audio the lyrics were synced to, so they can be auto-aligned to new clips. */
  audio?: { rate: number; data: string };
  /** Style that was used, optionally re-applied on load. */
  settings?: Settings;
}

const KEY = 'lyric-studio:library';
const FP_RATE = 50; // fingerprint samples per second

export function loadLibrary(): LibraryEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Returns an error message if the browser refused to store it (e.g. storage full or blocked). */
export function saveLibrary(list: LibraryEntry[]): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return null;
  } catch {
    return 'Your browser refused to save (storage full or blocked). Use "Export library" to keep a backup file.';
  }
}

/** Downsample the waveform envelope to a small 8-bit fingerprint (~0.7 KB per 10 s). */
export function encodeFingerprint(peaks: Peaks): { rate: number; data: string } {
  const env = resample(peaks.data, peaks.rate, FP_RATE);
  const bytes = new Uint8Array(env.length);
  for (let i = 0; i < env.length; i++) bytes[i] = Math.round(Math.max(0, Math.min(1, env[i])) * 255);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { rate: FP_RATE, data: btoa(s) };
}

export function decodeFingerprint(fp: { rate: number; data: string }): Float32Array {
  const s = atob(fp.data);
  const out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) / 255;
  return out;
}

function resample(data: Float32Array, from: number, to: number): Float32Array {
  const n = Math.floor((data.length * to) / from);
  const out = new Float32Array(n);
  const step = from / to;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * step);
    const b = Math.min(data.length, Math.floor((i + 1) * step));
    for (let j = a; j < b; j++) if (data[j] > m) m = data[j];
    out[i] = m;
  }
  return out;
}

/** Rising-edge onset strength, standardized; makes beats and syllables line up sharply. */
function onsets(env: Float32Array): Float32Array {
  const d = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) d[i] = Math.max(0, env[i] - env[i - 1]);
  let mean = 0;
  for (const v of d) mean += v;
  mean /= d.length || 1;
  let sd = 0;
  for (const v of d) sd += (v - mean) ** 2;
  sd = Math.sqrt(sd / (d.length || 1)) || 1;
  for (let i = 0; i < d.length; i++) d[i] = (d[i] - mean) / sd;
  return d;
}

/**
 * Find where the new clip sits relative to the audio the lyrics were saved from.
 * Returns `shift` in seconds to ADD to the saved timings (negative when the clip starts later
 * in the song) and a 0–1 confidence.
 */
export function findShift(saved: Float32Array, clip: Peaks): { shift: number; confidence: number } {
  const a = onsets(saved);
  const b = onsets(resample(clip.data, clip.rate, FP_RATE));
  const minOverlap = Math.max(FP_RATE * 2, Math.floor(Math.min(a.length, b.length) * 0.5));
  let best = { lag: 0, score: -Infinity };
  // lag = index in saved audio that lines up with index 0 of the clip.
  for (let lag = -(b.length - minOverlap); lag <= a.length - minOverlap; lag++) {
    const i0 = Math.max(0, -lag);
    const i1 = Math.min(b.length, a.length - lag);
    const n = i1 - i0;
    if (n < minOverlap) continue;
    let sum = 0;
    for (let i = i0; i < i1; i++) sum += a[i + lag] * b[i];
    const score = sum / n;
    if (score > best.score) best = { lag, score };
  }
  // Standardized signals: a perfect match scores ~1, unrelated audio ~0.
  return { shift: -best.lag / FP_RATE, confidence: Math.max(0, Math.min(1, best.score)) };
}

export function shiftLines(lines: Line[], dt: number): Line[] {
  return lines.map((l) => ({ ...l, words: l.words.map((w) => ({ ...w, start: w.start + dt, end: w.end + dt })) }));
}
