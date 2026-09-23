import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  timeout: 120_000, // 2 minutes per test — enough for slow interactions
  retries: 0,
  workers: 1, // Serial execution so we don't burn CPU

  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
  },

  // Save videos into ./recordings
  outputDir: './recordings',

  // Disable reporting overhead — we just want video
  reporter: [['list'], ['json', { outputFile: './recordings/report.json' }]],
});
