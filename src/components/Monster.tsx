interface MonsterProps {
  size?: number;
  /** 말하는 중이면 살짝 움직인다 */
  talking?: boolean;
  mood?: 'happy' | 'cheer' | 'calm';
  className?: string;
}

/** 받쓰몬 마스코트 (연필을 든 보라색 꼬마 몬스터) */
export function Monster({ size = 96, talking = false, mood = 'happy', className = '' }: MonsterProps) {
  const mouth =
    mood === 'cheer' ? (
      <path d="M40 66 Q50 80 60 66 Z" fill="#3b2a6b" />
    ) : talking ? (
      <ellipse cx="50" cy="69" rx="6" ry="5" fill="#3b2a6b" className="monster-mouth" />
    ) : (
      <path d="M41 66 Q50 74 59 66" stroke="#3b2a6b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    );

  return (
    <svg
      className={`monster ${talking ? 'monster--talking' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="받쓰몬"
    >
      {/* 더듬이 */}
      <path d="M36 20 Q30 8 22 10" stroke="#7c6cf0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M64 20 Q70 8 78 10" stroke="#7c6cf0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="22" cy="10" r="5" fill="#ffb84d" />
      <circle cx="78" cy="10" r="5" fill="#ffb84d" />
      {/* 몸 */}
      <path
        d="M14 58 C14 30 30 18 50 18 C70 18 86 30 86 58 L86 84 Q80 78 74 84 Q68 90 62 84 Q56 78 50 84 Q44 90 38 84 Q32 78 26 84 Q20 90 14 84 Z"
        fill="#8b7bf7"
      />
      <ellipse cx="50" cy="66" rx="24" ry="16" fill="#a99df9" opacity="0.55" />
      {/* 눈 */}
      <ellipse cx="38" cy="46" rx="9" ry="10" fill="#fff" />
      <ellipse cx="62" cy="46" rx="9" ry="10" fill="#fff" />
      <circle cx="40" cy="48" r="4.5" fill="#2b1f55" />
      <circle cx="64" cy="48" r="4.5" fill="#2b1f55" />
      <circle cx="41.5" cy="46" r="1.5" fill="#fff" />
      <circle cx="65.5" cy="46" r="1.5" fill="#fff" />
      {/* 볼 */}
      <circle cx="27" cy="60" r="4.5" fill="#ff9fb2" opacity="0.8" />
      <circle cx="73" cy="60" r="4.5" fill="#ff9fb2" opacity="0.8" />
      {mouth}
      {/* 연필 */}
      <g transform="rotate(35 88 60)">
        <rect x="84" y="44" width="7" height="26" rx="1.5" fill="#ffc94d" />
        <rect x="84" y="44" width="7" height="5" rx="1.5" fill="#ff8a8a" />
        <path d="M84 70 L87.5 78 L91 70 Z" fill="#f4d7a8" />
        <path d="M86.4 75.5 L87.5 78 L88.6 75.5 Z" fill="#3b2a6b" />
      </g>
    </svg>
  );
}
