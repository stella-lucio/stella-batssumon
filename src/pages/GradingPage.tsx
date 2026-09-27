import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { storage } from '../services/storageService';
import { useApp } from '../store/AppContext';

export function GradingPage() {
  const { session, navigate, goHome, showToast } = useApp();
  const [wrongKeys, setWrongKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) goHome();
  }, [session, goHome]);

  if (!session) return null;

  const toggle = (key: string, wrong: boolean) => {
    setWrongKeys((prev) => {
      const next = new Set(prev);
      if (wrong) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const wrongCount = wrongKeys.size;
  const total = session.items.length;

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { summary } = await storage.saveGradingResult(session, wrongKeys);
      navigate({ name: 'result', summary }, { replace: true });
    } catch {
      showToast('결과를 저장하지 못했어요. 다시 눌러 주세요.');
      setSaving(false);
    }
  };

  const quit = () => {
    if (window.confirm('채점하지 않고 나갈까요? 결과가 저장되지 않아요.')) goHome();
  };

  return (
    <main className="page page--with-bottom">
      <TopBar title="채점하기" onBack={quit} backLabel="채점 그만하기" />
      <section className="stack">
        <div className="notice">
          <strong>부모님, 채점해 주세요.</strong>
          <br />
          모두 <b>맞았어요 ✅</b>로 되어 있어요. 틀린 문제만 <b>틀렸어요 ❌</b>를 눌러 주세요.
        </div>
        <ol className="grade-list">
          {session.items.map((item, i) => {
            const wrong = wrongKeys.has(item.key);
            return (
              <li key={item.key} className={`grade-item ${wrong ? 'grade-item--wrong' : 'grade-item--right'}`}>
                <p className="grade-item__text">
                  <span className="grade-item__num">{i + 1}</span>
                  {item.text}
                </p>
                <div className="grade-item__buttons" role="group" aria-label={`${i + 1}번 채점`}>
                  <button
                    type="button"
                    className={`grade-btn grade-btn--right ${!wrong ? 'is-active' : ''}`}
                    aria-pressed={!wrong}
                    onClick={() => toggle(item.key, false)}
                    aria-label={`${i + 1}번 맞았어요`}
                  >
                    ✅ 맞았어요
                  </button>
                  <button
                    type="button"
                    className={`grade-btn grade-btn--wrong ${wrong ? 'is-active' : ''}`}
                    aria-pressed={wrong}
                    onClick={() => toggle(item.key, true)}
                    aria-label={`${i + 1}번 틀렸어요`}
                  >
                    ❌ 틀렸어요
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="bottom-bar">
        <p className="bottom-bar__summary" aria-live="polite">
          ✅ 맞음 {total - wrongCount} · ❌ 틀림 {wrongCount}
        </p>
        <button type="button" className="btn btn--primary btn--xl" onClick={() => void finish()} disabled={saving}>
          채점 완료
        </button>
      </div>
    </main>
  );
}
