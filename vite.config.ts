import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],

  // GitHub Pagesの公開先に合わせて、ファイルの読み込み先を指定する
  base: '/workout-app/',
})