import { useMemo, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { useApp } from '../store/AppContext';
import { parseManualInput } from '../utils/dictationParser';
import { sheetFromParsed } from '../utils/sheet';

const PLACEHOLDER = `학교에 갑니다.
친구와 놉니다.
오늘은 날씨가 좋습니다.`;

export function ManualInputPage() {
  const { back, navigate } = useApp();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const parsed = useMemo(() => parseManualInput(text), [text]);
  const count = parsed.rounds.reduce((n, r) => n + r.sentences.length, 0);

  const create = () => {
    if (count === 0) return;
    const sheet = sheetFromParsed(parsed, title);
    navigate(
      {
        name: 'editor',
        sheet,
        isNew: true,
        notice: parsed.roundsDetected ? `${parsed.rounds.length}개 회차로 나눴어요.` : undefined,
      },
      { replace: true },
    );
  };

  return (
    <main className="page">
      <TopBar title="직접 입력" onBack={back} />
      <section className="stack">
        <label className="field">
          <span className="field__label">급수표 이름 (선택)</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 8급, 10월 1주차"
            maxLength={40}
          />
        </label>
        <label className="field">
          <span className="field__label">받아쓰기 문장</span>
          <span className="field__hint">한 줄에 한 문장씩 적거나 붙여넣어 주세요. 번호는 자동으로 지워요.</span>
          <textarea
            className="input textarea textarea--tall"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="받아쓰기 문장 입력"
          />
        </label>
        <p className="muted" aria-live="polite">
          {count > 0 ? `${count}문제가 만들어져요.` : '문장을 입력하면 문제 수가 보여요.'}
        </p>
      </section>
      <div className="bottom-bar">
        <button type="button" className="btn btn--primary btn--xl" disabled={count === 0} onClick={create}>
          문제 만들기 →
        </button>
      </div>
    </main>
  );
}
