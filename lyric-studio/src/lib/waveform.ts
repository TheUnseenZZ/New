export interface Peaks {
  data: Float32Array;
  /** buckets per second */
  rate: number;
}

/** Loudness envelope of the video's audio for drawing the timeline waveform (0..1 per bucket). */
export async function computePeaks(file: File, rate = 100): Promise<Peaks> {
  const { decodeForWhisper } = await import('./audio');
  const pcm = await decodeForWhisper(file); // 16 kHz mono
  const bucket = Math.floor(16000 / rate);
  const n = Math.ceil(pcm.length / bucket);
  const data = new Float32Array(n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const end = Math.min(pcm.length, (i + 1) * bucket);
    for (let j = i * bucket; j < end; j++) {
      const v = Math.abs(pcm[j]);
      if (v > m) m = v;
    }
    data[i] = m;
    if (m > max) max = m;
  }
  if (max > 0) for (let i = 0; i < n; i++) data[i] /= max;
  return { data, rate };
}
