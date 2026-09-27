import { useEffect } from 'react';
import { Monster } from '../components/Monster';
import { useApp } from '../store/AppContext';
import type { GradeSummary } from '../types';
import { createRetrySession } from '../utils/exam';
import { friendlyName } from '../utils/korean';

export function ResultPage({ summary }: { summary: GradeSummary }) {
  const { session, settings, setSession, navigate, goHome } = useApp();

  useEffect(() => {
    if (!session) goHome();
  }, [session, goHome]);

  if (!session) return null;

  const isRetry = session.attempt > 1;
  const name = friendlyName(settings.childName);

  const retry = () => {
    const next = createRetrySession(session, new Set(summary.wrongItems.map((i) => i.key)), {
      random: settings.randomOrder,
    });
    if (!next) return;
    setSession(next);
    navigate({ name: 'exam' }, { replace: true });
  };

  const home = () => {
    setSession(null);
    goHome();
  };

  // 모두 맞음
  if (summary.wrong === 0) {
    return (
      <main className="page page--center">
        <section className="result result--perfect">
          <div className="confetti" aria-hidden="true">
            🎉✨🎊
          </div>
          <Monster size={150} mood="cheer" />
          {isRetry ? (
            <>
              <h1 className="result__title">🎉 오답 정복 완료!</h1>
              <p className="result__subtitle">오늘 받아쓰기를 모두 정복했어요.</p>
            </>
          ) : (
            <>
              <h1 className="result__title">🎉 모두 맞았어요!</h1>
              <p className="result__subtitle">
                {summary.total}문제 모두 정답! {name ? `${name}, ` : ''}정말 잘했어요.
              </p>
            </>
          )}
          <button type="button" className="btn btn--primary btn--xxl" onClick={home}>
            🏠 처음으로
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page page--with-bottom">
      <section className="result">
        <h1 className="result__heading">{isRetry ? '다시 도전 결과' : '오늘의 받아쓰기 결과'}</h1>
        <p className="muted">{session.title}</p>

        <div className="score-card card">
          <p className="score-card__total">{summary.total}문제</p>
          <div className="score-card__row">
            <p className="score score--right">
              <span aria-hidden="true">✅</span> 맞은 문제 <strong>{summary.correct}개</strong>
            </p>
            <p className="score score--wrong">
              <span aria-hidden="true">❌</span> 틀린 문제 <strong>{summary.wrong}개</strong>
            </p>
          </div>
          <p className="score-card__rate">
            정답률 <strong>{summary.rate}%</strong>
          </p>
        </div>

        <div className="retry-callout">
          <Monster size={84} mood="cheer" />
          <p className="retry-callout__text">
            {isRetry ? `아직 ${summary.wrong}문제가 남았어요!` : `${summary.wrong}문제만 다시 도전해 볼까요?`}
          </p>
        </div>

        <details className="wrong-list">
          <summary>틀린 문장 보기 (부모님용)</summary>
          <ul>
            {summary.wrongItems.map((it) => (
              <li key={it.key}>❌ {it.text}</li>
            ))}
          </ul>
        </details>
      </section>

      <div className="bottom-bar bottom-bar--stack">
        <button type="button" className="btn btn--fire btn--xxl" onClick={retry}>
          {isRetry ? '🔥 한 번 더 도전' : '🔥 틀린 문제만 다시 시험'}
        </button>
        <button type="button" className="btn btn--secondary btn--lg" onClick={home}>
          🏠 오늘은 여기까지
        </button>
      </div>
    </main>
  );
}
