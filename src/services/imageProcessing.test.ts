import { describe, expect, it } from 'vitest';
import { computeTargetSize, grayscaleAndContrast, MAX_LONG_SIDE } from './imageProcessing';
import { mapTesseractProgress } from './ocrService';

describe('OCR 전처리', () => {
  it('너무 큰 사진은 긴 변 기준으로 줄인다', () => {
    const r = computeTargetSize(4032, 3024); // iPhone 기본 사진
    expect(r.width).toBe(MAX_LONG_SIDE);
    expect(r.height).toBe(1800);
  });

  it('적당한 크기는 그대로 둔다', () => {
    expect(computeTargetSize(2000, 1500)).toMatchObject({ width: 2000, height: 1500, scale: 1 });
  });

  it('작은 사진은 최대 2배까지 키운다', () => {
    expect(computeTargetSize(500, 400).scale).toBe(2);
  });

  it('흑백 변환 + 대비 향상', () => {
    // 회색(100)과 밝은 회색(160) 두 픽셀 → 대비가 커져야 함
    const px = new Uint8ClampedArray([100, 100, 100, 255, 160, 160, 160, 255, 120, 60, 200, 128]);
    grayscaleAndContrast(px);
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
    expect(px[0]).toBeLessThan(100);
    expect(px[4]).toBeGreaterThan(160);
    expect(px[11]).toBe(255);
  });
});

describe('OCR 진행률', () => {
  it('단계별 진행률을 0~1로 합친다', () => {
    expect(mapTesseractProgress('loading tesseract core', 1).progress).toBeCloseTo(0.1);
    expect(mapTesseractProgress('recognizing text', 0).progress).toBeCloseTo(0.3);
    expect(mapTesseractProgress('recognizing text', 1).progress).toBeCloseTo(1);
    expect(mapTesseractProgress('recognizing text', 0.5).message).toBe('급수표를 읽고 있어요...');
  });
});
