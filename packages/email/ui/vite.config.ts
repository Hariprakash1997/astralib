import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        api: resolve(__dirname, 'src/api/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id: string) => id === 'lit' || id.startsWith('lit/') || id.startsWith('@astralibx/'),
    },
    sourcemap: true,
    minify: false,
  },
});
