/** Export settings and source-clip info. Kept free of heavy imports so the UI can use it directly. */

export interface SourceInfo {
  width: number;
  height: number;
  /** average frames per second, exact (e.g. 29.97) */
  fps: number;
  /** true when frame durations vary (typical for phone footage) */
  variableFps: boolean;
  /** bits per second, or null if unknown */
  videoBitrate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  audioBitrate: number | null;
  audioSampleRate: number | null;
  audioChannels: number | null;
  hdr: boolean;
  duration: number;
}

export interface ExportOptions {
  /** "source" = match the clip; otherwise the output width (height is always 16:9 × width) */
  resolution: 'source' | 1080 | 1440 | 2160;
  /** "source" = the clip's own video bitrate; otherwise Mbps */
  bitrate: 'source' | number;
  codec: 'source' | 'avc' | 'hevc';
  /** constant = hit the bitrate exactly (like your editor's CBR setting); variable = let the encoder save bits on easy scenes */
  bitrateMode?: 'constant' | 'variable';
}

export const DEFAULT_EXPORT: ExportOptions = { resolution: 'source', bitrate: 'source', codec: 'source', bitrateMode: 'constant' };

const CODEC_NAMES: Record<string, string> = { avc: 'H.264', hevc: 'HEVC', vp9: 'VP9', vp8: 'VP8', av1: 'AV1', aac: 'AAC', opus: 'Opus', mp3: 'MP3', flac: 'FLAC' };
export const codecName = (c: string | null) => (c ? (CODEC_NAMES[c] ?? c.toUpperCase()) : '—');
export const mbps = (bps: number | null) => (bps ? `${(bps / 1e6).toFixed(bps < 1e7 ? 1 : 0)} Mbps` : '—');
export const fpsLabel = (fps: number) => (Math.abs(fps - Math.round(fps)) < 0.01 ? String(Math.round(fps)) : fps.toFixed(2));

/** Output size for the chosen resolution. The frame is always 9:16; "source" keeps the clip's detail. */
export function outputSize(info: SourceInfo | null, res: ExportOptions['resolution']) {
  let w: number;
  if (res !== 'source') w = res;
  else if (!info) w = 1080;
  else {
    // How many source pixels land in a 1080×1920 frame (cover-cropped), snapped to standard sizes.
    const k = Math.min(info.width / 1080, info.height / 1920);
    w = k >= 1.9 ? 2160 : k >= 1.3 ? 1440 : 1080;
  }
  return { width: w, height: Math.round((w * 16) / 9 / 2) * 2 };
}

/** Target video bitrate in bits/s. */
export function targetBitrate(info: SourceInfo | null, opts: ExportOptions, out: { width: number; height: number }) {
  if (opts.bitrate !== 'source') return Math.round(opts.bitrate * 1e6);
  if (!info?.videoBitrate) return null;
  // Same bits per output pixel as the source had per used pixel, so a resized export keeps its quality.
  const used = Math.min(info.width * info.height, (info.height * 9) / 16 * info.height, info.width * ((info.width * 16) / 9));
  const ratio = Math.max(0.5, Math.min(2, (out.width * out.height) / Math.max(1, used)));
  return Math.round(info.videoBitrate * ratio);
}

