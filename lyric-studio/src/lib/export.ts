import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  canEncodeVideo,
  CanvasSink,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  type VideoCodec,
} from 'mediabunny';
import { codecName, fpsLabel, mbps, outputSize, targetBitrate, type ExportOptions, type SourceInfo } from './exportInfo';
import type { CaptionRenderer } from './render';
import { W } from './tiktok';

export interface ExportResult {
  blob: Blob;
  warnings: string[];
  /** What was actually written, for display. */
  summary: string;
}

const STANDARD_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 100, 119.88, 120, 240];

/** Read the clip's real resolution, frame rate, bitrates and codecs. */
export async function probeVideo(file: File): Promise<SourceInfo> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const v = await input.getPrimaryVideoTrack();
  if (!v) throw new Error('No video track found in this file.');
  const a = await input.getPrimaryAudioTrack();
  const stats = await v.computePacketStats();
  const aStats = a ? await a.computePacketStats(500) : null;
  // Frame-duration spread tells constant from variable frame rate.
  const sink = new EncodedPacketSink(v);
  const durs: number[] = [];
  for await (const p of sink.packets()) {
    durs.push(p.duration);
    if (durs.length >= 240) break;
  }
  durs.sort((x, y) => x - y);
  const variableFps = durs.length > 10 && durs[Math.floor(durs.length * 0.9)] - durs[Math.floor(durs.length * 0.1)] > 0.002;
  return {
    width: v.displayWidth,
    height: v.displayHeight,
    fps: stats.averagePacketRate,
    variableFps,
    videoBitrate: stats.averageBitrate || null,
    videoCodec: v.codec,
    audioCodec: a?.codec ?? null,
    audioBitrate: aStats?.averageBitrate || null,
    audioSampleRate: a?.sampleRate ?? null,
    audioChannels: a?.numberOfChannels ?? null,
    hdr: await v.hasHighDynamicRange().catch(() => false),
    duration: await input.computeDuration(),
  };
}

/**
 * Frame-accurate export entirely in the browser (WebCodecs): every source frame is decoded, drawn
 * with captions at its own timestamp, and re-encoded at the chosen resolution/bitrate. The audio
 * track is copied untouched whenever MP4 can hold it.
 */
export async function exportVideo(
  file: File,
  renderer: CaptionRenderer,
  opts: ExportOptions,
  onProgress: (p: number, phase?: string) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const warnings: string[] = [];
  const info = await probeVideo(file);
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const videoTrack = (await input.getPrimaryVideoTrack())!;
  if (!(await videoTrack.canDecode())) {
    throw new Error("Your browser can't decode this video's codec. Try Chrome, or re-save the clip as H.264 MP4.");
  }
  const audioTrack = await input.getPrimaryAudioTrack();
  const format = new Mp4OutputFormat({ fastStart: 'in-memory' });

  const out = outputSize(info, opts.resolution);
  const bitrate = targetBitrate(info, opts, out) ?? QUALITY_HIGH;

  // Codec: keep the source's when possible (and MP4 can carry it), else H.264.
  const wanted: VideoCodec[] = [];
  const src = info.videoCodec as VideoCodec | null;
  if (opts.codec === 'source' && src && format.getSupportedVideoCodecs().includes(src)) wanted.push(src);
  if (opts.codec === 'hevc') wanted.push('hevc');
  wanted.push('avc', 'hevc', 'vp9', 'av1');
  const encOpts = { width: out.width, height: out.height, bitrate };
  let videoCodec: VideoCodec | null = null;
  for (const c of [...new Set(wanted)]) {
    if (format.getSupportedVideoCodecs().includes(c) && (await canEncodeVideo(c, encOpts))) {
      videoCodec = c;
      break;
    }
  }
  videoCodec ??= await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: out.width, height: out.height });
  if (!videoCodec) throw new Error("Your browser can't encode video at this size. Try a lower resolution, or Chrome/Edge.");
  const wantedCodec = opts.codec === 'source' ? src : opts.codec;
  if (wantedCodec && videoCodec !== wantedCodec) {
    warnings.push(`${codecName(wantedCodec)} encoding isn't available in this browser, so the video was encoded as ${codecName(videoCodec)}.`);
  }
  if (info.hdr) {
    warnings.push(
      'Your clip is HDR. Browsers draw video in SDR, so the export is SDR and colors can look slightly different. For identical colors, film or export the clip in SDR first.',
    );
  }

  const scale = out.width / W;
  // Tag the track with the exact standard rate when the clip is constant-rate (e.g. 29.97, not 30).
  const std = STANDARD_FPS.find((f) => Math.abs(f - info.fps) / f < 0.004);
  const audioCodec = audioTrack?.codec ?? null;
  const copyAudio = !!(audioTrack && audioCodec && format.getSupportedAudioCodecs().includes(audioCodec));
  let encodeAudioCodec: Awaited<ReturnType<typeof getFirstEncodableAudioCodec>> = null;
  if (audioTrack && !copyAudio && (await audioTrack.canDecode())) {
    encodeAudioCodec = await getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: audioTrack.numberOfChannels,
      sampleRate: audioTrack.sampleRate,
      bitrate: info.audioBitrate ?? 256_000,
    });
    if (encodeAudioCodec) {
      warnings.push(`The original ${codecName(audioCodec)} audio can't go in an MP4 as-is, so it was converted to ${codecName(encodeAudioCodec)}.`);
    }
  }
  if (audioTrack && !copyAudio && !encodeAudioCodec) warnings.push("The audio couldn't be carried over in this browser; exported without sound.");

  // Timeline starts at the first frame, exactly like the preview player.
  const start = Math.max(0, await input.getFirstTimestamp());
  const total = Math.max(0.001, info.duration - start);

  /** One full render + encode. Returns the file and how many video bits the encoder actually produced. */
  const encodePass = async (videoBitrate: number | typeof QUALITY_HIGH, report: (p: number) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    renderer.pixelScale = scale;
    let videoBits = 0;

    const output = new Output({ format, target: new BufferTarget() });
    const videoSource = new CanvasSource(canvas, {
      codec: videoCodec!,
      bitrate: videoBitrate,
      bitrateMode: opts.bitrateMode ?? 'constant',
      keyFrameInterval: 2,
      latencyMode: 'quality',
      onEncodedPacket: (packet) => {
        videoBits += packet.data.byteLength * 8;
      },
    });
    output.addVideoTrack(videoSource, !info.variableFps && std ? { frameRate: std } : {});

    // Audio: copy the original packets bit-for-bit if MP4 supports the codec, else re-encode at the source bitrate.
    let audioCopy: EncodedAudioPacketSource | null = null;
    let audioEncode: AudioBufferSource | null = null;
    if (copyAudio) {
      audioCopy = new EncodedAudioPacketSource(audioCodec!);
      output.addAudioTrack(audioCopy);
    } else if (encodeAudioCodec) {
      audioEncode = new AudioBufferSource({ codec: encodeAudioCodec, bitrate: info.audioBitrate ?? 256_000 });
      output.addAudioTrack(audioEncode);
    }

    await output.start();
    const sink = new CanvasSink(videoTrack, { poolSize: 2 });
    let frames = 0;
    let lastTs = -1;

    const doVideo = async () => {
      // Every source frame, at its own timestamp: frame rate (incl. variable) is preserved exactly.
      for await (const wrapped of sink.canvases(start)) {
        if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
        const t = wrapped.timestamp - start;
        if (t <= lastTs) continue;
        lastTs = t;
        const c = wrapped.canvas;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        renderer.drawFrame(ctx as CanvasRenderingContext2D, t, c, c.width, c.height);
        await videoSource.add(t, wrapped.duration);
        if (++frames % 5 === 0) report(Math.min(0.99, t / total));
      }
      videoSource.close();
    };

    const doAudio = async () => {
      if (audioCopy && audioTrack) {
        const decoderConfig = (await audioTrack.getDecoderConfig()) ?? undefined;
        const meta = { decoderConfig };
        let max = -Infinity;
        for await (const packet of new EncodedPacketSink(audioTrack).packets()) {
          if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
          const ts = packet.timestamp - start;
          // Keep encoder-priming packets just before 0 (decoders need them to start cleanly); drop only
          // audio that ends well before the first frame, or packets arriving out of order.
          if (ts + packet.duration < -0.05 || ts < max) continue;
          max = ts;
          await audioCopy.add(packet.clone({ timestamp: ts }), meta);
        }
        audioCopy.close();
      } else if (audioEncode && audioTrack) {
        for await (const { buffer } of new AudioBufferSink(audioTrack).buffers(start)) {
          if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
          await audioEncode.add(buffer);
        }
        audioEncode.close();
      }
    };

    try {
      await Promise.all([doVideo(), doAudio()]);
      await output.finalize();
    } catch (err) {
      await output.cancel().catch(() => {});
      throw err;
    } finally {
      renderer.pixelScale = 1;
    }
    return { buf: (output.target as BufferTarget).buffer!, actual: videoBits / total };
  };

  let result = await encodePass(bitrate, (p) => onProgress(p));
  // Some encoders undershoot the requested bitrate. If this one came in >10% low, run one corrected pass.
  if (typeof bitrate === 'number' && result.actual < bitrate * 0.9) {
    const corrected = Math.round(Math.min(bitrate * 2, (bitrate * bitrate) / Math.max(1, result.actual)));
    onProgress(0, `Encoder came in at ${mbps(result.actual)}; re-encoding to hit ${mbps(bitrate)}…`);
    const second = await encodePass(corrected, (p) => onProgress(p, `Second pass to hit ${mbps(bitrate)}…`));
    if (Math.abs(second.actual - bitrate) < Math.abs(result.actual - bitrate)) result = second;
  }
  onProgress(1);

  const audioText = copyAudio ? `${codecName(audioCodec)} audio copied untouched` : encodeAudioCodec ? 'audio converted' : 'no audio';
  const summary =
    `${out.width}×${out.height} · ${fpsLabel(info.fps)} fps${info.variableFps ? ' (variable, kept frame-exact)' : ''} · ` +
    `${codecName(videoCodec)} ${mbps(result.actual)}${typeof bitrate === 'number' ? ` (target ${mbps(bitrate)})` : ''} · ${audioText}`;
  return { blob: new Blob([result.buf], { type: 'video/mp4' }), warnings, summary };
}
