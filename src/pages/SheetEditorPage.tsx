import { useLayoutEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { useExamStarter } from '../hooks/useExamStarter';
import { storage } from '../services/storageService';
import { useApp } from '../store/AppContext';
import type { Round, Sheet } from '../types';
import { createId } from '../utils/id';
import { cleanSheet, countSentences, createRound, moveItem } from '../utils/sheet';

interface Props {
  sheet: Sheet;
  isNew: boolean;
  rawText?: string;
  roundId?: string;
  notice?: string;
}

function SentenceRow({
  index,
  text,
  total,
  onChange,
  onMove,
  onDelete,
  autoFocus,
}: {
  index: number;
  text: string;
  total: number;
  onChange: (t: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  autoFocus: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  useLayoutEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <li className="sentence-row">
      <span className="sentence-row__num" aria-hidden="true">
        {index + 1}
      </span>
      <textarea
        ref={ref}
        className="input sentence-row__input"
        rows={1}
        value={text}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
        aria-label={`${index + 1}번 문장`}
        placeholder="문장을 입력하세요"
        enterKeyHint="done"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="sentence-row__actions">
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`${index + 1}번 문장 위로 이동`}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`${index + 1}번 문장 아래로 이동`}
        >
          ↓
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm icon-btn--danger"
          onClick={onDelete}
          aria-label={`${index + 1}번 문장 삭제`}
        >
          🗑
        </button>
      </div>
    </li>
  );
}

export function SheetEditorPage({ sheet: initial, isNew, rawText, roundId, notice }: Props) {
  const { back, showToast } = useApp();
  const { startRound } = useExamStarter();
  const [sheet, setSheet] = useState<Sheet>(initial);
  const [selectedId, setSelectedId] = useState(roundId ?? initial.rounds[0]?.id ?? '');
  const [dirty, setDirty] = useState(isNew);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const round = sheet.rounds.find((r) => r.id === selectedId) ?? sheet.rounds[0];

  const update = (fn: (s: Sheet) => Sheet) => {
    setSheet((s) => fn(s));
    setDirty(true);
  };
  const updateRound = (id: string, fn: (r: Round) => Round) =>
    update((s) => ({ ...s, rounds: s.rounds.map((r) => (r.id === id ? fn(r) : r)) }));

  const addSentence = () => {
    if (!round) return;
    const id = createId('s_');
    updateRound(round.id, (r) => ({ ...r, sentences: [...r.sentences, { id, text: '' }] }));
    setFocusId(id);
  };

  const addRound = () => {
    const r = createRound(`${sheet.rounds.length + 1}회`, ['']);
    update((s) => ({ ...s, rounds: [...s.rounds, r] }));
    setSelectedId(r.id);
    setFocusId(r.sentences[0].id);
  };

  const deleteRound = () => {
    if (!round) return;
    if (sheet.rounds.length <= 1) {
      showToast('회차가 하나뿐이라 지울 수 없어요.');
      return;
    }
    if (!window.confirm(`"${round.name}"을(를) 삭제할까요?`)) return;
    const rest = sheet.rounds.filter((r) => r.id !== round.id);
    update((s) => ({ ...s, rounds: rest }));
    setSelectedId(rest[0].id);
  };

  const save = async (silent = false): Promise<Sheet | null> => {
    const cleaned = cleanSheet(sheet);
    if (cleaned.rounds.every((r) => r.sentences.length === 0)) {
      showToast('문장을 하나 이상 입력해 주세요.');
      return null;
    }
    setSaving(true);
    try {
      const saved = await storage.saveSheet(cleaned);
      setSheet(saved);
      if (!saved.rounds.some((r) => r.id === selectedId)) setSelectedId(saved.rounds[0]?.id ?? '');
      setDirty(false);
      if (!silent) showToast('💾 저장했어요!');
      return saved;
    } catch {
      showToast('저장하지 못했어요. 저장 공간을 확인해 주세요.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const start = async () => {
    if (!round || countSentences(round) === 0) {
      showToast('이 회차에 문장이 없어요.');
      return;
    }
    // 시험 기록이 급수표와 연결되도록 시작할 때 함께 저장
    const saved = await save(true);
    if (!saved) return;
    const savedRound = saved.rounds.find((r) => r.id === round.id) ?? saved.rounds[0];
    // 편집 화면을 시험 화면으로 교체 (뒤로가기로 옛 편집 내용이 다시 뜨지 않도록)
    startRound(saved, savedRound, { replace: true });
  };

  const leave = () => {
    if (dirty && !window.confirm('저장하지 않은 내용이 있어요. 그래도 나갈까요?')) return;
    back();
  };

  const total = round ? countSentences(round) : 0;

  return (
    <main className="page page--with-bottom">
      <TopBar title={isNew ? '인식 결과 확인' : '급수표 수정'} onBack={leave} />

      {notice && <p className="notice">{notice}</p>}

      <section className="stack">
        <label className="field">
          <span className="field__label">급수표 이름</span>
          <input
            className="input"
            value={sheet.title}
            maxLength={40}
            onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
            placeholder="예: 8급, 2026년 9월 4주차"
          />
        </label>

        <div className="field">
          <span className="field__label">{sheet.rounds.length > 1 ? '시험 볼 회차를 고르세요' : '회차'}</span>
          <div className="chips" role="tablist" aria-label="회차 선택">
            {sheet.rounds.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r.id === round?.id}
                className={`chip ${r.id === round?.id ? 'chip--active' : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                {r.name || '이름 없음'} <span className="chip__count">{countSentences(r)}</span>
              </button>
            ))}
            <button type="button" className="chip chip--add" onClick={addRound} aria-label="회차 추가">
              + 회차
            </button>
          </div>
        </div>

        {round && (
          <div className="card editor-card">
            <div className="editor-card__head">
              <label className="field field--inline">
                <span className="field__label">회차 이름</span>
                <input
                  className="input input--round"
                  value={round.name}
                  maxLength={20}
                  onChange={(e) => updateRound(round.id, (r) => ({ ...r, name: e.target.value }))}
                  aria-label="회차 이름"
                />
              </label>
              <button type="button" className="btn btn--ghost btn--sm" onClick={deleteRound}>
                회차 삭제
              </button>
            </div>
            <h2 className="editor-card__title">
              {round.name || '이름 없는 회차'} 받아쓰기 <span className="muted">· {total}문제</span>
            </h2>
            <ol className="sentence-list">
              {round.sentences.map((s, i) => (
                <SentenceRow
                  key={s.id}
                  index={i}
                  total={round.sentences.length}
                  text={s.text}
                  autoFocus={focusId === s.id}
                  onChange={(t) =>
                    updateRound(round.id, (r) => ({
                      ...r,
                      sentences: r.sentences.map((x) => (x.id === s.id ? { ...x, text: t } : x)),
                    }))
                  }
                  onMove={(dir) =>
                    updateRound(round.id, (r) => ({ ...r, sentences: moveItem(r.sentences, i, i + dir) }))
                  }
                  onDelete={() =>
                    updateRound(round.id, (r) => ({ ...r, sentences: r.sentences.filter((x) => x.id !== s.id) }))
                  }
                />
              ))}
            </ol>
            <button type="button" className="btn btn--dashed" onClick={addSentence}>
              + 문장 추가
            </button>
          </div>
        )}

        {rawText !== undefined && (
          <details className="raw-text">
            <summary>인식된 원문 보기</summary>
            <pre>{rawText.trim() || '(인식된 글자가 없어요)'}</pre>
          </details>
        )}
      </section>

      <div className="bottom-bar bottom-bar--split">
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => void save()} disabled={saving}>
          💾 저장하기
        </button>
        <button type="button" className="btn btn--primary btn--lg" onClick={() => void start()} disabled={saving}>
          ▶ 시험 시작
        </button>
      </div>
    </main>
  );
}
