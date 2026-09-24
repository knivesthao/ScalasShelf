import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  timeout: 120_000, // 2 minutes per test — enough for slow interactions
  retries: 0,
  workers: 1, // Serial execution so we don't burn CPU

  // Phone-sized, since the pitch is a phone app for students in Laos: a 430×932 phone
  // layout recorded at 860×1864. Video capture ignores deviceScaleFactor, so the screen
  // is 860×1864 and scripts/record-demo.spec.ts zooms the page 2× instead.
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 860, height: 1864 },
    hasTouch: true,
    video: {
      mode: 'on',
      size: { width: 860, height: 1864 },
    },
  },

  // Save videos into ./recordings
  outputDir: './recordings',

  // Disable reporting overhead — we just want video
  reporter: [['list'], ['json', { outputFile: './recordings/report.json' }]],
});
