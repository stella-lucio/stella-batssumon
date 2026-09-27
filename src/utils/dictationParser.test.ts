import { describe, expect, it } from 'vitest';
import {
  cleanSentence,
  detectRoundHeader,
  linesToSentences,
  parseDictationText,
  parseManualInput,
  stripNumbering,
} from './dictationParser';

describe('stripNumbering (번호 제거)', () => {
  it.each([
    ['1. 학교에 갑니다.', '학교에 갑니다.'],
    ['1) 학교에 갑니다.', '학교에 갑니다.'],
    ['(1) 학교에 갑니다.', '학교에 갑니다.'],
    ['① 학교에 갑니다.', '학교에 갑니다.'],
    ['1번 학교에 갑니다.', '학교에 갑니다.'],
    ['1 - 학교에 갑니다.', '학교에 갑니다.'],
    ['10. 친구와 놉니다.', '친구와 놉니다.'],
    ['3 오늘은 날씨가 좋습니다.', '오늘은 날씨가 좋습니다.'],
    ['2.| 강아지가 뛰어갑니다.', '강아지가 뛰어갑니다.'],
  ])('%s → %s', (input, expected) => {
    const r = stripNumbering(input);
    expect(r.numbered).toBe(true);
    expect(r.text).toBe(expected);
  });

  it('원문자 번호의 숫자를 알아낸다', () => {
    expect(stripNumbering('③ 하늘이 맑습니다.').number).toBe(3);
  });

  it('번호가 없는 문장은 그대로 둔다', () => {
    const r = stripNumbering('학교에 갑니다.');
    expect(r.numbered).toBe(false);
    expect(r.text).toBe('학교에 갑니다.');
  });

  it('"첫번째" 같은 표현은 번호로 오인하지 않는다', () => {
    expect(stripNumbering('두번째 줄입니다.').numbered).toBe(false);
  });
});

describe('cleanSentence (노이즈 정리)', () => {
  it('앞뒤 공백·중복 공백·문장부호 앞 공백을 정리한다', () => {
    expect(cleanSentence('   학교에   갑니다 .  ')).toBe('학교에 갑니다.');
  });
  it('앞뒤 이상한 특수문자를 제거한다', () => {
    expect(cleanSentence('|_ 친구와 놉니다. |')).toBe('친구와 놉니다.');
  });
  it('따옴표는 문장의 일부이므로 남긴다', () => {
    expect(cleanSentence('"안녕?" 하고 말했습니다.')).toBe('"안녕?" 하고 말했습니다.');
  });
  it('맞춤법 등 문장 내용은 고치지 않는다', () => {
    expect(cleanSentence('할교에 갑니다.')).toBe('할교에 갑니다.');
  });
});

describe('detectRoundHeader (회차 인식)', () => {
  it.each([
    ['1회', 1],
    ['1회차', 1],
    ['제1회', 1],
    ['제 2 회', 2],
    ['2회차', 2],
    ['[3회]', 3],
    ['3회 받아쓰기', 3],
    ['10회', 10],
    ['4회 (9월 3일)', 4],
  ])('%s → %d회', (line, n) => {
    expect(detectRoundHeader(line)?.number).toBe(n);
  });

  it('회차와 첫 문장이 같은 줄에 있어도 인식한다', () => {
    const h = detectRoundHeader('1회 1. 학교에 갑니다.');
    expect(h?.number).toBe(1);
    expect(h?.rest).toBe('1. 학교에 갑니다.');
  });

  it('문장 속 "3회 연속"은 회차로 보지 않는다', () => {
    expect(detectRoundHeader('3회 연속 이겼습니다.')).toBeNull();
  });
});

describe('parseDictationText (OCR 텍스트 → 문제 목록)', () => {
  it('여러 회차를 분리한다', () => {
    const text = `1회
1. 학교에 갑니다.
2. 친구와 놉니다.
3. 하늘이 맑습니다.

2회
1. 강아지가 뛰어갑니다.
2. 맛있는 음식을 먹습니다.`;
    const r = parseDictationText(text);
    expect(r.roundsDetected).toBe(true);
    expect(r.rounds).toHaveLength(2);
    expect(r.rounds[0]).toEqual({
      name: '1회',
      sentences: ['학교에 갑니다.', '친구와 놉니다.', '하늘이 맑습니다.'],
    });
    expect(r.rounds[1].name).toBe('2회');
    expect(r.rounds[1].sentences).toEqual(['강아지가 뛰어갑니다.', '맛있는 음식을 먹습니다.']);
  });

  it('회차 표기 형식이 섞여 있어도 처리한다', () => {
    const text = '제1회\n① 학교에 갑니다.\n② 친구와 놉니다.\n2회차\n1) 하늘이 맑습니다.\n2) 비가 옵니다.';
    const r = parseDictationText(text);
    expect(r.rounds.map((x) => x.name)).toEqual(['1회', '2회']);
    expect(r.rounds[1].sentences).toEqual(['하늘이 맑습니다.', '비가 옵니다.']);
  });

  it('급수 제목을 찾아 제안한다', () => {
    const r = parseDictationText('8급 받아쓰기 급수표\n1회\n1. 학교에 갑니다.\n2. 친구와 놉니다.');
    expect(r.suggestedTitle).toBe('8급');
    expect(r.rounds[0].sentences).toHaveLength(2);
  });

  it('페이지 번호, 빈 줄, 노이즈 줄을 제거한다', () => {
    const text = `1회

1. 학교에 갑니다.
|||
2. 친구와 놉니다.
- 3 -
1/2`;
    const r = parseDictationText(text);
    expect(r.rounds[0].sentences).toEqual(['학교에 갑니다.', '친구와 놉니다.']);
  });

  it('두 줄로 나뉜 문장을 이어 붙인다', () => {
    const text = '1회\n1. 우리 가족은 주말에\n놀이공원에 갔습니다.\n2. 친구와 놉니다.';
    const r = parseDictationText(text);
    expect(r.rounds[0].sentences).toEqual(['우리 가족은 주말에 놀이공원에 갔습니다.', '친구와 놉니다.']);
  });

  it('회차를 못 찾으면 전체를 하나의 급수표로 만든다', () => {
    const r = parseDictationText('1. 학교에 갑니다.\n2. 친구와 놉니다.');
    expect(r.roundsDetected).toBe(false);
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0].name).toBe('받아쓰기');
    expect(r.rounds[0].sentences).toHaveLength(2);
  });

  it('빈 텍스트나 알아볼 수 없는 텍스트에도 멈추지 않는다', () => {
    expect(parseDictationText('').rounds).toEqual([]);
    expect(parseDictationText('@@@ ### \n |||').rounds).toEqual([]);
  });

  it('"반갑습니다" 같은 문장을 머리글로 오인하지 않는다', () => {
    const r = parseDictationText('반갑습니다.\n2학년이 되었습니다.');
    expect(r.rounds[0].sentences).toEqual(['반갑습니다.', '2학년이 되었습니다.']);
  });

  it('번호만 있는 줄(표 형태)은 다음 줄을 새 문장으로 본다', () => {
    const r = linesToSentences(['1', '학교에 갑니다', '2', '친구와 놉니다']);
    expect(r).toEqual(['학교에 갑니다', '친구와 놉니다']);
  });
});

describe('parseManualInput (직접 입력)', () => {
  it('줄바꿈 기준으로 한 문제씩 만든다', () => {
    const r = parseManualInput('학교에 갑니다.\n친구와 놉니다.\n오늘은 날씨가 좋습니다.');
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0].sentences).toEqual(['학교에 갑니다.', '친구와 놉니다.', '오늘은 날씨가 좋습니다.']);
  });

  it('마침표가 없어도 줄마다 별도 문제로 만든다', () => {
    const r = parseManualInput('학교에 갑니다\n친구와 놉니다');
    expect(r.rounds[0].sentences).toEqual(['학교에 갑니다', '친구와 놉니다']);
  });

  it('붙여넣은 번호도 제거한다', () => {
    const r = parseManualInput('1. 학교에 갑니다.\n2) 친구와 놉니다.');
    expect(r.rounds[0].sentences).toEqual(['학교에 갑니다.', '친구와 놉니다.']);
  });
});
