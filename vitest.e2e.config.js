import { defineConfig } from 'vitest/config'

// Tests E2E navigateur (Chromium + vrai front buildé + vrai handler API sur faux Supabase).
// Lancer : yarn test:e2e   (build du front inclus)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.js'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
})
