import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    // 確保 React 和 ReactDOM 只使用一個版本，避免重複打包
    dedupe: ['react', 'react-dom', 'react-router-dom']
  },
  // 生產環境移除 console.log 和 debugger
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  },
  build: {
    chunkSizeWarningLimit: 2000, // 提高到 2000 KB
    rollupOptions: {
      input: {
        app: resolve(process.cwd(), 'index.html'),
        offline: resolve(process.cwd(), 'offline.html'),
      },
      output: {
        // 使用更簡單的方法：只分離 React 核心庫，其他都在一起
        manualChunks(id) {
          if (id.includes('node_modules/@line/liff')) return 'line-liff'
          if (id.includes('node_modules/@supabase/supabase-js')) return 'supabase'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-is')) {
            return 'react-vendor'
          }
        },
      }
    }
  }
}))
