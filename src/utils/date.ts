const DAY = 24 * 60 * 60 * 1000;

/** 기기 현지 시간 기준 그날 0시 */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** 오늘 포함 최근 n일 이내인지 */
export function isWithinDays(ts: number, days: number, now: number): boolean {
  return ts >= startOfDay(now) - (days - 1) * DAY;
}

/** 2026-09-27 */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 오늘 / 어제 / 9월 25일 */
export function formatRelativeDay(ts: number, now = Date.now()): string {
  if (isSameDay(ts, now)) return '오늘';
  if (isSameDay(ts, now - DAY)) return '어제';
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 기본 급수표 제목: "2026년 9월 4주차" */
export function defaultSheetTitle(now = Date.now()): string {
  const d = new Date(now);
  const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${week}주차`;
}
