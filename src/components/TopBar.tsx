import type { ReactNode } from 'react';

interface TopBarProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}

export function TopBar({ title, onBack, backLabel = '뒤로', right }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__side">
        {onBack && (
          <button type="button" className="icon-btn" onClick={onBack} aria-label={backLabel}>
            <span aria-hidden="true">‹</span>
          </button>
        )}
      </div>
      <h1 className="topbar__title">{title}</h1>
      <div className="topbar__side topbar__side--right">{right}</div>
    </header>
  );
}
