import type { Settings, SpeechRateOption } from '../types';

export const RATE_VALUES: Record<SpeechRateOption, number> = {
  slow: 0.75,
  normal: 0.88,
  fast: 1.0,
};

export const RATE_LABELS: Record<SpeechRateOption, string> = {
  slow: '느리게',
  normal: '보통',
  fast: '조금 빠르게',
};

export const REPEAT_OPTIONS = [1, 2, 3, 4, 5] as const;
export const PAUSE_OPTIONS = [1, 1.5, 2, 3] as const;

export const DEFAULT_SETTINGS: Settings = {
  childName: '',
  rate: 'normal',
  repeatCount: 3,
  pauseSeconds: 1,
  randomOrder: true,
  readQuestionNumber: true,
  hideSentence: true,
  autoGoToGrading: true,
  endGuide: true,
};

/** 저장된 값이 깨졌거나 예전 버전이어도 안전하게 복원 */
export function normalizeSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<Record<keyof Settings, unknown>>;
  if (typeof r.childName === 'string') s.childName = r.childName.slice(0, 20);
  if (r.rate === 'slow' || r.rate === 'normal' || r.rate === 'fast') s.rate = r.rate;
  if (typeof r.repeatCount === 'number' && r.repeatCount >= 1 && r.repeatCount <= 5) {
    s.repeatCount = Math.round(r.repeatCount);
  }
  if (typeof r.pauseSeconds === 'number' && r.pauseSeconds >= 0.5 && r.pauseSeconds <= 5) {
    s.pauseSeconds = r.pauseSeconds;
  }
  for (const k of ['randomOrder', 'readQuestionNumber', 'hideSentence', 'autoGoToGrading', 'endGuide'] as const) {
    if (typeof r[k] === 'boolean') s[k] = r[k];
  }
  return s;
}
