import { useEffect, useState } from 'react';
import { Monster } from '../components/Monster';
import { useSpeech } from '../hooks/useSpeech';
import { useApp } from '../store/AppContext';
import { RATE_VALUES } from '../utils/settings';

const AUTO_SECONDS = 4;

export function FinishPage() {
  const { session, settings, navigate, goHome } = useApp();
  const { play } = useSpeech();
  const [left, setLeft] = useState(AUTO_SECONDS);

  useEffect(() => {
    if (!session) {
      goHome();
      return;
    }
    void play([{ kind: 'speak', text: '받아쓰기 끝! 정말 잘했어요.', role: 'guide' }], RATE_VALUES[settings.rate]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.autoGoToGrading || !session) return;
    if (left <= 0) {
      navigate({ name: 'grading' }, { replace: true });
      return;
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left, settings.autoGoToGrading, session, navigate]);

  if (!session) return null;

  return (
    <main className="page page--center">
      <section className="finish">
        <Monster size={150} mood="cheer" />
        <h1 className="finish__title">🎉 받아쓰기 끝!</h1>
        <p className="finish__subtitle">채점해 볼까요?</p>
        <p className="muted">공책을 부모님께 보여 주세요.</p>
        <button
          type="button"
          className="btn btn--primary btn--xxl"
          onClick={() => navigate({ name: 'grading' }, { replace: true })}
        >
          ✏️ 채점하기
        </button>
        {settings.autoGoToGrading && (
          <p className="muted small" aria-live="polite">
            {left}초 뒤에 채점 화면으로 넘어가요
          </p>
        )}
      </section>
    </main>
  );
}
