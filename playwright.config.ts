import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Where the suite points:
 *  - nothing set: Playwright builds and starts the server itself against the
 *    test fixtures (a laptop);
 *  - BASE_URL=http://localhost:8080: a server somebody else started, which in
 *    production-checks.yml is the Docker image the release will ship, with the
 *    fixtures mounted where the cluster mounts the real pictures;
 *  - BASE_URL=https://art.klaushofrichter.net with --grep @live: the live
 *    site, after a release and daily (live-check.yml). Only read-only tests
 *    carry @live: they only GET, never POST, and there is no sign-in.
 *
 * kube-setup's "public web pages" baseline
 * (docs/cluster-deployment-requirements.md, §4), adapted from
 * klaushofrichter/christina.art, www-klaushofrichter and www-skylar-technology.
 */
const BASE_URL = process.env.BASE_URL;
const LIVE = BASE_URL?.startsWith('https://');

// For machines with a Chromium outside Playwright's cache. Unset in CI, which
// installs its own browsers.
const chromiumLaunch = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

// The behavioural suite (smoke.spec.ts) drives the rooms with a mouse and a
// keyboard at chosen window sizes, and sets its own viewport and touch
// emulation where it matters; it is written for one desktop browser and runs
// in that one. The public-page specs (site, a11y, quality) run in all four.
const PUBLIC_ONLY = /smoke\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // One retry absorbs a runner hiccup, but a test that needed it fails the
  // run anyway: in christina.art a "passed on retry" in Firefox and WebKit was
  // a real layout bug, not noise (kube-setup vault, Gotchas).
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  forbidOnly: !!process.env.CI,
  timeout: LIVE ? 60_000 : 30_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Desktop Chrome, an Android phone, an iPhone (WebKit is Safari's engine)
  // and desktop Firefox: the four a visitor arrives on.
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunch } },
    { name: 'phone-chromium', testIgnore: PUBLIC_ONLY, use: { ...devices['Pixel 7'], launchOptions: chromiumLaunch } },
    { name: 'phone-webkit', testIgnore: PUBLIC_ONLY, use: { ...devices['iPhone 13'] } },
    { name: 'desktop-firefox', testIgnore: PUBLIC_ONLY, use: { ...devices['Desktop Firefox'] } },
  ],
  // Playwright starts the server against the test fixtures, waits for
  // /health, and stops it afterwards. Left out when BASE_URL points the suite
  // at a server somebody else is running. Locally an existing server on :8080
  // is reused rather than fought over.
  webServer: BASE_URL ? undefined : {
    command: 'npm run build && node dist/server.js',
    url: 'http://localhost:8080/health',
    env: { PORT: '8080', ASSETS_DIR: path.join(__dirname, 'test', 'fixtures', 'assets') },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
