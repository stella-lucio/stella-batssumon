import type { ParsedSheet, Round, Sheet } from '../types';
import { defaultSheetTitle } from './date';
import { createId } from './id';

export function createRound(name: string, sentences: string[] = []): Round {
  return {
    id: createId('r_'),
    name,
    sentences: sentences.map((text) => ({ id: createId('s_'), text })),
  };
}

/** 파싱 결과 → 편집 가능한 급수표 (회차가 없으면 빈 회차 하나) */
export function sheetFromParsed(parsed: ParsedSheet, title?: string, now = Date.now()): Sheet {
  const rounds =
    parsed.rounds.length > 0
      ? parsed.rounds.map((r) => createRound(r.name, r.sentences))
      : [createRound('받아쓰기', [''])];
  return {
    id: createId('sheet_'),
    title: (title?.trim() || parsed.suggestedTitle || defaultSheetTitle(now)).slice(0, 40),
    rounds,
    createdAt: now,
    updatedAt: now,
  };
}

/** 저장 전 정리: 앞뒤 공백 제거, 빈 문장 삭제, 이름 없는 회차에 이름 부여 */
export function cleanSheet(sheet: Sheet): Sheet {
  return {
    ...sheet,
    title: sheet.title.trim() || defaultSheetTitle(),
    rounds: sheet.rounds.map((r, i) => ({
      ...r,
      name: r.name.trim() || `${i + 1}회`,
      sentences: r.sentences
        .map((s) => ({ ...s, text: s.text.replace(/\s+/g, ' ').trim() }))
        .filter((s) => s.text.length > 0),
    })),
  };
}

export function countSentences(round: Round): number {
  return round.sentences.filter((s) => s.text.trim().length > 0).length;
}

/** "8급 · 3회" (회차 이름이 기본값이면 급수표 제목만) */
export function examTitle(sheetTitle: string, roundName: string): string {
  if (!roundName || roundName === '받아쓰기') return sheetTitle;
  return `${sheetTitle} · ${roundName}`;
}

/** 배열 안에서 항목 위치 바꾸기 (범위 밖이면 그대로) */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr.slice();
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
