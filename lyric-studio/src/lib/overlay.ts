import type { CaptionRenderer } from './render';
import { W } from './tiktok';

export interface OverlayOptions {
  width: number;
  height: number;
  /** frames per second; 29.97 / 59.94 / 23.976 are handled as exact NTSC rates */
  fps: number;
  duration: number;
  /** Include the style's darkening / vignette layers (off = only captions and payoff moments). */
  shading?: boolean;
}

/** Exact frame duration for NTSC-style rates (29.97 is really 30000/1001). */
function frameTime(fps: number) {
  for (const base of [24, 30, 60, 120]) {
    if (Math.abs(fps - (base * 1000) / 1001) < 0.01) return 1001 / (base * 1000);
  }
  return 1 / fps;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP writer (stored, no compression: PNGs are already compressed). */
class ZipWriter {
  private parts: BlobPart[] = [];
  private central: Uint8Array[] = [];
  private offset = 0;
  private count = 0;

  add(name: string, data: Uint8Array) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    this.parts.push(local.buffer, nameBytes as BlobPart, data as BlobPart);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint32(42, this.offset, true);
    const entry = new Uint8Array(46 + nameBytes.length);
    entry.set(new Uint8Array(cen.buffer), 0);
    entry.set(nameBytes, 46);
    this.central.push(entry);

    this.offset += 30 + nameBytes.length + data.length;
    this.count++;
  }

  finish(): Blob {
    const size = this.central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.count, true);
    end.setUint16(10, this.count, true);
    end.setUint32(12, size, true);
    end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...(this.central as BlobPart[]), end.buffer], { type: 'application/zip' });
  }
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));

/**
 * Render the captions alone, on transparent frames, as a numbered PNG sequence in a ZIP.
 * One PNG per frame at the clip's frame rate, so it lines up frame-for-frame when stacked above the
 * clip in DaVinci Resolve / Premiere / After Effects.
 */
export async function exportOverlay(
  renderer: CaptionRenderer,
  opts: OverlayOptions,
  name: string,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<{ blob: Blob; frames: number }> {
  const dt = frameTime(opts.fps);
  const frames = Math.max(1, Math.round(opts.duration / dt));
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext('2d')!;
  const scale = opts.width / W;
  const zip = new ZipWriter();
  const digits = Math.max(6, String(frames).length);
  const folder = `${name}_captions`;

  renderer.pixelScale = scale;
  renderer.overlayShading = !!opts.shading;
  try {
    let emptyPng: Uint8Array | null = null;
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const t = i * dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      renderer.drawFrame(ctx, t, null, 0, 0, true);
      // Frames with nothing on screen are identical; encode that PNG once and reuse it.
      const blank = !renderer.hasContent(t);
      let png: Uint8Array;
      if (blank && emptyPng) png = emptyPng;
      else {
        png = new Uint8Array(await (await toPng(canvas)).arrayBuffer());
        if (blank) emptyPng = png;
      }
      zip.add(`${folder}/${folder}_${String(i).padStart(digits, '0')}.png`, png);
      if (i % 5 === 0) onProgress(i / frames);
    }
  } finally {
    renderer.pixelScale = 1;
    renderer.overlayShading = false;
  }

  const fpsText = Math.abs(opts.fps - Math.round(opts.fps)) < 0.01 ? String(Math.round(opts.fps)) : opts.fps.toFixed(3).replace(/0+$/, '');
  const readme = `Lyric Studio: transparent captions
===================================
${frames} frames · ${opts.width}×${opts.height} · ${fpsText} fps · PNG with transparency (straight alpha)
Frame 0 = the first frame of your clip.

DaVinci Resolve
1. Unzip this file.
2. Media Pool → right-click → Import Media… → pick the "${folder}" folder.
   It appears as ONE clip (an image sequence).
   (If you see single images instead: Media Pool ⋯ menu → Frame Display Mode → Sequence.)
3. Right-click the clip → Clip Attributes → Video Frame Rate = ${fpsText}, if it isn't already.
4. Put your video on Video 1 and the captions on Video 2, both starting on the same frame.
   Timeline resolution ${opts.width}×${opts.height} (vertical), frame rate ${fpsText}.
5. Keep the captions clip at 100% size. If your video isn't 9:16, set it to "Scale to fill"
   so it's cropped the same way as the preview.

Premiere Pro: File → Import → select the first PNG → tick "Image Sequence".
  Then right-click → Modify → Interpret Footage → ${fpsText} fps.
After Effects: File → Import → first PNG → "PNG Sequence" → set the frame rate to ${fpsText}.

Not included (they change the video itself, not the layer on top): camera punch-zoom,
blurred "fit" background, film grain. Add those in your editor if you want them.
`;
  zip.add(`${folder}/README.txt`, new TextEncoder().encode(readme));
  onProgress(1);
  return { blob: zip.finish(), frames };
}
