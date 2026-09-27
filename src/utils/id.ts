let counter = 0;

/** 충분히 고유한 짧은 ID (crypto.randomUUID가 없는 구형 Safari 대비) */
export function createId(prefix = ''): string {
  counter = (counter + 1) % 1_000_000;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

/** 문장 텍스트 비교용 정규화 (공백·문장부호 차이 무시) */
export function normalizeForKey(text: string): string {
  return text.replace(/[\s.,?!~'"“”‘’]/g, '');
}

/** 오답노트 연결 키: 급수표 제목 + 회차 + 문장 */
export function sentenceKey(sheetTitle: string, roundName: string, text: string): string {
  return `${sheetTitle.trim()}|${roundName.trim()}|${normalizeForKey(text)}`;
}
