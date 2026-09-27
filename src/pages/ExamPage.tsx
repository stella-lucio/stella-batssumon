import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProgressBar } from '../components/Controls';
import { Monster } from '../components/Monster';
import { useSpeech } from '../hooks/useSpeech';
import { buildQuestionScript } from '../services/speechService';
import { useApp } from '../store/AppContext';
import { dictationTitle } from '../utils/korean';
import { RATE_VALUES } from '../utils/settings';

/** 버튼을 연속으로 눌러도 한 번만 처리되도록 (ms) */
const TAP_GUARD_MS = 600;

export function ExamPage() {
  const { session, settings, navigate, goHome } = useApp();
  const { state: speech, play, stop, unlock, supported } = useSpeech();
  const [index, setIndex] = useState(-1); // -1 = 시작 전 준비 화면
  const lastTap = useRef(0);

  const items = useMemo(() => session?.items ?? [], [session]);
  const total = items.length;

  const guard = () => {
    const now = Date.now();
    if (now - lastTap.current < TAP_GUARD_MS) return false;
    lastTap.current = now;
    return true;
  };

  const readQuestion = useCallback(
    (i: number) => {
      const item = items[i];
      if (!item) return;
      const steps = buildQuestionScript({
        questionNumber: i + 1,
        text: item.text,
        repeatCount: settings.repeatCount,
        pauseMs: settings.pauseSeconds * 1000,
        readQuestionNumber: settings.readQuestionNumber,
        endGuide: settings.endGuide,
      });
      void play(steps, RATE_VALUES[settings.rate]);
    },
    [items, settings, play],
  );

  // 세션 없이 이 화면에 오면(새로고침 등) 홈으로
  useEffect(() => {
    if (!session || session.items.length === 0) goHome();
  }, [session, goHome]);

  if (!session || total === 0) return null;

  const begin = () => {
    if (!guard()) return;
    unlock(); // iOS: 탭 안에서 음성 잠금 해제
    setIndex(0);
    readQuestion(0);
  };

  const replay = () => {
    if (!guard()) return;
    unlock();
    readQuestion(index);
  };

  const next = () => {
    if (!guard()) return;
    unlock();
    if (index >= total - 1) {
      stop();
      navigate({ name: 'finish' }, { replace: true });
      return;
    }
    const n = index + 1;
    setIndex(n);
    readQuestion(n);
  };

  const quit = () => {
    if (!window.confirm('받아쓰기를 그만할까요?')) return;
    stop();
    goHome();
  };

  const isRetry = session.attempt > 1;
  const heading =
    session.mode === 'review' && !isRetry
      ? '오답 복습 시험'
      : isRetry
        ? `틀린 문제 다시 도전${session.attempt > 2 ? ` (${session.attempt - 1}번째)` : ''}`
        : dictationTitle(settings.childName);

  if (index < 0) {
    return (
      <main className="page page--exam">
        <div className="exam-top">
          <button type="button" className="icon-btn" onClick={quit} aria-label="받아쓰기 그만하기">
            ✕
          </button>
        </div>
        <section className="exam-ready">
          <Monster size={140} mood="cheer" />
          <h1 className="exam-ready__title">{heading}</h1>
          <p className="exam-ready__meta">
            {session.title} · <strong>{total}문제</strong>
          </p>
          <ul className="exam-ready__tips">
            <li>✏️ 연필과 공책을 준비해요</li>
            <li>👂 문장을 {settings.repeatCount}번 읽어 줘요</li>
            <li>👉 다 쓰면 “다 썼어요”를 눌러요</li>
          </ul>
          {!supported && (
            <p className="notice notice--warn">이 브라우저에서는 소리로 읽어 줄 수 없어요. 부모님이 읽어 주세요.</p>
          )}
          <button type="button" className="btn btn--primary btn--xxl" onClick={begin} aria-label="받아쓰기 시작하기">
            🎧 시작하기
          </button>
        </section>
      </main>
    );
  }

  const item = items[index];
  const status =
    speech.phase === 'intro'
      ? '잘 들어 보세요...'
      : speech.phase === 'sentence'
        ? `읽고 있어요 (${speech.repeatIndex}/${settings.repeatCount})`
        : speech.phase === 'pause'
          ? '받아써 보세요 ✏️'
          : speech.phase === 'guide' || speech.phase === 'done'
            ? '다 썼으면 “다 썼어요”를 눌러요'
            : '잘 듣고 받아써 보세요.';

  return (
    <main className="page page--exam">
      <div className="exam-top">
        <button type="button" className="icon-btn" onClick={quit} aria-label="받아쓰기 그만하기">
          ✕
        </button>
        <p className="exam-top__title">받아쓰기 시험</p>
        <span className="icon-btn-spacer" />
      </div>

      <section className="exam-body">
        <p className="exam-count" aria-live="polite" data-testid="question-counter">
          문제 <strong>{index + 1}</strong> / {total}
        </p>
        <ProgressBar value={(index + 1) / total} label="시험 진행" />

        <div className="exam-stage">
          <Monster size={150} talking={speech.speaking && speech.phase !== 'pause'} />
          <p className="exam-status" aria-live="polite">
            {status}
          </p>
          {!settings.hideSentence && (
            <p className="exam-sentence" data-testid="exam-sentence">
              {item.text}
            </p>
          )}
        </div>

        <button type="button" className="btn btn--listen btn--xxl" onClick={replay} aria-label="문장 다시 듣기">
          ▶️ 다시 듣기
        </button>
      </section>

      <div className="bottom-bar">
        <button type="button" className="btn btn--primary btn--xl" onClick={next} aria-label="다 썼어요, 다음 문제">
          {index >= total - 1 ? '다 썼어요 · 끝! →' : '다 썼어요 →'}
        </button>
      </div>
    </main>
  );
}
