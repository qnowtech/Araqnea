import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // 'qiskit' is resolved by the Qollab runtime, not installed locally; the
      // import only runs when Araqnea itself runs as a Qollab project.
      external: ['qiskit'],
    },
  },
})
