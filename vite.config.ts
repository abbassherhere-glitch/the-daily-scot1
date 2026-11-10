import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Set DISABLE_HMR=true to turn off hot reloading.
      hmr: process.env.DISABLE_HMR !== 'true',
      // File watching is turned off with it, to save CPU.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
