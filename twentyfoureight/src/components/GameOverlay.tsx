import { Trophy } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { GameStatus } from '../game/types';
import { formatScore } from './ScoreCard';

interface GameOverlayProps {
  status: GameStatus;
  score: number;
  best: number;
  isNewBest: boolean;
  canUndo: boolean;
  onKeepPlaying: () => void;
  onNewGame: () => void;
  onUndo: () => void;
  onClose: () => void;
}

/** Victory / game-over panel layered over the board. */
export function GameOverlay({ status, score, best, isNewBest, canUndo, onKeepPlaying, onNewGame, onUndo, onClose }: GameOverlayProps) {
  const primary = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Give the reveal animation a moment, then move focus to the main action.
    const t = setTimeout(() => primary.current?.focus({ preventScroll: true }), 650);
    return () => clearTimeout(t);
  }, [status]);

  if (status === 'won') {
    return (
      <div
        className="overlay overlay-win absolute inset-0 z-40 grid place-items-center rounded-[inherit] p-5 text-center"
        style={{ ['--overlay-delay' as string]: '650ms' }}
        role="dialog"
        aria-labelledby={titleId}
        data-no-swipe
      >
        <div className="overlay-card max-w-xs">
          <div className="trophy-shine mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-[#edc22e] text-white shadow-[0_10px_30px_-8px_rgb(237_194_46/0.9)]">
            <Trophy size={34} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-[1.75rem] leading-tight font-black tracking-tight sm:text-3xl">
            You reached 2048!
          </h2>
          <p className="mt-2 text-[0.95rem] text-muted">
            Brilliant merging. The board is yours — how far can you push it? 4096 is waiting.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button ref={primary} type="button" className="btn btn-primary" onClick={onKeepPlaying}>
              Keep Playing
            </button>
            <button type="button" className="btn btn-secondary" onClick={onNewGame}>
              New Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'over') {
    return (
      <div
        className="overlay absolute inset-0 z-40 grid place-items-center rounded-[inherit] p-5 text-center"
        style={{ ['--overlay-delay' as string]: '550ms' }}
        role="dialog"
        aria-labelledby={titleId}
        data-no-swipe
      >
        <div className="overlay-card w-full max-w-xs">
          <h2 id={titleId} className="text-[1.75rem] leading-tight font-black tracking-tight sm:text-3xl">
            No more moves!
          </h2>
          {isNewBest && (
            <p className="mt-1 text-sm font-bold text-accent dark:text-[#f59563]">New best score — nicely done.</p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-card px-2 py-2">
              <dt className="text-[0.65rem] font-bold tracking-[0.14em] text-card-label uppercase">Score</dt>
              <dd className="text-xl font-extrabold text-card-value tabular-nums">{formatScore(score)}</dd>
            </div>
            <div className="rounded-xl bg-card px-2 py-2">
              <dt className="text-[0.65rem] font-bold tracking-[0.14em] text-card-label uppercase">Best</dt>
              <dd className="text-xl font-extrabold text-card-value tabular-nums">{formatScore(best)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-col gap-2">
            <button ref={primary} type="button" className="btn btn-primary" onClick={onNewGame}>
              Try Again
            </button>
            <div className="flex gap-2">
              {canUndo && (
                <button type="button" className="btn btn-secondary flex-1" onClick={onUndo}>
                  Undo move
                </button>
              )}
              <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
