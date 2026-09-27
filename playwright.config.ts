import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * 모바일 WebKit(iPhone/iPad Safari 엔진) 중심 E2E 테스트.
 * 처음 한 번: npx playwright install webkit
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    locale: 'ko-KR',
  },
  projects: [
    { name: 'iPhone (WebKit)', use: { ...devices['iPhone 14'] } },
    { name: 'iPad (WebKit)', use: { ...devices['iPad (gen 7)'] } },
  ],
  webServer: {
    // base를 "/"로 고정해서 빌드 후 미리보기 서버로 테스트
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    env: { VITE_BASE: '/' },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
