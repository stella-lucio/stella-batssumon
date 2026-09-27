import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ExamSession, GradeSummary, Settings, Sheet } from '../types';
import { storage } from '../services/storageService';
import { DEFAULT_SETTINGS } from '../utils/settings';

export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'manual' }
  | { name: 'editor'; sheet: Sheet; isNew: boolean; rawText?: string; roundId?: string; notice?: string }
  | { name: 'sheets' }
  | { name: 'wrong' }
  | { name: 'settings' }
  | { name: 'exam' }
  | { name: 'finish' }
  | { name: 'grading' }
  | { name: 'result'; summary: GradeSummary };

interface AppState {
  route: Route;
  navigate: (route: Route, opts?: { replace?: boolean }) => void;
  goHome: () => void;
  back: () => void;

  settings: Settings;
  settingsLoaded: boolean;
  updateSettings: (patch: Partial<Settings>) => void;

  session: ExamSession | null;
  setSession: (s: ExamSession | null) => void;

  toast: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppState | null>(null);

/**
 * 가벼운 화면 전환 + 브라우저 뒤로가기 연동.
 * 라우터 라이브러리 없이 history.state에 스택 위치만 기록한다.
 */
function useRouteStack() {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const stackRef = useRef<Route[]>(stack);

  useEffect(() => {
    try {
      history.replaceState({ batssumonIndex: 0 }, '');
    } catch {
      /* 일부 임베드 환경 */
    }
    const onPop = (e: PopStateEvent) => {
      const idx = typeof e.state?.batssumonIndex === 'number' ? e.state.batssumonIndex : 0;
      const prev = stackRef.current;
      const next: Route[] = idx < prev.length ? prev.slice(0, idx + 1) : [{ name: 'home' }];
      stackRef.current = next;
      setStack(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((route: Route, opts?: { replace?: boolean }) => {
    const prev = stackRef.current;
    const next = opts?.replace ? [...prev.slice(0, -1), route] : [...prev, route];
    stackRef.current = next;
    setStack(next);
    try {
      if (opts?.replace) history.replaceState({ batssumonIndex: next.length - 1 }, '');
      else history.pushState({ batssumonIndex: next.length - 1 }, '');
    } catch {
      /* 무시 */
    }
    window.scrollTo(0, 0);
  }, []);

  const goHome = useCallback(() => {
    const depth = stackRef.current.length - 1;
    const home: Route[] = [{ name: 'home' }];
    stackRef.current = home;
    setStack(home);
    try {
      if (depth > 0) history.go(-depth);
    } catch {
      /* 무시 */
    }
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    if (stackRef.current.length > 1) history.back();
  }, []);

  return { route: stack[stack.length - 1], navigate, goHome, back };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { route, navigate, goHome, back } = useRouteStack();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    storage
      .getSettings()
      .then(setSettings)
      .catch(() => undefined)
      .finally(() => setSettingsLoaded(true));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void storage.saveSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      route,
      navigate,
      goHome,
      back,
      settings,
      settingsLoaded,
      updateSettings,
      session,
      setSession,
      toast,
      showToast,
    }),
    [route, navigate, goHome, back, settings, settingsLoaded, updateSettings, session, toast, showToast],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
