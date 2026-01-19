import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500, // 提高到 1500 KB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React 核心庫
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router-dom')) {
            return 'react-vendor'
          }
          
          // Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
          
          // Recharts (圖表庫，較大)
          if (id.includes('node_modules/recharts')) {
            return 'recharts'
          }
          
          // Sentry (監控庫)
          if (id.includes('node_modules/@sentry')) {
            return 'sentry'
          }
          
          // React Window 相關
          if (id.includes('node_modules/react-window') ||
              id.includes('node_modules/react-virtualized-auto-sizer')) {
            return 'react-window'
          }
          
          // PapaParse (CSV 處理)
          if (id.includes('node_modules/papaparse')) {
            return 'papaparse'
          }
          
          // LINE LIFF
          if (id.includes('node_modules/@line/liff')) {
            return 'line-liff'
          }
          
          // 其他 node_modules
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    }
  }
})
