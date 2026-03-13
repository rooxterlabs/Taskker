import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Setting base to '/' ensures the app loads from the root of taskker.io
  base: '/', 
  plugins: [
    react(),
    tailwindcss(),
  ],
})