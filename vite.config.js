import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework — cached across all pages
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charts — only loaded on pages that use them
          'vendor-charts': ['lightweight-charts', 'chart.js', 'vue-chartjs', 'chartjs-adapter-date-fns'],
          // Date utils
          'vendor-dates': ['date-fns'],
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600
  }
})
