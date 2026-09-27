import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeechEngine, type SpeechStep } from '../services/speechService';

let sharedEngine: SpeechEngine | null = null;

/** 앱 전체에서 하나의 엔진만 사용 (동시에 두 음성이 나오지 않도록) */
export function getSpeechEngine(): SpeechEngine {
  if (!sharedEngine) sharedEngine = new SpeechEngine();
  return sharedEngine;
}

export type SpeechPhase = 'idle' | 'intro' | 'sentence' | 'pause' | 'guide' | 'done';

export interface SpeechUiState {
  phase: SpeechPhase;
  /** 지금 몇 번째로 문장을 읽는 중인지 (1부터) */
  repeatIndex: number;
  speaking: boolean;
}

const IDLE: SpeechUiState = { phase: 'idle', repeatIndex: 0, speaking: false };

export function useSpeech() {
  const engineRef = useRef<SpeechEngine>(getSpeechEngine());
  const [state, setState] = useState<SpeechUiState>(IDLE);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const engine = engineRef.current;
    void engine.loadVoices();
    return () => {
      mounted.current = false;
      engine.cancel(); // 화면을 떠나면 음성 중단
    };
  }, []);

  const play = useCallback(async (steps: SpeechStep[], rate: number) => {
    const engine = engineRef.current;
    let lastRepeat = 0;
    const finished = await engine.play(steps, {
      rate,
      onStep: ({ step }) => {
        if (!mounted.current) return;
        if (step.kind === 'pause') {
          setState((s) => ({ ...s, phase: s.phase === 'sentence' || s.phase === 'pause' ? 'pause' : s.phase }));
          return;
        }
        if (step.role === 'sentence') lastRepeat = step.repeatIndex ?? lastRepeat;
        setState({ phase: step.role, repeatIndex: lastRepeat, speaking: true });
      },
    });
    if (mounted.current && finished) {
      setState({ phase: 'done', repeatIndex: lastRepeat, speaking: false });
    }
    return finished;
  }, []);

  const stop = useCallback(() => {
    engineRef.current.cancel();
    if (mounted.current) setState(IDLE);
  }, []);

  /** 반드시 탭 핸들러 안에서 호출 (iOS 오디오 잠금 해제) */
  const unlock = useCallback(() => engineRef.current.unlock(), []);

  return {
    state,
    play,
    stop,
    unlock,
    supported: engineRef.current.supported,
    engine: engineRef.current,
  };
}
