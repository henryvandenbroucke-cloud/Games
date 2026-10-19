import { ChartColumn, RotateCcw, Settings, Undo2, Volume2, VolumeX } from 'lucide-react';

interface GameControlsProps {
  canUndo: boolean;
  soundOn: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onToggleSound: () => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
}

export function GameControls({ canUndo, soundOn, onNewGame, onUndo, onToggleSound, onOpenStats, onOpenSettings }: GameControlsProps) {
  return (
    <nav className="flex items-center gap-1.5 min-[400px]:gap-2" aria-label="Game controls">
      <button type="button" className="btn btn-primary min-w-0 flex-1 px-2" onClick={onNewGame}>
        <RotateCcw size={18} strokeWidth={2.5} aria-hidden="true" />
        <span className="min-[440px]:hidden">New</span>
        <span className="hidden min-[440px]:inline">New Game</span>
      </button>
      <button
        type="button"
        className="btn btn-secondary min-w-0 flex-1 px-2"
        onClick={onUndo}
        disabled={!canUndo}
        aria-keyshortcuts="U Control+Z"
      >
        <Undo2 size={18} strokeWidth={2.5} aria-hidden="true" />
        Undo
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onToggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Mute sound' : 'Turn sound on'}
        title={soundOn ? 'Mute sound' : 'Turn sound on'}
      >
        {soundOn ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
      </button>
      {/* On very narrow phones the Best card doubles as the stats button. */}
      <button type="button" className="icon-btn hidden min-[360px]:grid" onClick={onOpenStats} aria-label="Statistics" title="Statistics">
        <ChartColumn size={20} aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings">
        <Settings size={20} aria-hidden="true" />
      </button>
    </nav>
  );
}
