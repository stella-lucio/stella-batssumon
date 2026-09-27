import { useEffect, useState } from 'react';
import { Monster } from '../components/Monster';
import { storage } from '../services/storageService';
import { useApp } from '../store/AppContext';
import type { StudyRecord } from '../types';
import { formatRelativeDay } from '../utils/date';
import { friendlyName } from '../utils/korean';

export function HomePage() {
  const { navigate, settings } = useApp();
  const [recent, setRecent] = useState<StudyRecord | null>(null);
  const [pendingWrong, setPendingWrong] = useState(0);
  const [sheetCount, setSheetCount] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([storage.listRecords(), storage.listWrongNotes(), storage.listSheets()])
      .then(([records, notes, sheets]) => {
        if (!alive) return;
        setRecent(records[0] ?? null);
        setPendingWrong(notes.filter((n) => n.status === 'review').length);
        setSheetCount(sheets.length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const name = friendlyName(settings.childName);

  return (
    <main className="page page--home">
      <section className="hero">
        <Monster size={112} />
        <div>
          <h1 className="hero__title">
            받쓰몬 <span aria-hidden="true">👾</span>
          </h1>
          <p className="hero__subtitle">{name ? `${name}, ` : ''}오늘 받아쓰기도 혼자 해볼까?</p>
        </div>
      </section>

      <nav className="home-grid" aria-label="메인 메뉴">
        <button type="button" className="home-card home-card--scan" onClick={() => navigate({ name: 'scan' })}>
          <span className="home-card__icon" aria-hidden="true">
            📷
          </span>
          <span className="home-card__label">급수표 찍기</span>
          <span className="home-card__hint">사진으로 문장 읽기</span>
        </button>
        <button type="button" className="home-card home-card--sheets" onClick={() => navigate({ name: 'sheets' })}>
          <span className="home-card__icon" aria-hidden="true">
            📝
          </span>
          <span className="home-card__label">저장한 급수표</span>
          <span className="home-card__hint">{sheetCount > 0 ? `${sheetCount}개 저장됨` : '아직 없어요'}</span>
        </button>
        <button type="button" className="home-card home-card--wrong" onClick={() => navigate({ name: 'wrong' })}>
          <span className="home-card__icon" aria-hidden="true">
            🎯
          </span>
          <span className="home-card__label">틀린 문제 복습</span>
          <span className="home-card__hint">
            {pendingWrong > 0 ? `복습할 문제 ${pendingWrong}개` : '복습할 문제 없음'}
          </span>
        </button>
        <button type="button" className="home-card home-card--settings" onClick={() => navigate({ name: 'settings' })}>
          <span className="home-card__icon" aria-hidden="true">
            ⚙️
          </span>
          <span className="home-card__label">부모 설정</span>
          <span className="home-card__hint">속도·반복·이름</span>
        </button>
      </nav>

      <button type="button" className="link-btn" onClick={() => navigate({ name: 'manual' })}>
        📝 사진 없이 직접 입력하기
      </button>

      <section className="card recent" aria-label="최근 학습">
        <h2 className="section-title">최근 학습</h2>
        {recent ? (
          <div className="recent__body">
            <p className="recent__title">
              {recent.title} 받아쓰기
              {recent.attempt > 1 && <span className="badge badge--soft">재시험</span>}
            </p>
            <p className="recent__line">
              {recent.total}문제 중 <strong>{recent.correct}문제</strong> 맞음
            </p>
            <p className="recent__line">{recent.wrong > 0 ? `오답 ${recent.wrong}문제` : '오답 없음 🎉'}</p>
            <p className="recent__date">{formatRelativeDay(recent.createdAt)}</p>
          </div>
        ) : (
          <p className="muted">아직 기록이 없어요. 급수표를 찍어서 첫 받아쓰기를 시작해 봐요!</p>
        )}
      </section>
    </main>
  );
}
