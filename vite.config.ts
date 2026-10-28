import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^lucide$/,
        replacement: 'lucide/dist/cjs/lucide.js'
      }
    ]
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ArchEmailEditor',
      fileName: (format) => format === 'es' ? 'arch-email-editor.js' : 'arch-email-editor.umd.js',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      output: {
        exports: 'named',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css';
          return assetInfo.name || '';
        }
      }
    }
  }
});
