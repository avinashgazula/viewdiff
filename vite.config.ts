import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Monaco core → its own chunk (loaded once, cached for 1 year)
          if (id.includes('node_modules/monaco-editor/')) {
            return 'monaco-editor'
          }
          // Prettier core only — plugins stay as separate lazy chunks
          if (id.includes('node_modules/prettier/') && !id.includes('/plugins/') && !id.includes('plugin-xml')) {
            return 'prettier'
          }
        },
      },
    },
  },
})
