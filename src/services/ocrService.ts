/**
 * OCR 서비스. 기본 구현은 브라우저 안에서 동작하는 Tesseract.js(kor).
 * 사진은 외부 서버로 전송되지 않는다. (처음 한 번 한국어 인식 데이터만 내려받는다)
 *
 * 나중에 AI OCR API로 바꾸려면 OcrEngine 인터페이스를 구현한 엔진을 setOcrEngine()으로 교체하면 된다.
 */

export interface OcrProgress {
  /** 0 ~ 1 */
  progress: number;
  message: string;
}

export interface OcrResult {
  text: string;
  /** 0 ~ 100 */
  confidence: number;
}

export interface OcrEngine {
  recognize(image: HTMLCanvasElement | Blob, onProgress?: (p: OcrProgress) => void): Promise<OcrResult>;
}

const STATUS_MESSAGES: Record<string, string> = {
  'loading tesseract core': '글자 인식 도구를 준비하고 있어요...',
  'initializing tesseract': '글자 인식 도구를 준비하고 있어요...',
  'initialized tesseract': '글자 인식 도구를 준비하고 있어요...',
  'loading language traineddata': '한국어 사전을 불러오고 있어요...',
  'loaded language traineddata': '한국어 사전을 불러오고 있어요...',
  'initializing api': '급수표를 읽을 준비를 하고 있어요...',
  'initialized api': '급수표를 읽을 준비를 하고 있어요...',
  'recognizing text': '급수표를 읽고 있어요...',
};

/** Tesseract 단계별 진행률을 하나의 0~1 진행률로 합친다 */
export function mapTesseractProgress(status: string, progress: number): OcrProgress {
  const p = Math.min(1, Math.max(0, progress || 0));
  let overall: number;
  if (status === 'recognizing text') overall = 0.3 + p * 0.7;
  else if (status.includes('traineddata')) overall = 0.1 + p * 0.15;
  else if (status.includes('api')) overall = 0.25 + p * 0.05;
  else overall = p * 0.1;
  return { progress: overall, message: STATUS_MESSAGES[status] ?? '급수표를 읽고 있어요...' };
}

export class TesseractOcrEngine implements OcrEngine {
  async recognize(image: HTMLCanvasElement | Blob, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
    // 큰 라이브러리이므로 필요할 때만 불러온다
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    let last = 0;
    const worker = await createWorker('kor', OEM.LSTM_ONLY, {
      logger: (m: { status: string; progress: number }) => {
        const mapped = mapTesseractProgress(m.status, m.progress);
        // 진행률이 뒤로 가지 않도록
        last = Math.max(last, mapped.progress);
        onProgress?.({ progress: last, message: mapped.message });
      },
    });
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      });
      const { data } = await worker.recognize(image);
      onProgress?.({ progress: 1, message: '다 읽었어요!' });
      return { text: data.text ?? '', confidence: data.confidence ?? 0 };
    } finally {
      // iPhone 메모리 절약을 위해 매번 종료
      await worker.terminate();
    }
  }
}

let engine: OcrEngine = new TesseractOcrEngine();

export function setOcrEngine(next: OcrEngine): void {
  engine = next;
}

export function recognizeImage(
  image: HTMLCanvasElement | Blob,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  return engine.recognize(image, onProgress);
}
