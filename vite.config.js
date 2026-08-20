import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// vite 8 / rolldown only accepts the function form of manualChunks
const CHUNKS = {
  'vendor-vue': ['vue', 'vue-router', 'pinia'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-charts': ['lightweight-charts', 'chart.js', 'vue-chartjs', 'chartjs-adapter-date-fns'],
  'vendor-dates': ['date-fns'],
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          for (const [chunk, pkgs] of Object.entries(CHUNKS)) {
            if (pkgs.some(p => id.includes(`node_modules/${p}/`))) return chunk
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
