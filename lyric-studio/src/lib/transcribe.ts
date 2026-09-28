import { cleanWords, wordsToLines } from './lyrics';
import type { Line } from './types';
import type { WorkerIn, WorkerOut } from './transcribe.worker';

export const MODELS = [
  { id: 'onnx-community/whisper-base_timestamped', label: 'Fast', note: '~80 MB download, good for clear vocals' },
  { id: 'onnx-community/whisper-small_timestamped', label: 'Accurate', note: '~250 MB download, better on sung vocals' },
] as const;

export const LANGUAGES: { code: string | null; label: string }[] = [
  { code: null, label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'el', label: 'Greek' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
];

let worker: Worker | null = null;

export async function transcribe(
  file: File,
  opts: { model: string; language: string | null },
  onStatus: (message: string, progress?: number) => void,
): Promise<Line[]> {
  onStatus('Extracting audio…');
  const { decodeForWhisper } = await import('./audio');
  const audio = await decodeForWhisper(file);
  worker ??= new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  const downloads = new Map<string, number>();

  return new Promise<Line[]>((resolve, reject) => {
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === 'status') onStatus(m.message);
      else if (m.type === 'download') {
        downloads.set(m.file, m.progress);
        const vals = [...downloads.values()];
        onStatus('Downloading speech model (first time only)…', vals.reduce((a, b) => a + b, 0) / vals.length);
      } else if (m.type === 'error') reject(new Error(m.message));
      else if (m.type === 'result') resolve(wordsToLines(cleanWords(m.chunks)));
    };
    w.onerror = (e) => reject(new Error(e.message || 'Speech model crashed'));
    const msg: WorkerIn = { audio, model: opts.model, language: opts.language };
    w.postMessage(msg);
  });
}
