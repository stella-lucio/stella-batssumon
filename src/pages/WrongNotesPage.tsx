import { useEffect, useMemo, useState } from 'react';
import { Segmented } from '../components/Controls';
import { TopBar } from '../components/TopBar';
import { useExamStarter } from '../hooks/useExamStarter';
import { storage } from '../services/storageService';
import { useApp } from '../store/AppContext';
import type { WrongNote } from '../types';
import { formatDate } from '../utils/date';
import { filterWrongNotes, wrongNotesToItems, type WrongNoteRange } from '../utils/exam';

const RANGE_OPTIONS: { value: WrongNoteRange; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '최근 7일' },
  { value: 'all', label: '전체' },
];

export function WrongNotesPage() {
  const { back, showToast } = useApp();
  const { startItems } = useExamStarter();
  const [notes, setNotes] = useState<WrongNote[] | null>(null);
  const [range, setRange] = useState<WrongNoteRange>('all');
  const [showMastered, setShowMastered] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    storage
      .listWrongNotes()
      .then((v) => alive && setNotes(v))
      .catch(() => alive && setNotes([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // "오늘/최근 7일"은 화면을 연 시점 기준
  const [now] = useState(() => Date.now());
  const visible = useMemo(
    () => filterWrongNotes(notes ?? [], range, now, showMastered),
    [notes, range, now, showMastered],
  );
  const toStudy = visible.filter((n) => n.status === 'review');

  const start = () => {
    startItems(wrongNotesToItems(toStudy), '오답 복습', 'review');
  };

  const remove = async (note: WrongNote) => {
    if (!window.confirm(`"${note.text}"을(를) 오답노트에서 지울까요?`)) return;
    await storage.deleteWrongNote(note.key);
    showToast('지웠어요.');
    reload();
  };

  return (
    <main className="page page--with-bottom">
      <TopBar title="틀린 문제 복습" onBack={back} />

      <section className="stack">
        <Segmented label="기간" value={range} options={RANGE_OPTIONS} onChange={setRange} />
        <label className="check-line">
          <input type="checkbox" checked={showMastered} onChange={(e) => setShowMastered(e.target.checked)} />
          <span>정복한 문제도 보기</span>
        </label>

        {notes === null && <p className="muted center">불러오는 중...</p>}
        {notes !== null && visible.length === 0 && (
          <div className="empty">
            <p className="empty__emoji" aria-hidden="true">
              🌟
            </p>
            <p>{range === 'today' ? '오늘 틀린 문제가 없어요!' : '복습할 문제가 없어요!'}</p>
          </div>
        )}

        <ul className="note-list">
          {visible.map((n) => (
            <li key={n.key} className={`card note ${n.status === 'mastered' ? 'note--done' : ''}`}>
              <p className="note__text">{n.text}</p>
              <p className="note__meta">
                {n.sheetTitle}
                {n.roundName && n.roundName !== '받아쓰기' ? ` · ${n.roundName}` : ''}
              </p>
              <div className="note__foot">
                <span className="note__stats">
                  틀린 횟수 {n.wrongCount}회 · 맞힌 횟수 {n.correctCount}회 · 최근 틀림 {formatDate(n.lastWrongAt)}
                </span>
                <span className={`badge ${n.status === 'review' ? 'badge--warn' : 'badge--ok'}`}>
                  {n.status === 'review' ? '📌 복습 필요' : '✅ 정복'}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--sm note__delete"
                onClick={() => void remove(n)}
                aria-label={`${n.text} 오답노트에서 삭제`}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="bottom-bar">
        <button type="button" className="btn btn--primary btn--xl" onClick={start} disabled={toStudy.length === 0}>
          🎯 오답 시험 시작{toStudy.length > 0 ? ` (${toStudy.length}문제)` : ''}
        </button>
      </div>
    </main>
  );
}
