import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  /**
   * We use '/Taskker/' as the base because the current live site 
   * is hosted at rodmon-rooxter.github.io/Taskker/.
   * * When the custom domain taskker.io is fully active, 
   * we will change this to '/'.
   */
  base: '/Taskker/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})