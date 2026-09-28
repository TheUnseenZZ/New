import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';

const TARGET_RATE = 16000;

/** Decode the video's soundtrack to 16 kHz mono Float32, the format Whisper expects. */
export async function decodeForWhisper(file: File): Promise<Float32Array> {
  let buffer: AudioBuffer;
  try {
    const ctx = new OfflineAudioContext(1, 1, TARGET_RATE);
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    // Some containers (e.g. certain .mov files) aren't handled by decodeAudioData; demux ourselves.
    buffer = await decodeWithMediabunny(file);
  }
  return toMono16k(buffer);
}

async function decodeWithMediabunny(file: File): Promise<AudioBuffer> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryAudioTrack();
  if (!track) throw new Error('This video has no audio track.');
  const sink = new AudioBufferSink(track);
  const parts: AudioBuffer[] = [];
  for await (const { buffer } of sink.buffers()) parts.push(buffer);
  if (!parts.length) throw new Error('Could not decode the audio in this video.');
  const rate = parts[0].sampleRate;
  const length = parts.reduce((a, b) => a + b.length, 0);
  const out = new AudioBuffer({ length, sampleRate: rate, numberOfChannels: 1 });
  const data = out.getChannelData(0);
  let offset = 0;
  for (const p of parts) {
    const mono = new Float32Array(p.length);
    for (let c = 0; c < p.numberOfChannels; c++) {
      const ch = p.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / p.numberOfChannels;
    }
    data.set(mono, offset);
    offset += p.length;
  }
  return out;
}

async function toMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === TARGET_RATE && buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const length = Math.ceil(buffer.duration * TARGET_RATE);
  const off = new OfflineAudioContext(1, length, TARGET_RATE);
  const src = off.createBufferSource();
  src.buffer = buffer;
  src.connect(off.destination); // down-mixes to mono automatically
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);
}
