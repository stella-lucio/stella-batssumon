/** 마지막 글자에 받침이 있는지 (한글이 아니면 null) */
export function hasBatchim(word: string): boolean | null {
  const trimmed = word.trim();
  if (!trimmed) return null;
  const code = trimmed.charCodeAt(trimmed.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 아이 이름을 부르기 좋은 형태로.
 * 서윤 → 서윤이, 민준 → 민준이, 지우 → 지우, Emma → Emma
 */
export function friendlyName(name: string): string {
  const n = name.trim();
  if (!n) return '';
  return hasBatchim(n) === true ? `${n}이` : n;
}

/** "서윤이의 받아쓰기" / "지우의 받아쓰기" / 이름 없으면 "오늘의 받아쓰기" */
export function dictationTitle(name: string): string {
  const f = friendlyName(name);
  return f ? `${f}의 받아쓰기` : '오늘의 받아쓰기';
}

/** 받침에 따라 조사 선택: withJosa('사과', '을', '를') → 사과를 */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string): string {
  return word + (hasBatchim(word) === true ? withBatchim : withoutBatchim);
}

const ORDINAL_UNITS = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const ORDINAL_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

/** 1 → "첫 번째", 3 → "세 번째", 20 → "스무 번째", 21 → "스물한 번째" */
export function ordinalKorean(n: number): string {
  if (!Number.isInteger(n) || n < 1) return `${n}번째`;
  if (n >= 100) return `${n}번째`;
  if (n === 1) return '첫 번째';
  if (n === 20) return '스무 번째';
  const tens = Math.floor(n / 10);
  const units = n % 10;
  return `${ORDINAL_TENS[tens]}${ORDINAL_UNITS[units]} 번째`;
}
