import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const extensionBuild = mode === 'extension'
  return {
    base: extensionBuild ? './' : '/',
    resolve: {
      alias: extensionBuild ? [{
        find: '@vercel/analytics/react',
        replacement: fileURLToPath(new URL('./src/platform/NoAnalytics.tsx', import.meta.url)),
      }] : [],
    },
    define: {
      'import.meta.env.VITE_EXTENSION_BUILD': JSON.stringify(extensionBuild ? 'true' : 'false'),
    },
    plugins: [react()],
    build: {
      sourcemap: false,
      rollupOptions: {
        input: { main: 'index.html' },
      },
    },
  }
})
