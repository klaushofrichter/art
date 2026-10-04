import { defineConfig } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: BASE_URL || 'http://localhost:8080',
  },
  // Playwright starts the server against the test fixtures, waits for
  // /health, and stops it afterwards — in CI and on a laptop alike, so
  // `npm run test:e2e` is the whole instruction. Left out when BASE_URL points
  // the suite at a server somebody else is running. Locally an existing
  // server on :8080 is reused rather than fought over.
  webServer: BASE_URL ? undefined : {
    command: 'npm run build && node dist/server.js',
    url: 'http://localhost:8080/health',
    env: { PORT: '8080', ASSETS_DIR: path.join(__dirname, 'test', 'fixtures', 'assets') },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
