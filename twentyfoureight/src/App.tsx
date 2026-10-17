import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { GameBoard } from './components/GameBoard';
import { GameControls } from './components/GameControls';
import { GameOverlay } from './components/GameOverlay';
import { ConfirmDialog } from './components/Modal';
import { ProgressMeter } from './components/ProgressMeter';
import { ScoreCard } from './components/ScoreCard';
import { SettingsDialog } from './components/SettingsDialog';
import { StatsDialog } from './components/StatsDialog';
import { maxTile } from './game/engine';
import { getBrowserStore } from './game/storage';
import { useGame } from './hooks/useGame';
import { useKeyboard } from './hooks/useKeyboard';
import { useSettings } from './hooks/useSettings';
import { sound } from './lib/audio';

type DialogName = 'none' | 'confirm-new' | 'settings' | 'stats' | 'confirm-reset-best';

export default function App() {
  const store = useMemo(getBrowserStore, []);
  const { settings, update } = useSettings(store);
  const game = useGame(store, settings);
  const { session } = game;
  const { status, score } = session.game;

  const [dialog, setDialog] = useState<DialogName>('none');
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  useEffect(() => setOverlayDismissed(false), [status, session.epoch]);

  const closeDialog = useCallback(() => setDialog('none'), []);
  const playing = status === 'playing';
  const inputEnabled = dialog === 'none' && playing;

  const startNewGame = useCallback(() => {
    setDialog('none');
    game.newGame();
  }, [game]);

  const requestNewGame = useCallback(() => {
    // Only ask when there's real progress to lose.
    if (score > 0 && status !== 'over') setDialog('confirm-new');
    else startNewGame();
  }, [score, status, startNewGame]);

  useKeyboard({ enabled: dialog === 'none', onMove: game.move, onUndo: game.undo });

  const onClickCapture = (e: MouseEvent) => {
    if (settings.sound && (e.target as HTMLElement).closest('button:not(:disabled)')) sound.tap();
  };

  const highest = maxTile(session.game.tiles);
  const lastGain = session.lastAction === 'move' ? (session.lastMove?.scoreGain ?? 0) : 0;
  const showOverlay = (status === 'won' || status === 'over') && !overlayDismissed;

  return (
    <div className="flex min-h-svh justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-8">
      <main className="app-col flex flex-col gap-3 sm:gap-4" onClickCapture={onClickCapture}>
        <header className="flex items-stretch gap-2">
          <h1 className="m-0 shrink-0">
            <span className="logo-tile v-2048 grid place-items-center" aria-label="2048">
              <span aria-hidden="true">2048</span>
            </span>
          </h1>
          <ScoreCard label="Score" value={score} delta={lastGain} deltaKey={session.revision} />
          <ScoreCard
            label="Best"
            value={session.best}
            highlight={score > 0 && score >= session.best}
            onClick={() => setDialog('stats')}
            clickLabel={`Best score ${session.best}. Open statistics`}
          />
        </header>

        <p className="-mt-0.5 text-[0.95rem] font-semibold tracking-tight text-muted">
          Merge. Think. <span className="text-text">Reach 2048.</span>
        </p>

        <GameControls
          canUndo={game.canUndo && dialog === 'none'}
          soundOn={settings.sound}
          onNewGame={requestNewGame}
          onUndo={game.undo}
          onToggleSound={() => update({ sound: !settings.sound })}
          onOpenStats={() => setDialog('stats')}
          onOpenSettings={() => setDialog('settings')}
        />

        <GameBoard session={session} onMove={game.move} inputEnabled={inputEnabled} callout={game.callout}>
          {showOverlay && (
            <GameOverlay
              status={status}
              score={score}
              best={session.best}
              isNewBest={score > 0 && score >= session.best}
              canUndo={game.canUndo}
              onKeepPlaying={game.keepPlaying}
              onNewGame={startNewGame}
              onUndo={game.undo}
              onClose={() => setOverlayDismissed(true)}
            />
          )}
        </GameBoard>

        <ProgressMeter highest={highest} />

        <p id="board-help" className="text-center text-sm text-muted">
          {status === 'over' ? (
            <>
              No more moves.{' '}
              <button type="button" className="font-bold text-accent underline underline-offset-2 dark:text-[#f59563]" onClick={startNewGame}>
                Play again
              </button>
            </>
          ) : (
            <>
              <span className="pointer-coarse:inline hidden">Swipe</span>
              <span className="pointer-coarse:hidden">Swipe or use arrow keys</span> to move tiles. Merge matching numbers to
              reach 2048.
            </>
          )}
        </p>
      </main>

      <div className="sr-only" role="status" aria-live="polite">
        {game.announcement}
      </div>

      <ConfirmDialog
        open={dialog === 'confirm-new'}
        title="Start a new game?"
        message={`Your current game (${score.toLocaleString('en-US')} points) will be lost.`}
        confirmLabel="Restart Game"
        onConfirm={startNewGame}
        onCancel={closeDialog}
      />
      <ConfirmDialog
        open={dialog === 'confirm-reset-best'}
        title="Reset best score?"
        message="Your best score will be set back to your current score. This can't be undone."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          game.resetBest();
          setDialog('settings');
        }}
        onCancel={() => setDialog('settings')}
      />
      <SettingsDialog
        open={dialog === 'settings'}
        settings={settings}
        best={session.best}
        onChange={update}
        onResetBest={() => setDialog('confirm-reset-best')}
        onClose={closeDialog}
      />
      <StatsDialog open={dialog === 'stats'} stats={game.stats} best={session.best} onClose={closeDialog} />
    </div>
  );
}
