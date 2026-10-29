import { randomUUID } from 'node:crypto';
import { defineConfig } from '@playwright/test';
import { E2E_ORIGIN, E2E_USERNAME, E2E_PASSWORD } from './tests/e2e/support/constants.mjs';
import { assertTestDatabase } from './tests/e2e/support/database.mjs';

assertTestDatabase();
process.env.GOLIAT_E2E_SCHEMA ||= `e2e_${randomUUID().replaceAll('-', '')}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/e2e/support/setup.mjs',
  use: {
    baseURL: E2E_ORIGIN,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'es-desktop',
      metadata: { locale: 'es' },
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'en-mobile',
      metadata: { locale: 'en' },
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'node tests/e2e/support/startServer.mjs',
    url: `${E2E_ORIGIN}/api/health/`,
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: '4100',
      SITE_URL: `${E2E_ORIGIN}/`,
      AUTH_URL: E2E_ORIGIN,
      AUTH_SECRET: 'goliat-e2e-only-secret-with-at-least-32-bytes',
      DASHBOARD_AUTH_ENABLED: 'true',
      DASHBOARD_AUTH_MODE: 'demo',
      DASHBOARD_USERNAME: E2E_USERNAME,
      DASHBOARD_PASSWORD: E2E_PASSWORD,
      LOG_ENABLED: 'false',
      LOG_LEVEL: 'info',
      LOG_HTTP_ENABLED: 'false',
      DB_SSL: 'false',
      DB_POOL_SIZE: '3',
      DB_QUERY_TIMEOUT_MS: '10000',
      PGOPTIONS: `-c search_path=${process.env.GOLIAT_E2E_SCHEMA}`,
      AZURE_STORAGE_ACCOUNT_URL: '',
      AZURE_FUNCTION_BASE_URL: '',
      AZURE_FUNCTION_SCOPE: '',
      INVENTORY_REFRESH_TIMEOUT_MS: '10000',
    },
  },
});
