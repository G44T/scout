import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('jspdf'))            return 'pdf-export';
          if (id.includes('xlsx'))             return 'excel-export';
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/react'))    return 'react-vendor';
        },
      },
    },
  },
})
