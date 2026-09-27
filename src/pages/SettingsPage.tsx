import { useEffect, useState } from 'react';
import { Segmented, Toggle } from '../components/Controls';
import { TopBar } from '../components/TopBar';
import { useSpeech } from '../hooks/useSpeech';
import { buildQuestionScript } from '../services/speechService';
import { isStoragePersistent, storage } from '../services/storageService';
import { useApp } from '../store/AppContext';
import type { SpeechRateOption } from '../types';
import { dictationTitle } from '../utils/korean';
import { PAUSE_OPTIONS, RATE_LABELS, RATE_VALUES, REPEAT_OPTIONS } from '../utils/settings';

export function SettingsPage() {
  const { back, settings, updateSettings, showToast } = useApp();
  const { play, stop, unlock, supported, engine, state } = useSpeech();
  const [voiceInfo, setVoiceInfo] = useState<string>('확인 중...');
  const [persistent, setPersistent] = useState(true);

  useEffect(() => {
    let alive = true;
    void engine.loadVoices().then(() => {
      if (!alive) return;
      if (!engine.supported) setVoiceInfo('이 브라우저는 음성 읽기를 지원하지 않아요.');
      else if (engine.hasKoreanVoice) setVoiceInfo(`한국어 음성: ${engine.voiceName}`);
      else setVoiceInfo('한국어 음성을 찾지 못해 기본 음성으로 읽어요.');
    });
    void isStoragePersistent().then((p) => alive && setPersistent(p));
    return () => {
      alive = false;
    };
  }, [engine]);

  const preview = () => {
    unlock();
    if (state.speaking) {
      stop();
      return;
    }
    void play(
      buildQuestionScript({
        questionNumber: 1,
        text: '오늘은 날씨가 좋습니다.',
        repeatCount: Math.min(2, settings.repeatCount),
        pauseMs: settings.pauseSeconds * 1000,
        readQuestionNumber: settings.readQuestionNumber,
        endGuide: false,
      }),
      RATE_VALUES[settings.rate],
    );
  };

  const reset = async () => {
    if (!window.confirm('학습 기록과 오답노트를 모두 지울까요?\n(저장한 급수표와 설정은 남아요)')) return;
    await storage.resetStudyData();
    showToast('학습 기록을 초기화했어요.');
  };

  return (
    <main className="page">
      <TopBar title="부모 설정" onBack={back} />

      <section className="card settings-group">
        <h2 className="section-title">아이</h2>
        <label className="field">
          <span className="field__label">아이 이름</span>
          <input
            className="input"
            value={settings.childName}
            maxLength={20}
            placeholder="예: 서윤"
            onChange={(e) => updateSettings({ childName: e.target.value })}
          />
          <span className="field__hint">화면에 “{dictationTitle(settings.childName)}”처럼 보여요.</span>
        </label>
      </section>

      <section className="card settings-group">
        <h2 className="section-title">읽어 주기</h2>

        <div className="field">
          <span className="field__label">읽기 속도</span>
          <Segmented<SpeechRateOption>
            label="읽기 속도"
            value={settings.rate}
            options={(['slow', 'normal', 'fast'] as const).map((v) => ({ value: v, label: RATE_LABELS[v] }))}
            onChange={(v) => updateSettings({ rate: v })}
          />
        </div>

        <div className="field">
          <span className="field__label">한 문제 반복 횟수</span>
          <Segmented<number>
            label="반복 횟수"
            value={settings.repeatCount}
            options={REPEAT_OPTIONS.map((n) => ({ value: n, label: `${n}회` }))}
            onChange={(v) => updateSettings({ repeatCount: v })}
          />
        </div>

        <div className="field">
          <span className="field__label">반복 사이 쉬는 시간</span>
          <Segmented<number>
            label="반복 사이 쉬는 시간"
            value={settings.pauseSeconds}
            options={PAUSE_OPTIONS.map((n) => ({ value: n, label: `${n}초` }))}
            onChange={(v) => updateSettings({ pauseSeconds: v })}
          />
        </div>

        <button type="button" className="btn btn--secondary" onClick={preview} disabled={!supported}>
          {state.speaking ? '⏹ 그만 듣기' : '🔊 미리 듣기'}
        </button>
        <p className="muted small">{voiceInfo}</p>
      </section>

      <section className="card settings-group">
        <h2 className="section-title">시험</h2>
        <Toggle
          label="랜덤 출제"
          description="문제 순서를 섞어서 내요."
          checked={settings.randomOrder}
          onChange={(v) => updateSettings({ randomOrder: v })}
        />
        <Toggle
          label="문제 번호 읽기"
          description="“첫 번째 문제입니다.”라고 먼저 말해요."
          checked={settings.readQuestionNumber}
          onChange={(v) => updateSettings({ readQuestionNumber: v })}
        />
        <Toggle
          label="마지막 안내 읽기"
          description="“다 썼으면 다음 문제를 눌러주세요.”"
          checked={settings.endGuide}
          onChange={(v) => updateSettings({ endGuide: v })}
        />
        <Toggle
          label="시험 중 문장 숨기기"
          description="끄면 시험 화면에 문장이 보여요. (연습용)"
          checked={settings.hideSentence}
          onChange={(v) => updateSettings({ hideSentence: v })}
        />
        <Toggle
          label="끝나면 자동으로 채점 화면으로"
          checked={settings.autoGoToGrading}
          onChange={(v) => updateSettings({ autoGoToGrading: v })}
        />
      </section>

      <section className="card settings-group">
        <h2 className="section-title">데이터</h2>
        <p className="muted small">
          🔒 모든 기록은 이 기기의 브라우저 안에만 저장돼요. 사진은 저장하지 않아요.
          {!persistent && ' (지금은 사생활 보호 모드라 앱을 닫으면 기록이 사라져요.)'}
        </p>
        <button type="button" className="btn btn--danger" onClick={() => void reset()}>
          학습 기록 초기화
        </button>
      </section>

      <p className="app-version muted small">받쓰몬 v{__APP_VERSION__}</p>
    </main>
  );
}
