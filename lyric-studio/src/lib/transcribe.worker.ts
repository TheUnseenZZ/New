/// <reference lib="webworker" />
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

export type WorkerIn = { audio: Float32Array; model: string; language: string | null };
export type WorkerOut =
  | { type: 'status'; message: string }
  | { type: 'download'; file: string; progress: number }
  | { type: 'result'; chunks: { text: string; timestamp: [number, number | null] }[]; device: string }
  | { type: 'error'; message: string };

const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

let current: { model: string; device: string; asr: AutomaticSpeechRecognitionPipeline } | null = null;

async function hasWebGPU() {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function create(model: string, device: 'webgpu' | 'wasm') {
  return (await pipeline('automatic-speech-recognition', model, {
    device,
    // fp32 encoder keeps word timings accurate; the decoder quantizes well.
    dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (p: { status: string; file?: string; progress?: number }) => {
      if (p.status === 'progress' && p.file) post({ type: 'download', file: p.file, progress: p.progress ?? 0 });
    },
  })) as AutomaticSpeechRecognitionPipeline;
}

async function load(model: string) {
  if (current?.model === model) return current;
  let device: 'webgpu' | 'wasm' = (await hasWebGPU()) ? 'webgpu' : 'wasm';
  post({ type: 'status', message: `Loading speech model (${device === 'webgpu' ? 'GPU' : 'CPU'})…` });
  let asr: AutomaticSpeechRecognitionPipeline;
  try {
    asr = await create(model, device);
  } catch (err) {
    if (device === 'wasm') throw err;
    // Some GPUs/drivers can't run the WebGPU build; the CPU path is slower but works everywhere.
    device = 'wasm';
    post({ type: 'status', message: 'GPU not usable, loading CPU version…' });
    asr = await create(model, device);
  }
  current = { model, device, asr };
  return current;
}

// If a model repo is missing or fails to load, fall back to one known to exist.
const FALLBACK = 'onnx-community/whisper-base_timestamped';

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  try {
    const { audio, model, language } = e.data;
    let loaded;
    try {
      loaded = await load(model);
    } catch (err) {
      if (model === FALLBACK) throw err;
      post({ type: 'status', message: 'Accurate model unavailable, using the Fast model instead…' });
      loaded = await load(FALLBACK);
    }
    const { asr, device } = loaded;
    post({ type: 'status', message: 'Listening to your track…' });
    const out = await asr(audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe',
      ...(language ? { language } : {}),
    });
    const result = Array.isArray(out) ? out[0] : out;
    const chunks = (result as { chunks?: { text: string; timestamp: [number, number | null] }[] }).chunks ?? [];
    post({ type: 'result', chunks, device });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
