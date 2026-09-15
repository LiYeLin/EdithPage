import { defineConfig } from 'vitest/config'

const legacyNodeTestFiles = new Set([
  'tests/bubble-float.test.ts',
  'tests/bubble-highlights.test.ts',
  'tests/bubble-layout.test.ts',
  'tests/liquid-demo.test.ts',
  'tests/liquid-drag.test.ts',
  'tests/liquid-material.test.ts',
  'tests/move-site.test.mjs',
  'tests/site-icons.test.ts',
  'tests/templates.test.ts',
])

export default defineConfig({
  // Keep the existing node:test sources runnable without editing them, while
  // letting Vitest aggregate their coverage with the component project.
  plugins: [{
    name: 'edith-node-test-compat',
    enforce: 'pre',
    transform(code, id) {
      const relativeId = id.split('?', 1)[0].replaceAll('\\', '/').split('/tests/').at(-1)
      if (!relativeId || !legacyNodeTestFiles.has(`tests/${relativeId}`) || !code.includes('node:test')) return null
      return code
        .replace(/import\s+test\s+from\s+['"]node:test['"]/g, "import { test } from 'vitest'")
        .replace(/from\s+['"]node:test['"]/g, "from 'vitest'")
    },
  }],
  test: {
    environment: 'node',
    // Project scripts can omit `run`; this keeps them one-shot while allowing
    // callers to append either a file path or a single explicit `--run`.
    watch: false,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        test: {
          name: 'logic',
          include: ['tests/**/*.test.{ts,mts,cts,js,mjs,cjs}'],
          exclude: ['tests/e2e/**', 'tests/fixtures/**'],
        },
      },
      {
        test: {
          name: 'component',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.{tsx,jsx}'],
          exclude: ['tests/e2e/**', 'tests/fixtures/**'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/types.ts',
        'src/templates/types.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
})
