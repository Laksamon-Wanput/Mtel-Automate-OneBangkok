// @ts-check
import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  testDir: './tests/api',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.API_BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'api' }],
});
