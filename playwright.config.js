import { defineConfig } from '@playwright/test'

// Tests de bout en bout. Par défaut contre la production (lecture seule).
// Les comptes de test sont lus depuis des variables d'environnement (voir tests/e2e/README.md).
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.js',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://kucibok.com',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
