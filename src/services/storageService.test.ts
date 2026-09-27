import { describe, expect, it } from 'vitest';
import type { ExamItem, Sheet } from '../types';
import { createExamSession, createRetrySession } from '../utils/exam';
import { DEFAULT_SETTINGS } from '../utils/settings';
import { MemoryBackend, StorageService } from './storageService';

function items(n: number): ExamItem[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `8급|3회|문장${i + 1}`,
    text: `문장 ${i + 1}.`,
    sheetTitle: '8급',
    roundName: '3회',
  }));
}

describe('학습 결과 저장', () => {
  it('채점 결과를 저장하면 학습 기록과 오답노트가 생긴다', async () => {
    const store = new StorageService(new MemoryBackend());
    const session = createExamSession(items(10), { mode: 'normal', title: '8급 · 3회' });
    const wrong = new Set([session.items[0].key, session.items[1].key]);

    const out = await store.saveGradingResult(session, wrong, 1000);
    expect(out.summary).toMatchObject({ total: 10, correct: 8, wrong: 2, rate: 80 });

    const records = await store.listRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ title: '8급 · 3회', total: 10, correct: 8, wrong: 2, attempt: 1 });

    const notes = await store.listWrongNotes();
    expect(notes).toHaveLength(2);
    expect(notes.every((n) => n.status === 'review' && n.wrongCount === 1)).toBe(true);
  });

  it('오답 재시험에서 모두 맞히면 오답노트가 정복 상태로 바뀐다', async () => {
    const store = new StorageService(new MemoryBackend());
    const first = createExamSession(items(5), { mode: 'normal', title: '8급 · 3회' });
    const wrong = new Set([first.items[2].key]);
    await store.saveGradingResult(first, wrong, 1000);

    const retry = createRetrySession(first, wrong)!;
    await store.saveGradingResult(retry, new Set(), 2000);

    const notes = await store.listWrongNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ status: 'mastered', wrongCount: 1, correctCount: 1, lastStudiedAt: 2000 });
    expect((await store.listRecords()).map((r) => r.attempt)).toEqual([2, 1]);
  });

  it('학습 기록 초기화는 급수표를 지우지 않는다', async () => {
    const store = new StorageService(new MemoryBackend());
    const sheet: Sheet = {
      id: 's1',
      title: '8급',
      rounds: [{ id: 'r1', name: '1회', sentences: [{ id: 'a', text: '학교에 갑니다.' }] }],
      createdAt: 1,
      updatedAt: 1,
    };
    await store.saveSheet(sheet);
    await store.saveGradingResult(
      createExamSession(items(2), { mode: 'normal', title: 't' }),
      new Set(['8급|3회|문장1']),
    );
    await store.resetStudyData();
    expect(await store.listRecords()).toEqual([]);
    expect(await store.listWrongNotes()).toEqual([]);
    expect(await store.listSheets()).toHaveLength(1);
  });
});

describe('급수표·설정 저장', () => {
  it('급수표 저장/수정/삭제', async () => {
    const store = new StorageService(new MemoryBackend());
    const sheet: Sheet = { id: 's1', title: '8급', rounds: [], createdAt: 1, updatedAt: 1 };
    await store.saveSheet(sheet);
    await store.saveSheet({ ...sheet, title: '10월 1주차' });
    const list = await store.listSheets();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('10월 1주차');
    await store.deleteSheet('s1');
    expect(await store.listSheets()).toEqual([]);
  });

  it('설정 기본값: 반복 3회', async () => {
    const store = new StorageService(new MemoryBackend());
    const s = await store.getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.repeatCount).toBe(3);
  });

  it('잘못된 설정값은 기본값으로 복원한다', async () => {
    const store = new StorageService(new MemoryBackend());
    await store.saveSettings({ ...DEFAULT_SETTINGS, childName: '서윤', repeatCount: 99 });
    const s = await store.getSettings();
    expect(s.childName).toBe('서윤');
    expect(s.repeatCount).toBe(3);
  });
});
