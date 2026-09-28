import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from 'mediabunny';
import type { CaptionRenderer } from './render';
import { H, W } from './tiktok';

export interface ExportResult {
  blob: Blob;
  warnings: string[];
}

/**
 * Frame-accurate export entirely in the browser (WebCodecs): decode each source frame,
 * draw video + captions onto a 1080×1920 canvas, encode to H.264 MP4 with the original audio.
 */
export async function exportVideo(
  file: File,
  renderer: CaptionRenderer,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const warnings: string[] = [];
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error('No video track found in this file.');
  if (!(await videoTrack.canDecode())) {
    throw new Error("Your browser can't decode this video's codec. Try Chrome, or re-save the clip as H.264 MP4.");
  }
  const audioTrack = await input.getPrimaryAudioTrack();
  const duration = await input.computeDuration();

  const stats = await videoTrack.computePacketStats(120);
  const fps = Math.min(60, Math.max(24, Math.round(stats.averagePacketRate) || 30));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: W, height: H });
  if (!videoCodec) throw new Error("Your browser can't encode video. Please use a recent Chrome or Edge.");
  if (videoCodec !== 'avc') warnings.push(`Encoded as ${videoCodec.toUpperCase()} (H.264 unavailable in this browser).`);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  let audioSink: AudioBufferSink | null = null;
  if (audioTrack && (await audioTrack.canDecode())) {
    const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: audioTrack.numberOfChannels,
      sampleRate: audioTrack.sampleRate,
    });
    if (audioCodec) {
      if (audioCodec !== 'aac') warnings.push('Audio encoded as Opus (AAC unavailable in this browser).');
      audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH });
      output.addAudioTrack(audioSource);
      audioSink = new AudioBufferSink(audioTrack);
    } else warnings.push('Audio could not be encoded in this browser; exported without sound.');
  } else if (audioTrack) warnings.push("Couldn't decode the original audio; exported without sound.");

  await output.start();

  const sink = new CanvasSink(videoTrack, { poolSize: 2 });
  const frameCount = Math.max(1, Math.floor(duration * fps));
  const frameDur = 1 / fps;
  function* timestamps() {
    for (let i = 0; i < frameCount; i++) yield i * frameDur;
  }

  const doVideo = async () => {
    let i = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps())) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const t = i * frameDur;
      if (wrapped) {
        const c = wrapped.canvas;
        renderer.drawFrame(ctx as CanvasRenderingContext2D, t, c, c.width, c.height);
      } else {
        renderer.drawFrame(ctx as CanvasRenderingContext2D, t, null, 0, 0);
      }
      await videoSource.add(t, frameDur);
      i++;
      if (i % 5 === 0) onProgress(i / frameCount);
    }
    videoSource.close();
  };

  const doAudio = async () => {
    if (!audioSource || !audioSink) return;
    for await (const { buffer } of audioSink.buffers(0, duration)) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      await audioSource.add(buffer);
    }
    audioSource.close();
  };

  try {
    await Promise.all([doVideo(), doAudio()]);
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  }
  onProgress(1);
  const buf = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([buf], { type: 'video/mp4' }), warnings };
}
