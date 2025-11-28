import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用相對路徑 './' 確保在 GitHub Pages 非根目錄下也能正確載入資源
  base: './',
});