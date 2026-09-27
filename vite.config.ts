/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages base path 자동 계산
 *  - GitHub Actions에서는 GITHUB_REPOSITORY="사용자/저장소" 값이 주어진다.
 *  - 저장소 이름이 "사용자.github.io"면 루트("/")에 배포되므로 base는 "/".
 *  - 그 외에는 "/저장소이름/" (예: /stella-batssumon/)
 *  - 직접 지정하려면 VITE_BASE 환경 변수를 사용 (예: VITE_BASE=/my-path/)
 */
function resolveBase(): string {
  const explicit = process.env.VITE_BASE;
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (process.env.GITHUB_ACTIONS === 'true' && repo) {
    return repo.toLowerCase().endsWith('.github.io') ? '/' : `/${repo}/`;
  }
  return '/';
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: ['es2020', 'safari15'],
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
