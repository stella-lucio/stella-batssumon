import { expect, test, type Page } from '@playwright/test';

/**
 * speechSynthesis mock: 실제 소리를 내지 않고, 읽은 문장을 window.__spoken에 기록한다.
 * onend를 비동기로 호출해 실제 브라우저처럼 동작시킨다.
 */
async function mockSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;

    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onstart: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    let current: MockUtterance | null = null;
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      speak(u: MockUtterance) {
        if (u.text.trim()) spoken.push(u.text);
        current = u;
        this.speaking = true;
        setTimeout(() => {
          if (current !== u) return;
          current = null;
          synth.speaking = false;
          u.onend?.();
        }, 30);
      },
      cancel() {
        const u = current;
        current = null;
        this.speaking = false;
        u?.onerror?.({ error: 'canceled' });
      },
      pause() {},
      resume() {},
      getVoices: () => [{ name: 'Yuna', lang: 'ko-KR', localService: true, default: true, voiceURI: 'Yuna' }],
      addEventListener() {},
      removeEventListener() {},
      onvoiceschanged: null,
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: MockUtterance, configurable: true });
  });
}

const spokenTexts = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

/** 연타 방지(600ms) 때문에 버튼 사이에 잠깐 기다린다 */
const tapGap = (page: Page) => page.waitForTimeout(700);

const SENTENCES = ['학교에 갑니다.', '친구와 놉니다.', '오늘은 날씨가 좋습니다.'];

test.beforeEach(async ({ page }) => {
  await mockSpeech(page);
});

test('직접 입력 → 시험 → 채점 → 오답 재시험 → 오답 정복', async ({ page }) => {
  // 1. 앱 실행
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /받쓰몬/ })).toBeVisible();
  await expect(page.getByText('오늘 받아쓰기도 혼자 해볼까?')).toBeVisible();

  // 2. 직접 입력으로 3문제 생성
  await page.getByRole('button', { name: /직접 입력하기/ }).click();
  await page.getByPlaceholder('예: 8급, 10월 1주차').fill('8급');
  await page.getByLabel('받아쓰기 문장 입력').fill(SENTENCES.join('\n'));
  await expect(page.getByText('3문제가 만들어져요.')).toBeVisible();
  await page.getByRole('button', { name: /문제 만들기/ }).click();

  // 3. 확인/수정 화면
  await expect(page.getByRole('heading', { name: '인식 결과 확인' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '1번 문장' })).toHaveValue(SENTENCES[0]);
  await page.getByRole('button', { name: /시험 시작/ }).click();

  // 4. 시험 시작 (준비 화면 → 시작하기)
  await page.getByRole('button', { name: '받아쓰기 시작하기' }).click();
  const counter = page.getByTestId('question-counter');
  await expect(counter).toContainText('1');
  await expect(counter).toContainText('/ 3');

  // 정답 문장은 시험 중 화면에 보이지 않아야 한다
  for (const s of SENTENCES) await expect(page.getByText(s, { exact: true })).toHaveCount(0);

  // 선생님처럼 "첫 번째 문제입니다." + 문장 3번
  await expect.poll(async () => (await spokenTexts(page)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  const firstSpoken = await spokenTexts(page);
  expect(firstSpoken[0]).toBe('첫 번째 문제입니다.');
  const firstSentence = firstSpoken[1];
  expect(SENTENCES).toContain(firstSentence);
  expect(firstSpoken.slice(1, 4)).toEqual([firstSentence, firstSentence, firstSentence]);

  // 5. 문제 넘기기
  await tapGap(page);
  await page.getByRole('button', { name: /다 썼어요/ }).click();
  await expect(counter).toContainText('2');
  await tapGap(page);
  await page.getByRole('button', { name: /다 썼어요/ }).click();
  await expect(counter).toContainText('3');
  await tapGap(page);

  // 6. 시험 완료
  await page.getByRole('button', { name: /다 썼어요/ }).click();
  await expect(page.getByRole('heading', { name: /받아쓰기 끝/ })).toBeVisible();
  await expect(page.getByText('채점해 볼까요?')).toBeVisible();
  await page.getByRole('button', { name: /채점하기/ }).click();

  // 7. 채점: 기본은 모두 "맞았어요", 한 문제만 오답 체크
  await expect(page.getByRole('heading', { name: '채점하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /맞았어요/, pressed: true })).toHaveCount(3);
  await page.getByRole('button', { name: '2번 틀렸어요' }).click();
  await expect(page.getByText('✅ 맞음 2 · ❌ 틀림 1')).toBeVisible();
  await page.getByRole('button', { name: '채점 완료' }).click();

  // 8. 결과
  await expect(page.getByRole('heading', { name: '오늘의 받아쓰기 결과' })).toBeVisible();
  await expect(page.getByText('정답률')).toContainText('67%');
  await expect(page.getByText('1문제만 다시 도전해 볼까요?')).toBeVisible();

  // 9. 오답 재시험 시작
  await page.getByRole('button', { name: /틀린 문제만 다시 시험/ }).click();
  await expect(page.getByRole('heading', { name: /틀린 문제 다시 도전/ })).toBeVisible();
  await page.getByRole('button', { name: '받아쓰기 시작하기' }).click();
  await expect(counter).toContainText('/ 1');

  // 10. 재시험 완료 → 모두 맞음 → 오답 정복
  await tapGap(page);
  await page.getByRole('button', { name: /다 썼어요/ }).click();
  await page.getByRole('button', { name: /채점하기/ }).click();
  await page.getByRole('button', { name: '채점 완료' }).click();
  await expect(page.getByRole('heading', { name: /오답 정복 완료/ })).toBeVisible();
  await expect(page.getByText('오늘 받아쓰기를 모두 정복했어요.')).toBeVisible();

  // 11. 홈에 최근 학습이 보인다
  await page.getByRole('button', { name: /처음으로/ }).click();
  await expect(page.getByText('최근 학습')).toBeVisible();
  await expect(page.getByText('1문제 중')).toBeVisible();
});

test('다시 듣기를 연타해도 음성이 겹치지 않는다', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /직접 입력하기/ }).click();
  await page.getByLabel('받아쓰기 문장 입력').fill('하늘이 맑습니다.');
  await page.getByRole('button', { name: /문제 만들기/ }).click();
  await page.getByRole('button', { name: /시험 시작/ }).click();
  await page.getByRole('button', { name: '받아쓰기 시작하기' }).click();

  const replay = page.getByRole('button', { name: '문장 다시 듣기' });
  await tapGap(page);
  await replay.click();
  await replay.click(); // 연타 → 무시되어야 함
  await replay.click();

  // mock은 동시에 하나만 재생하므로, 연타가 무시되면 마지막 재생이 정상적으로 끝까지 진행된다
  await expect
    .poll(async () => (await spokenTexts(page)).filter((t) => t === '하늘이 맑습니다.').length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(3);
});

test('저장한 급수표 목록에서 시험을 시작하고 오답노트를 확인한다', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /직접 입력하기/ }).click();
  await page.getByPlaceholder('예: 8급, 10월 1주차').fill('9월 4주차');
  await page
    .getByLabel('받아쓰기 문장 입력')
    .fill('1회\n1. 강아지가 뜁니다.\n2. 고양이가 잡니다.\n2회\n1. 비가 옵니다.');
  await page.getByRole('button', { name: /문제 만들기/ }).click();
  await expect(page.getByRole('tab', { name: /1회/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /2회/ })).toBeVisible();
  await page.getByRole('button', { name: /저장하기/ }).click();
  await expect(page.getByText('저장했어요')).toBeVisible();

  await page.getByRole('button', { name: '뒤로' }).click();
  await page.getByRole('button', { name: /저장한 급수표/ }).click();
  await expect(page.getByRole('heading', { name: '9월 4주차' })).toBeVisible();
  await page.getByRole('button', { name: '9월 4주차 2회 시험 시작' }).click();
  await page.getByRole('button', { name: '받아쓰기 시작하기' }).click();
  await tapGap(page);
  await page.getByRole('button', { name: /다 썼어요/ }).click();
  await page.getByRole('button', { name: /채점하기/ }).click();
  await page.getByRole('button', { name: '1번 틀렸어요' }).click();
  await page.getByRole('button', { name: '채점 완료' }).click();
  await page.getByRole('button', { name: /오늘은 여기까지/ }).click();

  await page.getByRole('button', { name: /틀린 문제 복습/ }).click();
  await expect(page.getByText('비가 옵니다.')).toBeVisible();
  await expect(page.getByText('📌 복습 필요')).toBeVisible();
  await expect(page.getByRole('button', { name: /오답 시험 시작 \(1문제\)/ })).toBeEnabled();
});
