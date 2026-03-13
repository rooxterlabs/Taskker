import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  /**
   * Setting base to '' (empty string) or './' (relative) 
   * makes the app work regardless of whether it's in a subfolder 
   * or on a custom root domain.
   */
  base: '', 
  plugins: [
    react(),
    tailwindcss(),
  ],
}