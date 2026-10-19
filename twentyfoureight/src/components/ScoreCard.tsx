import { useEffect, useRef, useState } from 'react';

export function formatScore(value: number): string {
  if (value < 100_000) return value.toLocaleString('en-US');
  if (value < 1_000_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
}

interface ScoreCardProps {
  label: string;
  value: number;
  /** Points just gained — shown as a floating "+N". */
  delta?: number;
  /** Changes whenever a new delta should animate. */
  deltaKey?: number;
  highlight?: boolean;
  onClick?: () => void;
  clickLabel?: string;
}

export function ScoreCard({ label, value, delta = 0, deltaKey, highlight = false, onClick, clickLabel }: ScoreCardProps) {
  const [bump, setBump] = useState(0);
  const last = useRef(value);
  useEffect(() => {
    if (value > last.current) setBump((b) => b + 1);
    last.current = value;
  }, [value]);

  const content = (
    <>
      <span className="text-[0.62rem] font-bold tracking-[0.14em] text-card-label uppercase sm:text-[0.68rem]">{label}</span>
      <span
        key={bump}
        className={`block text-[1.15rem] leading-tight font-extrabold tabular-nums text-card-value sm:text-[1.35rem] ${bump ? 'score-bump' : ''}`}
      >
        {formatScore(value)}
      </span>
      {delta > 0 && (
        <span
          key={deltaKey}
          className="score-float pointer-events-none absolute top-[38%] left-1/2 text-base font-extrabold text-[#f6d66b] tabular-nums [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]"
          aria-hidden="true"
        >
          +{delta}
        </span>
      )}
    </>
  );

  const base = `relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl bg-card px-2 py-1.5 shadow-sm transition-colors ${
    highlight ? 'ring-2 ring-[#edc22e] ring-offset-2 ring-offset-bg' : ''
  }`;

  if (onClick) {
    return (
      <button type="button" className={`${base} cursor-pointer hover:brightness-110`} onClick={onClick} aria-label={clickLabel}>
        {content}
      </button>
    );
  }
  return (
    <div className={base}>
      {content}
    </div>
  );
}
