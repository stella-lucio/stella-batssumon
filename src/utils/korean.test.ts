import { describe, expect, it } from 'vitest';
import { dictationTitle, friendlyName, hasBatchim, ordinalKorean } from './korean';

describe('아이 이름 처리', () => {
  it('받침 여부', () => {
    expect(hasBatchim('서윤')).toBe(true);
    expect(hasBatchim('지우')).toBe(false);
    expect(hasBatchim('Emma')).toBeNull();
  });

  it.each([
    ['서윤', '서윤이'],
    ['민준', '민준이'],
    ['지우', '지우'],
    ['하은', '하은이'],
    ['Emma', 'Emma'],
    ['', ''],
  ])('%s → %s', (name, expected) => {
    expect(friendlyName(name)).toBe(expected);
  });

  it('받아쓰기 제목', () => {
    expect(dictationTitle('서윤')).toBe('서윤이의 받아쓰기');
    expect(dictationTitle('지우')).toBe('지우의 받아쓰기');
    expect(dictationTitle('')).toBe('오늘의 받아쓰기');
  });
});

describe('ordinalKorean (문제 번호 읽기)', () => {
  it.each([
    [1, '첫 번째'],
    [2, '두 번째'],
    [3, '세 번째'],
    [4, '네 번째'],
    [10, '열 번째'],
    [11, '열한 번째'],
    [12, '열두 번째'],
    [20, '스무 번째'],
    [21, '스물한 번째'],
    [30, '서른 번째'],
  ])('%d → %s', (n, expected) => {
    expect(ordinalKorean(n)).toBe(expected);
  });
});
