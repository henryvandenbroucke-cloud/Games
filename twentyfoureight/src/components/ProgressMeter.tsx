import { WIN_VALUE } from '../game/constants';
import { valueClass } from './Tile';

/** Compact "highest tile → goal" meter: one segment per doubling. */
export function ProgressMeter({ highest }: { highest: number }) {
  const goal = highest >= WIN_VALUE ? highest * 2 : WIN_VALUE;
  const steps = Math.log2(goal); // 2048 → 11 segments (2 … 2048)
  const reached = highest ? Math.log2(highest) : 0;
  const remaining = Math.max(0, Math.round(steps - reached));

  return (
    <div className="w-full" aria-label={`Highest tile ${highest}. Goal ${goal}.`} role="img">
      <div className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-muted">
        <span>
          Highest tile <span className="font-extrabold text-text tabular-nums">{highest || '—'}</span>
        </span>
        <span>
          {remaining === 1 ? 'One merge from ' : `${remaining} doublings to `}
          <span className="font-extrabold text-text tabular-nums">{goal}</span>
        </span>
      </div>
      <div className="flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => {
          const value = 2 ** (i + 1);
          const filled = i < reached;
          return (
            <div key={value} className="h-2 flex-1 overflow-hidden rounded-full bg-cell/70">
              <div
                className={`progress-fill tile-inner h-full !rounded-none !shadow-none ${valueClass(value)}`}
                style={{ width: filled ? '100%' : '0%' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
