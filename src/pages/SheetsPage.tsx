import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { useExamStarter } from '../hooks/useExamStarter';
import { storage } from '../services/storageService';
import { useApp } from '../store/AppContext';
import type { Sheet } from '../types';
import { formatDate } from '../utils/date';
import { countSentences } from '../utils/sheet';

export function SheetsPage() {
  const { back, navigate, showToast } = useApp();
  const { startRound } = useExamStarter();
  const [sheets, setSheets] = useState<Sheet[] | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    storage
      .listSheets()
      .then((v) => alive && setSheets(v))
      .catch(() => alive && setSheets([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const remove = async (sheet: Sheet) => {
    if (!window.confirm(`"${sheet.title}" 급수표를 삭제할까요?\n(오답노트 기록은 남아요)`)) return;
    await storage.deleteSheet(sheet.id);
    showToast('삭제했어요.');
    reload();
  };

  return (
    <main className="page">
      <TopBar title="저장한 급수표" onBack={back} />

      {sheets === null && <p className="muted center">불러오는 중...</p>}

      {sheets?.length === 0 && (
        <section className="empty">
          <p className="empty__emoji" aria-hidden="true">
            📭
          </p>
          <p>아직 저장한 급수표가 없어요.</p>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate({ name: 'scan' })}>
            📷 급수표 찍기
          </button>
          <button type="button" className="btn btn--secondary btn--lg" onClick={() => navigate({ name: 'manual' })}>
            📝 직접 입력하기
          </button>
        </section>
      )}

      <ul className="sheet-list">
        {sheets?.map((sheet) => (
          <li key={sheet.id} className="card sheet-card">
            <div className="sheet-card__head">
              <div>
                <h2 className="sheet-card__title">{sheet.title}</h2>
                <p className="muted small">
                  회차 {sheet.rounds.length}개 · {formatDate(sheet.updatedAt)}
                </p>
              </div>
              <div className="sheet-card__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => navigate({ name: 'editor', sheet, isNew: false })}
                  aria-label={`${sheet.title} 내용 수정`}
                >
                  ✏️ 수정
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--danger-text"
                  onClick={() => void remove(sheet)}
                  aria-label={`${sheet.title} 삭제`}
                >
                  🗑 삭제
                </button>
              </div>
            </div>
            <ul className="round-list">
              {sheet.rounds.map((round) => (
                <li key={round.id} className="round-row">
                  <span className="round-row__name">
                    {round.name} <span className="muted">· {countSentences(round)}문제</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => startRound(sheet, round)}
                    disabled={countSentences(round) === 0}
                    aria-label={`${sheet.title} ${round.name} 시험 시작`}
                  >
                    ▶ 시험 시작
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
