import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // Inline (empty) PostCSS config stops Vite from walking up into the repo root and picking up
  // the Qualify app's Tailwind postcss.config.mjs, which isn't installed here.
  css: { postcss: {} },
  // transformers.js ships its own wasm/onnx runtime; pre-bundling it breaks the worker.
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
});
