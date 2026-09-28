import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // transformers.js ships its own wasm/onnx runtime; pre-bundling it breaks the worker.
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
});
