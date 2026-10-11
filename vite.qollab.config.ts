import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the app as a runnable Qollab JS project per the runtime contract
// (https://qollab.xyz/learn/docs/runtime-environment):
//   dist-qollab/index.html  (body content ONLY — the runtime drops <html>,
//                            <head>, <body> and does not run <script> tags)
//   dist-qollab/main.js     (TOP-LEVEL; required — index.html + main.js at the
//                            top level are what make a JS project runnable)
//   dist-qollab/main.css    (TOP-LEVEL; the ONLY stylesheet Qollab loads)
//
// Code splitting is off and images/fonts are inlined as base64 data URIs,
// keeping the file count at 3 (well under Qollab's 100-file limit);
// the public/ directory is not copied.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'qollab-index-body-only',
      enforce: 'post',
      // Reduce the built index.html to body content only:
      //   - strip <script>/<link> tags (the runtime ignores/never loads them;
      //     main.js and main.css are loaded automatically by name)
      //   - strip the <html>/<head>/<body> wrappers the runtime would drop
      transformIndexHtml(html) {
        const mount = html.match(/<div id="root"><\/div>/)?.[0] ?? '<div id="root"></div>'
        return `${mount}\n`
      },
    },
    {
      // Qollab's runtime evaluates main.js as the body of `new AsyncFunction(...)`,
      // so `import.meta` anywhere in the bundle is a SyntaxError. The qiskit load is
      // a `require("qiskit")` call (see qollabExporter.ts), so there is no dynamic
      // import to unwrap; this plugin just guards that no stray import.meta slips in.
      name: 'qollab-no-import-meta',
      enforce: 'post',
      generateBundle(_options, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type !== 'chunk') continue
          if (file.code.includes('import.meta')) {
            this.warn('dist-qollab bundle contains import.meta — Qollab will reject it')
          }
        }
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
      // 'qiskit' is provided by the Qollab runtime and must stay a bare import
      // in main.js for Qollab to resolve; it is never bundled.
      external: ['qiskit'],
      output: {
        codeSplitting: false,
        entryFileNames: 'main.js',
        assetFileNames: (assetInfo) => {
          const names = assetInfo.names ?? []
          return names.some((n) => n.endsWith('.css')) ? 'main.css' : '[name][extname]'
        },
      },
    },
  },
})
