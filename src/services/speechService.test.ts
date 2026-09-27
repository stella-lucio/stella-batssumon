import { describe, expect, it } from 'vitest';
import { buildQuestionScript, END_GUIDE_TEXT, pickKoreanVoice, SpeechEngine } from './speechService';

describe('buildQuestionScript (선생님처럼 읽기)', () => {
  const base = {
    questionNumber: 3,
    text: '오늘은 날씨가 좋습니다.',
    repeatCount: 3,
    pauseMs: 1000,
    readQuestionNumber: true,
    endGuide: true,
  };

  it('문제 번호 → 문장 3번 → 안내 순서로 읽는다', () => {
    const steps = buildQuestionScript(base);
    const spoken = steps.filter((s) => s.kind === 'speak').map((s) => (s.kind === 'speak' ? s.text : ''));
    expect(spoken).toEqual([
      '세 번째 문제입니다.',
      '오늘은 날씨가 좋습니다.',
      '오늘은 날씨가 좋습니다.',
      '오늘은 날씨가 좋습니다.',
      END_GUIDE_TEXT,
    ]);
  });

  it('반복 사이에는 설정한 시간만큼 쉰다', () => {
    const steps = buildQuestionScript(base);
    const pausesBetween = steps.filter((s) => s.kind === 'pause' && s.ms === 1000);
    expect(pausesBetween).toHaveLength(2);
  });

  it('반복 횟수 설정 (1~5회)을 따른다', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const count = buildQuestionScript({ ...base, repeatCount: n }).filter(
        (s) => s.kind === 'speak' && s.role === 'sentence',
      ).length;
      expect(count).toBe(n);
    }
  });

  it('번호 읽기·마지막 안내를 끌 수 있다', () => {
    const steps = buildQuestionScript({ ...base, readQuestionNumber: false, endGuide: false });
    expect(steps.every((s) => s.kind === 'pause' || s.role === 'sentence')).toBe(true);
  });
});

function voice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

describe('pickKoreanVoice', () => {
  it('ko-KR 음성을 우선 선택한다', () => {
    const v = pickKoreanVoice([voice('Samantha', 'en-US'), voice('Yuna', 'ko-KR'), voice('Kyoko', 'ja-JP')]);
    expect(v?.name).toBe('Yuna');
  });
  it('한국어 음성이 없으면 null (기본 음성 사용)', () => {
    expect(pickKoreanVoice([voice('Samantha', 'en-US')])).toBeNull();
    expect(pickKoreanVoice([])).toBeNull();
  });
});

/** onend를 비동기로 호출해 주는 가짜 speechSynthesis */
class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function fakeSynth() {
  const spoken: string[] = [];
  let queue: FakeUtterance[] = [];
  const synth = {
    paused: false,
    speaking: false,
    pending: false,
    speak(u: FakeUtterance) {
      queue.push(u);
      spoken.push(u.text);
      setTimeout(() => {
        if (queue.includes(u)) {
          queue = queue.filter((x) => x !== u);
          u.onend?.();
        }
      }, 1);
    },
    cancel() {
      const q = queue;
      queue = [];
      q.forEach((u) => u.onerror?.({ error: 'canceled' }));
    },
    getVoices: () => [voice('Yuna', 'ko-KR')],
    resume() {},
    addEventListener() {},
    removeEventListener() {},
  };
  return { synth: synth as unknown as SpeechSynthesis, spoken };
}

describe('SpeechEngine (순차 재생)', () => {
  it('한 문장씩 순서대로 speak한다 (한꺼번에 queue에 넣지 않음)', async () => {
    const { synth, spoken } = fakeSynth();
    const engine = new SpeechEngine({
      synth,
      createUtterance: (t) => new FakeUtterance(t) as unknown as SpeechSynthesisUtterance,
    });
    const steps = buildQuestionScript({
      questionNumber: 1,
      text: '학교에 갑니다.',
      repeatCount: 3,
      pauseMs: 5,
      readQuestionNumber: true,
      endGuide: false,
    }).map((s) => (s.kind === 'pause' ? { ...s, ms: 5 } : s));
    const done = await engine.play(steps, { rate: 0.88 });
    expect(done).toBe(true);
    expect(spoken).toEqual(['첫 번째 문제입니다.', '학교에 갑니다.', '학교에 갑니다.', '학교에 갑니다.']);
  });

  it('새로 재생하면 이전 재생은 중단된다 (중복 음성 방지)', async () => {
    const { synth, spoken } = fakeSynth();
    const engine = new SpeechEngine({
      synth,
      createUtterance: (t) => new FakeUtterance(t) as unknown as SpeechSynthesisUtterance,
    });
    const long = [
      { kind: 'speak' as const, text: 'A', role: 'sentence' as const },
      { kind: 'pause' as const, ms: 50 },
      { kind: 'speak' as const, text: 'B', role: 'sentence' as const },
    ];
    const first = engine.play(long, { rate: 1 });
    await new Promise((r) => setTimeout(r, 100));
    const second = engine.play([{ kind: 'speak', text: 'C', role: 'sentence' }], { rate: 1 });
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(spoken).toEqual(['A', 'C']);
  });

  it('speechSynthesis가 없는 환경에서도 멈추지 않는다', async () => {
    const engine = new SpeechEngine({ synth: null });
    expect(engine.supported).toBe(false);
    expect(await engine.play([{ kind: 'speak', text: 'A', role: 'sentence' }], { rate: 1 })).toBe(false);
  });
});
