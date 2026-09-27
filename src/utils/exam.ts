import type { ExamItem, ExamMode, ExamSession, GradeSummary, Round, Sheet, StudyRecord, WrongNote } from '../types';
import { createId, sentenceKey } from './id';
import { isSameDay, isWithinDays } from './date';

export type Rng = () => number;

/** Fisher–Yates 셔플. 원본 배열은 바꾸지 않으며 같은 요소가 두 번 나오지 않는다. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 같은 문장이 여러 번 들어가지 않도록 key 기준 중복 제거 (처음 나온 것 유지) */
export function uniqueByKey(items: readonly ExamItem[]): ExamItem[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.key)) return false;
    seen.add(it.key);
    return true;
  });
}

export function roundToItems(sheet: Pick<Sheet, 'id' | 'title'>, round: Round): ExamItem[] {
  return round.sentences
    .map((s) => s.text.trim())
    .filter((t) => t.length > 0)
    .map((text) => ({
      key: sentenceKey(sheet.title, round.name, text),
      text,
      sheetId: sheet.id,
      sheetTitle: sheet.title,
      roundName: round.name,
    }));
}

export function wrongNotesToItems(notes: readonly WrongNote[]): ExamItem[] {
  return notes.map((n) => ({
    key: n.key,
    text: n.text,
    sheetId: n.sheetId,
    sheetTitle: n.sheetTitle,
    roundName: n.roundName,
  }));
}

interface CreateSessionOptions {
  mode: ExamMode;
  title: string;
  random?: boolean;
  attempt?: number;
  originalTotal?: number;
  rng?: Rng;
}

export function createExamSession(items: readonly ExamItem[], opts: CreateSessionOptions): ExamSession {
  const unique = uniqueByKey(items);
  const ordered = opts.random === false ? unique : shuffle(unique, opts.rng);
  return {
    id: createId('exam_'),
    mode: opts.mode,
    title: opts.title,
    items: ordered,
    attempt: opts.attempt ?? 1,
    originalTotal: opts.originalTotal ?? ordered.length,
  };
}

/** 채점: wrongKeys에 포함된 문제가 오답 */
export function gradeExam(items: readonly ExamItem[], wrongKeys: ReadonlySet<string>): GradeSummary {
  const wrongItems = items.filter((it) => wrongKeys.has(it.key));
  const total = items.length;
  const wrong = wrongItems.length;
  const correct = total - wrong;
  return {
    total,
    correct,
    wrong,
    rate: total === 0 ? 0 : Math.round((correct / total) * 100),
    wrongItems,
  };
}

/** 틀린 문제만으로 새 재시험 세션 생성 (null이면 재시험할 문제 없음) */
export function createRetrySession(
  prev: ExamSession,
  wrongKeys: ReadonlySet<string>,
  opts: { random?: boolean; rng?: Rng } = {},
): ExamSession | null {
  const { wrongItems } = gradeExam(prev.items, wrongKeys);
  if (wrongItems.length === 0) return null;
  return createExamSession(wrongItems, {
    mode: prev.mode === 'review' ? 'review' : 'retry',
    title: prev.title,
    random: opts.random,
    rng: opts.rng,
    attempt: prev.attempt + 1,
    originalTotal: prev.originalTotal,
  });
}

/**
 * 채점 결과를 오답노트에 반영한 "변경된 노트 목록"을 돌려준다.
 * - 틀린 문제: 노트가 없으면 새로 만들고 wrongCount +1, 상태 '복습 필요'
 * - 맞힌 문제: 이미 오답노트에 있는 문제만 correctCount +1, 상태 '정복'
 */
export function applyGradingToNotes(
  existing: ReadonlyMap<string, WrongNote>,
  items: readonly ExamItem[],
  wrongKeys: ReadonlySet<string>,
  now: number,
): WrongNote[] {
  const changed: WrongNote[] = [];
  for (const item of items) {
    const prev = existing.get(item.key);
    if (wrongKeys.has(item.key)) {
      changed.push({
        key: item.key,
        text: item.text,
        sheetId: item.sheetId ?? prev?.sheetId,
        sheetTitle: item.sheetTitle,
        roundName: item.roundName,
        wrongCount: (prev?.wrongCount ?? 0) + 1,
        correctCount: prev?.correctCount ?? 0,
        lastWrongAt: now,
        lastStudiedAt: now,
        status: 'review',
      });
    } else if (prev) {
      changed.push({
        ...prev,
        correctCount: prev.correctCount + 1,
        lastStudiedAt: now,
        status: 'mastered',
      });
    }
  }
  return changed;
}

export type WrongNoteRange = 'today' | 'week' | 'all';

export function filterWrongNotes(
  notes: readonly WrongNote[],
  range: WrongNoteRange,
  now: number,
  includeMastered = false,
): WrongNote[] {
  return notes
    .filter((n) => includeMastered || n.status === 'review')
    .filter((n) => {
      if (range === 'today') return isSameDay(n.lastWrongAt, now);
      if (range === 'week') return isWithinDays(n.lastWrongAt, 7, now);
      return true;
    })
    .sort((a, b) => b.lastWrongAt - a.lastWrongAt);
}

export function createStudyRecord(session: ExamSession, summary: GradeSummary, now: number): StudyRecord {
  return {
    id: createId('rec_'),
    createdAt: now,
    title: session.title,
    mode: session.mode,
    attempt: session.attempt,
    total: summary.total,
    correct: summary.correct,
    wrong: summary.wrong,
  };
}
