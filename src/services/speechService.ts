import { ordinalKorean } from '../utils/korean';

/**
 * 선생님처럼 읽어주는 TTS 엔진 (Web Speech API speechSynthesis).
 *
 * iOS Safari 안정성을 위한 원칙
 *  - 여러 문장을 한꺼번에 queue에 넣지 않는다: speak → onend 확인 → 대기 → 다음 speak
 *  - 현재 utterance를 필드에 붙잡아 두어 GC로 onend가 사라지는 문제를 막는다
 *  - 새 재생 전·화면 이탈 시 speechSynthesis.cancel()
 *  - onend가 오지 않는 경우를 대비한 타임아웃
 *  - 첫 재생은 사용자 탭 안에서 unlock() 호출
 */

export type SpeechStep =
  | { kind: 'speak'; text: string; role: 'intro' | 'sentence' | 'guide'; repeatIndex?: number }
  | { kind: 'pause'; ms: number };

export interface QuestionScriptOptions {
  /** 1부터 시작하는 문제 번호 */
  questionNumber: number;
  text: string;
  repeatCount: number;
  pauseMs: number;
  readQuestionNumber: boolean;
  endGuide: boolean;
}

export const END_GUIDE_TEXT = '다 썼으면 다음 문제를 눌러주세요.';

/** 한 문제를 읽는 순서를 만든다 (순수 함수, 테스트 대상) */
export function buildQuestionScript(o: QuestionScriptOptions): SpeechStep[] {
  const steps: SpeechStep[] = [];
  const repeat = Math.min(5, Math.max(1, Math.round(o.repeatCount)));
  if (o.readQuestionNumber) {
    steps.push({ kind: 'speak', text: `${ordinalKorean(o.questionNumber)} 문제입니다.`, role: 'intro' });
    steps.push({ kind: 'pause', ms: 700 });
  }
  for (let i = 0; i < repeat; i++) {
    steps.push({ kind: 'speak', text: o.text, role: 'sentence', repeatIndex: i + 1 });
    if (i < repeat - 1) steps.push({ kind: 'pause', ms: o.pauseMs });
  }
  if (o.endGuide) {
    steps.push({ kind: 'pause', ms: 600 });
    steps.push({ kind: 'speak', text: END_GUIDE_TEXT, role: 'guide' });
  }
  return steps;
}

/** 한국어 음성 우선순위: ko-KR 정확히 일치 > iOS/Apple 음성 > 로컬 음성 > ko로 시작 */
export function pickKoreanVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const korean = voices.filter((v) => /^ko([-_]|$)/i.test(v.lang));
  if (korean.length === 0) return null;
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (/^ko[-_]KR$/i.test(v.lang)) s += 10;
    if (/yuna|유나|sora|소라|jian|suhyun|minsu/i.test(v.name)) s += 5; // iOS/macOS 한국어 음성
    if (/premium|enhanced|고품질/i.test(v.name)) s += 3;
    if (v.localService) s += 2;
    if (v.default) s += 1;
    return s;
  };
  return korean.slice().sort((a, b) => score(b) - score(a))[0];
}

export interface SpeechProgress {
  step: SpeechStep;
  stepIndex: number;
  totalSteps: number;
}

export interface PlayOptions {
  rate: number;
  onStep?: (p: SpeechProgress) => void;
}

type SpeakResult = 'end' | 'cancelled' | 'error';

interface EngineDeps {
  synth?: SpeechSynthesis | null;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
}

export class SpeechEngine {
  private synth: SpeechSynthesis | null;
  private createUtterance: (text: string) => SpeechSynthesisUtterance;
  /** GC 방지를 위해 현재 utterance를 붙잡아 둔다 */
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private runId = 0;
  private voice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;
  private unlocked = false;
  private pendingWaits = new Set<() => void>();

  constructor(deps: EngineDeps = {}) {
    this.synth =
      deps.synth !== undefined
        ? deps.synth
        : typeof window !== 'undefined' && 'speechSynthesis' in window
          ? window.speechSynthesis
          : null;
    this.createUtterance = deps.createUtterance ?? ((text: string) => new SpeechSynthesisUtterance(text));
  }

  get supported(): boolean {
    return this.synth !== null;
  }

  get hasKoreanVoice(): boolean {
    return this.voice !== null;
  }

  get voiceName(): string | null {
    return this.voice?.name ?? null;
  }

  /** getVoices()가 처음엔 빈 배열일 수 있으므로 voiceschanged + 폴링으로 기다린다 */
  loadVoices(timeoutMs = 2000): Promise<void> {
    const synth = this.synth;
    if (!synth || this.voicesLoaded) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(poll);
        clearTimeout(timer);
        synth.removeEventListener?.('voiceschanged', onChange);
        resolve();
      };
      const tryPick = () => {
        let voices: SpeechSynthesisVoice[] = [];
        try {
          voices = synth.getVoices();
        } catch {
          voices = [];
        }
        if (voices.length > 0) {
          this.voice = pickKoreanVoice(voices);
          this.voicesLoaded = true;
          finish();
        }
      };
      const onChange = () => tryPick();
      synth.addEventListener?.('voiceschanged', onChange);
      const poll = setInterval(tryPick, 250);
      const timer = setTimeout(() => {
        // 음성 목록을 못 받아도 기본 음성(lang=ko-KR)으로 계속 진행
        this.voicesLoaded = true;
        finish();
      }, timeoutMs);
      tryPick();
    });
  }

  /**
   * iOS는 사용자 탭 안에서 한 번 speak 해야 이후 재생이 허용된다.
   * 반드시 onClick 핸들러 안에서 "동기적으로" 호출할 것.
   */
  unlock(): void {
    if (!this.synth || this.unlocked) return;
    try {
      const u = this.createUtterance(' ');
      u.volume = 0;
      u.lang = 'ko-KR';
      this.synth.speak(u);
      this.unlocked = true;
    } catch {
      /* 무시 */
    }
  }

  /** 재생 중인 모든 음성과 대기 중인 단계를 중단 */
  cancel(): void {
    this.runId++;
    for (const wake of this.pendingWaits) wake();
    this.pendingWaits.clear();
    if (this.currentUtterance) {
      this.currentUtterance.onend = null;
      this.currentUtterance.onerror = null;
      this.currentUtterance = null;
    }
    try {
      this.synth?.cancel();
    } catch {
      /* 무시 */
    }
  }

  private wait(ms: number, run: number): Promise<boolean> {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(t);
        this.pendingWaits.delete(wake);
        resolve(false);
      };
      const t = setTimeout(() => {
        this.pendingWaits.delete(wake);
        resolve(run === this.runId);
      }, ms);
      this.pendingWaits.add(wake);
    });
  }

  private speakOnce(text: string, rate: number, run: number): Promise<SpeakResult> {
    const synth = this.synth;
    if (!synth) return Promise.resolve('error');
    return new Promise((resolve) => {
      let settled = false;
      const u = this.createUtterance(text);
      u.lang = 'ko-KR';
      if (this.voice) u.voice = this.voice;
      u.rate = rate;
      u.pitch = 1.0;
      u.volume = 1;

      // onend가 오지 않는 iOS 버그 대비: 글자 수 기반 예상 시간 + 여유
      const expected = Math.max(2500, (text.length * 330) / Math.max(0.5, rate)) + 4000;
      const settle = (r: SpeakResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallback);
        this.pendingWaits.delete(wake);
        if (this.currentUtterance === u) this.currentUtterance = null;
        resolve(run === this.runId ? r : 'cancelled');
      };
      const wake = () => settle('cancelled');
      const fallback = setTimeout(() => settle('end'), expected);
      this.pendingWaits.add(wake);

      u.onend = () => settle('end');
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        settle(e.error === 'interrupted' || e.error === 'canceled' ? 'cancelled' : 'error');
      };

      this.currentUtterance = u;
      try {
        if (synth.paused) synth.resume();
        synth.speak(u);
      } catch {
        settle('error');
      }
    });
  }

  /**
   * 단계별로 순서대로 읽는다. 새 play()나 cancel()이 호출되면 즉시 중단.
   * @returns 끝까지 읽었으면 true
   */
  async play(steps: SpeechStep[], opts: PlayOptions): Promise<boolean> {
    this.cancel();
    const run = this.runId;
    if (!this.synth) return false;
    await this.loadVoices();
    if (run !== this.runId) return false;
    // cancel() 직후 곧바로 speak하면 iOS에서 무시되는 경우가 있어 잠깐 쉰다
    if (!(await this.wait(80, run))) return false;

    for (let i = 0; i < steps.length; i++) {
      if (run !== this.runId) return false;
      const step = steps[i];
      opts.onStep?.({ step, stepIndex: i, totalSteps: steps.length });
      if (step.kind === 'pause') {
        if (!(await this.wait(step.ms, run))) return false;
      } else {
        const r = await this.speakOnce(step.text, opts.rate, run);
        if (r === 'cancelled') return false;
        // 'error'여도 다음 단계는 계속 진행 (한 번 실패로 멈추지 않도록)
      }
    }
    return run === this.runId;
  }
}
