/**
 * OCR 정확도를 높이기 위한 Canvas 전처리: 회전 → 리사이즈 → 흑백 → 대비 향상
 */

export const MAX_LONG_SIDE = 2400;
export const MIN_LONG_SIDE = 1400;

/** 너무 크면 줄이고, 너무 작으면 적당히 키운다 (글자 크기 확보) */
export function computeTargetSize(width: number, height: number): { width: number; height: number; scale: number } {
  const long = Math.max(width, height);
  let scale = 1;
  if (long > MAX_LONG_SIDE) scale = MAX_LONG_SIDE / long;
  else if (long < MIN_LONG_SIDE) scale = Math.min(2, MIN_LONG_SIDE / long);
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

/**
 * RGBA 픽셀을 흑백으로 바꾸고 명암을 늘린다 (in-place).
 * 상·하위 1% 밝기를 기준으로 히스토그램을 펴서 종이 그림자·흐린 연필을 보정한다.
 */
export function grayscaleAndContrast(data: Uint8ClampedArray, strength = 1.25): void {
  const n = data.length / 4;
  if (n === 0) return;
  const hist = new Uint32Array(256);
  const gray = new Uint8ClampedArray(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const g = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    gray[i] = g;
    hist[gray[i]]++;
  }
  const cut = n * 0.01;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255; lo++) {
    acc += hist[lo];
    if (acc > cut) break;
  }
  for (let acc = 0; hi > 0; hi--) {
    acc += hist[hi];
    if (acc > cut) break;
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let v = ((gray[i] - lo) / range) * 255;
    v = (v - 128) * strength + 128; // 추가 대비
    const c = v < 0 ? 0 : v > 255 ? 255 : v;
    data[p] = data[p + 1] = data[p + 2] = c;
    data[p + 3] = 255;
  }
}

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 열 수 없어요.'));
    };
    img.src = url;
  });
}

/**
 * 사진 → 전처리된 canvas.
 * iOS Safari는 이미지를 그릴 때 EXIF 방향을 자동 적용하므로 rotation은 사용자가 추가로 돌린 각도만 의미한다.
 */
export async function preprocessImage(file: Blob, rotation: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(file);
  const rot = ((rotation % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const { width, height } = computeTargetSize(swap ? srcH : srcW, swap ? srcW : srcH);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas를 사용할 수 없어요.');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  const drawW = swap ? height : width;
  const drawH = swap ? width : height;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  grayscaleAndContrast(imageData.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
