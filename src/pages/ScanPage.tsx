import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ProgressBar } from '../components/Controls';
import { Monster } from '../components/Monster';
import { TopBar } from '../components/TopBar';
import { loadImage, preprocessImage } from '../services/imageProcessing';
import { recognizeImage } from '../services/ocrService';
import { useApp } from '../store/AppContext';
import { parseDictationText } from '../utils/dictationParser';
import { sheetFromParsed } from '../utils/sheet';

type Phase = 'pick' | 'preview' | 'reading' | 'error';

export function ScanPage() {
  const { back, navigate } = useApp();
  const [phase, setPhase] = useState<Phase>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('급수표를 읽고 있어요...');
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const albumInput = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  useEffect(
    () => () => {
      runRef.current++; // 화면을 떠나면 진행 중 OCR 결과는 버린다
    },
    [],
  );

  // 미리보기: 회전을 반영해 작은 canvas에 그린다 (사진은 메모리에만 존재)
  useEffect(() => {
    if (!file || phase !== 'preview') return;
    let alive = true;
    loadImage(file)
      .then((img) => {
        const canvas = canvasRef.current;
        if (!alive || !canvas) return;
        const swap = rotation % 180 !== 0;
        const maxSide = 1000;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        canvas.width = swap ? h : w;
        canvas.height = swap ? w : h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      })
      .catch(() => {
        if (!alive) return;
        setError('사진을 열 수 없어요. 다른 사진을 골라 주세요.');
        setPhase('error');
      });
    return () => {
      alive = false;
    };
  }, [file, rotation, phase]);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // 같은 사진을 다시 골라도 change가 발생하도록
    if (!f) return;
    setFile(f);
    setRotation(0);
    setPhase('preview');
  };

  const reset = () => {
    runRef.current++;
    setFile(null);
    setRotation(0);
    setProgress(0);
    setError('');
    setPhase('pick');
  };

  const startOcr = useCallback(async () => {
    if (!file) return;
    const run = ++runRef.current;
    setPhase('reading');
    setProgress(0);
    setMessage('사진을 정리하고 있어요...');
    try {
      const canvas = await preprocessImage(file, rotation);
      if (run !== runRef.current) return;
      const result = await recognizeImage(canvas, (p) => {
        if (run !== runRef.current) return;
        setProgress(p.progress);
        setMessage(p.message);
      });
      if (run !== runRef.current) return;
      // 사진은 더 이상 필요 없으므로 메모리에서 놓아준다
      canvas.width = 0;
      canvas.height = 0;
      setFile(null);

      const parsed = parseDictationText(result.text);
      const sheet = sheetFromParsed(parsed);
      const total = parsed.rounds.reduce((n, r) => n + r.sentences.length, 0);
      let notice: string | undefined;
      if (total === 0) notice = '문장을 찾지 못했어요. 아래에 직접 입력하거나 사진을 다시 찍어 주세요.';
      else if (!parsed.roundsDetected)
        notice = '회차 표시를 찾지 못해 전체 문장을 하나로 모았어요. 확인 후 고쳐 주세요.';
      else notice = `${parsed.rounds.length}개 회차를 찾았어요. 시험 볼 회차를 고르고 틀린 글자를 고쳐 주세요.`;

      navigate({ name: 'editor', sheet, isNew: true, rawText: result.text, notice }, { replace: true });
    } catch (e) {
      if (run !== runRef.current) return;
      console.error(e);
      setError(
        navigator.onLine
          ? '글자를 읽는 중에 문제가 생겼어요. 다시 시도하거나 직접 입력해 주세요.'
          : '처음 한 번은 한국어 글자 인식 데이터를 내려받아야 해서 인터넷 연결이 필요해요.',
      );
      setPhase('error');
    }
  }, [file, rotation, navigate]);

  return (
    <main className="page">
      <TopBar title="급수표 찍기" onBack={back} />

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onPick}
        aria-label="카메라로 급수표 촬영"
        data-testid="camera-input"
      />
      <input
        ref={albumInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onPick}
        aria-label="사진 앱에서 급수표 선택"
        data-testid="album-input"
      />

      {phase === 'pick' && (
        <section className="stack">
          <div className="card tip-card">
            <Monster size={72} />
            <div>
              <p className="tip-card__title">이렇게 찍으면 잘 읽어요</p>
              <ul className="tip-list">
                <li>급수표를 평평한 곳에 놓아 주세요</li>
                <li>그림자 없이 밝은 곳에서 찍어 주세요</li>
                <li>글자가 화면을 가득 채우게 찍어 주세요</li>
              </ul>
            </div>
          </div>
          <button type="button" className="btn btn--primary btn--xl" onClick={() => cameraInput.current?.click()}>
            📷 카메라로 찍기
          </button>
          <button type="button" className="btn btn--secondary btn--lg" onClick={() => albumInput.current?.click()}>
            🖼️ 사진 앱에서 고르기
          </button>
          <button type="button" className="link-btn" onClick={() => navigate({ name: 'manual' }, { replace: true })}>
            📝 사진 없이 직접 입력하기
          </button>
          <p className="privacy-note">🔒 사진은 이 기기 안에서만 읽고, 어디에도 올리거나 저장하지 않아요.</p>
        </section>
      )}

      {phase === 'preview' && (
        <section className="stack">
          <div className="preview">
            <canvas ref={canvasRef} className="preview__canvas" aria-label="촬영한 급수표 미리보기" />
          </div>
          <div className="row">
            <button type="button" className="btn btn--ghost" onClick={() => setRotation((r) => (r + 270) % 360)}>
              ⟲ 왼쪽으로 돌리기
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setRotation((r) => (r + 90) % 360)}>
              ⟳ 오른쪽으로 돌리기
            </button>
          </div>
          <button type="button" className="btn btn--primary btn--xl" onClick={() => void startOcr()}>
            🔍 글자 읽기 시작
          </button>
          <button type="button" className="btn btn--secondary" onClick={reset}>
            📷 다시 찍기
          </button>
        </section>
      )}

      {phase === 'reading' && (
        <section className="stack center reading" aria-live="polite">
          <Monster size={120} talking />
          <p className="reading__msg">{message}</p>
          <p className="reading__pct">{Math.round(progress * 100)}%</p>
          <ProgressBar value={progress} label="급수표 인식 진행률" />
          <p className="muted small">처음 한 번은 한국어 인식 데이터를 내려받느라 조금 오래 걸릴 수 있어요.</p>
          <button type="button" className="btn btn--ghost" onClick={reset}>
            취소
          </button>
        </section>
      )}

      {phase === 'error' && (
        <section className="stack center">
          <Monster size={96} mood="calm" />
          <p className="error-text" role="alert">
            {error}
          </p>
          <button type="button" className="btn btn--primary btn--lg" onClick={reset}>
            📷 다시 찍기
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            onClick={() => navigate({ name: 'manual' }, { replace: true })}
          >
            📝 직접 입력하기
          </button>
        </section>
      )}
    </main>
  );
}
