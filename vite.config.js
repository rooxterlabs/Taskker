import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  /**
   * Setting base to './' (relative) ensures the app loads correctly 
   * whether it's on rodmon-rooxter.github.io/Taskker/ 
   * or directly on taskker.io.
   */
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
})