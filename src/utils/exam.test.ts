import { describe, expect, it } from 'vitest';
import type { ExamItem, WrongNote } from '../types';
import {
  applyGradingToNotes,
  createExamSession,
  createRetrySession,
  filterWrongNotes,
  gradeExam,
  roundToItems,
  shuffle,
  uniqueByKey,
} from './exam';

/** 결정적인 테스트용 난수 (mulberry32) */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeItems(n: number): ExamItem[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `k${i + 1}`,
    text: `문장 ${i + 1}`,
    sheetTitle: '8급',
    roundName: '3회',
  }));
}

describe('shuffle (중복 없는 셔플)', () => {
  it('모든 요소를 정확히 한 번씩 포함한다', () => {
    const src = Array.from({ length: 10 }, (_, i) => i + 1);
    for (let seed = 1; seed <= 50; seed++) {
      const out = shuffle(src, seeded(seed));
      expect(out).toHaveLength(10);
      expect(new Set(out).size).toBe(10);
      expect([...out].sort((a, b) => a - b)).toEqual(src);
    }
  });

  it('원본 배열을 변경하지 않는다', () => {
    const src = [1, 2, 3, 4, 5];
    shuffle(src, seeded(7));
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it('실제로 순서를 섞는다 (원래 순서 그대로 나오는 경우가 드묾)', () => {
    const src = Array.from({ length: 10 }, (_, i) => i);
    let same = 0;
    for (let seed = 1; seed <= 100; seed++) {
      if (shuffle(src, seeded(seed)).every((v, i) => v === src[i])) same++;
    }
    expect(same).toBeLessThan(3);
  });

  it('빈 배열과 한 개짜리 배열도 처리한다', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['a'])).toEqual(['a']);
  });
});

describe('createExamSession (랜덤 문제 생성)', () => {
  it('랜덤 출제 시 같은 문제가 중복 출제되지 않는다', () => {
    const items = makeItems(10);
    const s = createExamSession([...items, items[0], items[3]], { mode: 'normal', title: '8급', rng: seeded(3) });
    expect(s.items).toHaveLength(10);
    expect(new Set(s.items.map((i) => i.key)).size).toBe(10);
    expect(s.attempt).toBe(1);
    expect(s.originalTotal).toBe(10);
  });

  it('랜덤 출제를 끄면 급수표 순서대로 낸다', () => {
    const items = makeItems(5);
    const s = createExamSession(items, { mode: 'normal', title: '8급', random: false });
    expect(s.items.map((i) => i.key)).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
  });

  it('회차 → 문제 변환 시 빈 문장은 제외한다', () => {
    const items = roundToItems(
      { id: 's1', title: '8급' },
      {
        id: 'r1',
        name: '3회',
        sentences: [
          { id: 'a', text: '학교에 갑니다.' },
          { id: 'b', text: '   ' },
          { id: 'c', text: '친구와 놉니다.' },
        ],
      },
    );
    expect(items.map((i) => i.text)).toEqual(['학교에 갑니다.', '친구와 놉니다.']);
    expect(items[0].sheetId).toBe('s1');
  });

  it('uniqueByKey는 처음 나온 항목을 유지한다', () => {
    const a = makeItems(2);
    expect(uniqueByKey([a[0], a[1], { ...a[0], text: 'x' }])).toEqual(a);
  });
});

describe('채점과 오답 재시험', () => {
  it('gradeExam: 맞은/틀린 개수와 정답률', () => {
    const items = makeItems(10);
    const g = gradeExam(items, new Set(['k3', 'k7']));
    expect(g.total).toBe(10);
    expect(g.correct).toBe(8);
    expect(g.wrong).toBe(2);
    expect(g.rate).toBe(80);
    expect(g.wrongItems.map((i) => i.key)).toEqual(['k3', 'k7']);
  });

  it('오답 필터링: 틀린 문제만으로 재시험을 만든다', () => {
    const first = createExamSession(makeItems(10), { mode: 'normal', title: '8급', rng: seeded(11) });
    const retry = createRetrySession(first, new Set(['k3', 'k7', 'k9']), { rng: seeded(5) });
    expect(retry).not.toBeNull();
    expect(retry!.mode).toBe('retry');
    expect(retry!.attempt).toBe(2);
    expect(retry!.originalTotal).toBe(10);
    expect(retry!.items).toHaveLength(3);
    expect(retry!.items.map((i) => i.key).sort()).toEqual(['k3', 'k7', 'k9']);
  });

  it('재시험에서 또 틀린 문제만 다음 재시험에 남는다', () => {
    const first = createExamSession(makeItems(10), { mode: 'normal', title: '8급' });
    const second = createRetrySession(first, new Set(['k3', 'k7', 'k9']))!;
    const third = createRetrySession(second, new Set(['k7']))!;
    expect(third.attempt).toBe(3);
    expect(third.items.map((i) => i.key)).toEqual(['k7']);
    expect(createRetrySession(third, new Set())).toBeNull();
  });

  it('오답 복습 세션의 재시험은 review 모드를 유지한다', () => {
    const review = createExamSession(makeItems(3), { mode: 'review', title: '오답 복습' });
    expect(createRetrySession(review, new Set(['k1']))!.mode).toBe('review');
  });
});

describe('오답노트 반영', () => {
  const NOW = new Date(2026, 8, 27, 10).getTime();

  it('틀린 문제는 새로 추가하고, 다시 틀리면 횟수를 올린다', () => {
    const items = makeItems(3);
    const first = applyGradingToNotes(new Map(), items, new Set(['k2']), NOW);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ key: 'k2', wrongCount: 1, correctCount: 0, status: 'review', lastWrongAt: NOW });

    const map = new Map(first.map((n) => [n.key, n] as const));
    const again = applyGradingToNotes(map, items, new Set(['k2']), NOW + 1000);
    expect(again[0].wrongCount).toBe(2);
  });

  it('오답노트에 있는 문제를 맞히면 맞힌 횟수를 올리고 정복 상태가 된다', () => {
    const items = makeItems(3);
    const map = new Map(applyGradingToNotes(new Map(), items, new Set(['k1']), NOW).map((n) => [n.key, n] as const));
    const changed = applyGradingToNotes(map, items, new Set(), NOW + 5000);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ key: 'k1', wrongCount: 1, correctCount: 1, status: 'mastered' });
  });

  it('처음부터 맞힌 문제는 오답노트에 넣지 않는다', () => {
    expect(applyGradingToNotes(new Map(), makeItems(3), new Set(), NOW)).toEqual([]);
  });

  it('기간별 오답 필터 (오늘 / 최근 7일 / 전체)', () => {
    const DAY = 86400000;
    const mk = (key: string, ago: number, status: WrongNote['status'] = 'review'): WrongNote => ({
      key,
      text: key,
      sheetTitle: '8급',
      roundName: '1회',
      wrongCount: 1,
      correctCount: 0,
      lastWrongAt: NOW - ago,
      lastStudiedAt: NOW - ago,
      status,
    });
    const notes = [mk('today', 0), mk('d3', 3 * DAY), mk('d10', 10 * DAY), mk('done', 0, 'mastered')];
    expect(filterWrongNotes(notes, 'today', NOW).map((n) => n.key)).toEqual(['today']);
    expect(filterWrongNotes(notes, 'week', NOW).map((n) => n.key)).toEqual(['today', 'd3']);
    expect(filterWrongNotes(notes, 'all', NOW).map((n) => n.key)).toEqual(['today', 'd3', 'd10']);
    expect(filterWrongNotes(notes, 'all', NOW, true)).toHaveLength(4);
  });
});
