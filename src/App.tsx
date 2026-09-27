import { useEffect } from 'react';
import { ExamPage } from './pages/ExamPage';
import { FinishPage } from './pages/FinishPage';
import { GradingPage } from './pages/GradingPage';
import { HomePage } from './pages/HomePage';
import { ManualInputPage } from './pages/ManualInputPage';
import { ResultPage } from './pages/ResultPage';
import { ScanPage } from './pages/ScanPage';
import { SettingsPage } from './pages/SettingsPage';
import { SheetEditorPage } from './pages/SheetEditorPage';
import { SheetsPage } from './pages/SheetsPage';
import { WrongNotesPage } from './pages/WrongNotesPage';
import { requestPersistentStorage } from './services/storageService';
import { AppProvider, useApp } from './store/AppContext';

function Screen() {
  const { route, session } = useApp();
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'scan':
      return <ScanPage />;
    case 'manual':
      return <ManualInputPage />;
    case 'editor':
      // key: 다른 급수표를 열면 편집 상태를 새로 시작
      return (
        <SheetEditorPage
          key={route.sheet.id}
          sheet={route.sheet}
          isNew={route.isNew}
          rawText={route.rawText}
          roundId={route.roundId}
          notice={route.notice}
        />
      );
    case 'sheets':
      return <SheetsPage />;
    case 'wrong':
      return <WrongNotesPage />;
    case 'settings':
      return <SettingsPage />;
    case 'exam':
      return <ExamPage key={session?.id} />;
    case 'finish':
      return <FinishPage />;
    case 'grading':
      return <GradingPage />;
    case 'result':
      return <ResultPage summary={route.summary} />;
  }
}

function Toast() {
  const { toast } = useApp();
  return (
    <div className={`toast ${toast ? 'toast--show' : ''}`} role="status" aria-live="polite">
      {toast}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    <AppProvider>
      <div className="app">
        <Screen />
        <Toast />
      </div>
    </AppProvider>
  );
}
