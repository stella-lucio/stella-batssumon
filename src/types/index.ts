/** 급수표 안의 한 문장(한 문제) */
export interface Sentence {
  id: string;
  text: string;
}

/** 급수표의 한 회차 (예: "3회") */
export interface Round {
  id: string;
  name: string;
  sentences: Sentence[];
}

/** 저장되는 급수표 */
export interface Sheet {
  id: string;
  title: string;
  rounds: Round[];
  createdAt: number;
  updatedAt: number;
}

/** 시험에 출제되는 한 문제 */
export interface ExamItem {
  /** 오답노트와 연결되는 고유 키 (급수표·회차·문장 기준) */
  key: string;
  text: string;
  sheetId?: string;
  sheetTitle: string;
  roundName: string;
}

export type ExamMode = 'normal' | 'retry' | 'review';

/** 진행 중인 받아쓰기 세션 (메모리에만 보관) */
export interface ExamSession {
  id: string;
  mode: ExamMode;
  /** 세션 제목 (예: "8급 · 3회") */
  title: string;
  /** 출제 순서대로 정렬된 문제 */
  items: ExamItem[];
  /** 1 = 첫 시험, 2 이상 = 오답 재시험 회차 */
  attempt: number;
  /** 첫 시험의 문제 수 (재시험 중에도 유지) */
  originalTotal: number;
}

/** 채점 결과 */
export interface GradeSummary {
  total: number;
  correct: number;
  wrong: number;
  /** 0 ~ 100 정수 */
  rate: number;
  wrongItems: ExamItem[];
}

export type WrongNoteStatus = 'review' | 'mastered';

/** 오답노트 한 항목 */
export interface WrongNote {
  key: string;
  text: string;
  sheetId?: string;
  sheetTitle: string;
  roundName: string;
  wrongCount: number;
  correctCount: number;
  lastWrongAt: number;
  lastStudiedAt: number;
  status: WrongNoteStatus;
}

/** 학습 기록 (시험 1회 = 1건) */
export interface StudyRecord {
  id: string;
  createdAt: number;
  title: string;
  mode: ExamMode;
  attempt: number;
  total: number;
  correct: number;
  wrong: number;
}

export type SpeechRateOption = 'slow' | 'normal' | 'fast';

export interface Settings {
  childName: string;
  rate: SpeechRateOption;
  /** 한 문제를 읽는 횟수 (1~5, 기본 3) */
  repeatCount: number;
  /** 반복 사이 쉬는 시간 (초) */
  pauseSeconds: number;
  randomOrder: boolean;
  readQuestionNumber: boolean;
  /** true면 시험 중 문장을 숨김 (기본) */
  hideSentence: boolean;
  autoGoToGrading: boolean;
  /** "다 썼으면 다음 문제를 눌러주세요." 안내 */
  endGuide: boolean;
}

/** OCR/직접입력 파싱 결과 */
export interface ParsedSheet {
  suggestedTitle?: string;
  rounds: { name: string; sentences: string[] }[];
  /** 회차 표기를 찾았는지 여부 */
  roundsDetected: boolean;
}
