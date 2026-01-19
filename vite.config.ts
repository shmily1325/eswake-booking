import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 確保 React 和 ReactDOM 只使用一個版本，避免重複打包
    dedupe: ['react', 'react-dom', 'react-router-dom']
  },
  build: {
    chunkSizeWarningLimit: 2000, // 提高到 2000 KB
    rollupOptions: {
      output: {
        // 使用更簡單的方法：只分離 React 核心庫，其他都在一起
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'react-is']
        }
      }
    }
  }
})
