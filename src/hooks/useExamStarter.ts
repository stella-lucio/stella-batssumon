import { useCallback } from 'react';
import { useApp } from '../store/AppContext';
import type { ExamItem, ExamMode, Round, Sheet } from '../types';
import { createExamSession, roundToItems } from '../utils/exam';
import { examTitle } from '../utils/sheet';

/** 급수표 회차 / 오답 목록으로 시험을 시작하는 공통 로직 */
export function useExamStarter() {
  const { settings, setSession, navigate, showToast } = useApp();

  const startItems = useCallback(
    (items: ExamItem[], title: string, mode: ExamMode, opts?: { replace?: boolean }) => {
      if (items.length === 0) {
        showToast('시험 볼 문장이 없어요.');
        return false;
      }
      const session = createExamSession(items, { mode, title, random: settings.randomOrder });
      setSession(session);
      navigate({ name: 'exam' }, opts);
      return true;
    },
    [settings.randomOrder, setSession, navigate, showToast],
  );

  const startRound = useCallback(
    (sheet: Sheet, round: Round, opts?: { replace?: boolean }) =>
      startItems(roundToItems(sheet, round), examTitle(sheet.title, round.name), 'normal', opts),
    [startItems],
  );

  return { startItems, startRound };
}
