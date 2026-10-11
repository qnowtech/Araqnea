import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the entire app into exactly 3 files for platforms like Qollab:
//   dist-qollab/index.html
//   dist-qollab/main.js   (all JS, including React/three, in one chunk)
//   dist-qollab/style.css (all CSS in one file)
// Images/fonts are inlined as base64 data URIs; public/ files are not copied.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'strip-crossorigin',
      enforce: 'post',
      // Platforms without CORS headers block <link>/<script> tags that carry
      // the crossorigin attribute — stripping it makes style.css load.
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(="")?/g, '')
      },
    },
  ],
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-qollab',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100 * 1024 * 1024, // inline every asset as base64
    rollupOptions: {
      output: {
        codeSplitting: false,
        entryFileNames: 'main.js',
        assetFileNames: (assetInfo) => {
          const names = assetInfo.names ?? []
          return names.some((n) => n.endsWith('.css')) ? 'style.css' : '[name][extname]'
        },
      },
    },
  },
})
