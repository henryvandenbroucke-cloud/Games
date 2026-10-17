import type { Stats } from '../game/storage';
import { formatScore } from './ScoreCard';
import { valueClass } from './Tile';
import { Modal } from './Modal';

interface StatsDialogProps {
  open: boolean;
  stats: Stats;
  best: number;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-3 text-center">
      <div className="text-xl font-extrabold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[0.7rem] font-semibold tracking-wider text-muted uppercase">{label}</div>
    </div>
  );
}

export function StatsDialog({ open, stats, best, onClose }: StatsDialogProps) {
  // Games restored from before stats existed may have wins without a counted start.
  const games = Math.max(stats.gamesPlayed, stats.gamesWon);
  const winRate = games ? Math.round((stats.gamesWon / games) * 100) : 0;
  const top = stats.highestTile;
  return (
    <Modal open={open} onClose={onClose} title="Your progress">
      <div className="mb-4 flex items-center gap-4 rounded-2xl bg-surface-2 p-3">
        <div className="size-16 shrink-0" data-digits={Math.min(String(top || 2).length, 6)}>
          <div className={`tile-inner ${valueClass(top || 2)} ${top ? '' : 'opacity-40'}`}>
            <span className="tile-label">{top || '—'}</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-muted">Highest tile ever</div>
          <div className="text-[0.95rem] leading-snug">
            {top >= 2048
              ? 'Legendary. Every doubling from here is uncharted.'
              : top
                ? `${Math.round(Math.log2(2048 / top))} more doubling${top === 1024 ? '' : 's'} to the 2048 tile.`
                : 'Play a game to set your first record.'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Best score" value={formatScore(best)} />
        <Stat label="Games" value={games.toLocaleString('en-US')} />
        <Stat label="2048 wins" value={stats.gamesWon.toLocaleString('en-US')} />
        <Stat label="Win rate" value={`${winRate}%`} />
        <Stat label="Merges" value={formatScore(stats.totalMerges)} />
        <Stat label="Moves" value={formatScore(stats.totalMoves)} />
      </div>
    </Modal>
  );
}
