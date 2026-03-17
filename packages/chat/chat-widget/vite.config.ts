import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id: string) =>
        id === 'lit' ||
        id.startsWith('lit/') ||
        id === 'socket.io-client' ||
        id.startsWith('socket.io-client/'),
    },
    sourcemap: true,
    minify: false,
  },
});
