import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        api: resolve(__dirname, 'src/api/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id: string) => id === 'lit' || id.startsWith('lit/'),
    },
    sourcemap: true,
    minify: false,
  },
});
