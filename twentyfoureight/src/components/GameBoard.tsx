import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { BOARD_SIZE, WIN_VALUE } from '../game/constants';
import { toValueBoard } from '../game/engine';
import type { Session } from '../game/session';
import type { Direction, TileData } from '../game/types';
import type { Callout } from '../hooks/useGame';
import { useSwipe } from '../hooks/useSwipe';
import { Tile, type TileKind } from './Tile';

interface RenderTile {
  key: string;
  tile: TileData;
  kind: TileKind;
  milestone: boolean;
  win: boolean;
}

/** Turn the model + last-move metadata into a stable, animation-ready tile list. */
function buildRenderList(session: Session): RenderTile[] {
  const { game, lastMove, lastAction, epoch } = session;
  const intro = lastAction === 'init' || lastAction === 'new-game';
  const merged = new Set(lastMove?.merges.map((m) => m.result.id));
  const list: RenderTile[] = [];

  for (const m of lastMove?.merges ?? []) {
    for (const source of m.sources) {
      list.push({ key: `${epoch}-${source.id}`, tile: source, kind: 'ghost', milestone: false, win: false });
    }
  }
  for (const tile of game.tiles) {
    const isMerged = merged.has(tile.id);
    const kind: TileKind = intro || lastMove?.spawned?.id === tile.id ? 'new' : isMerged ? 'merged' : 'idle';
    list.push({
      key: `${epoch}-${tile.id}`,
      tile,
      kind,
      milestone: isMerged && tile.value >= 128,
      win: isMerged && tile.value === WIN_VALUE && lastMove?.reachedWin === true,
    });
  }
  // Stable DOM order (by id) so React never re-inserts a node mid-transition.
  return list.sort((a, b) => a.tile.id - b.tile.id);
}

const CONFETTI_COLORS = ['#edc22e', '#f65e3b', '#f59563', '#edcf72', '#8f6fd3', '#34b3a3', '#ffffff'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const angle = (i / 34) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 90 + Math.random() * 140;
        return {
          '--tx': `${Math.cos(angle) * dist}px`,
          '--ty': `${Math.sin(angle) * dist - 40}px`,
          '--r': `${Math.random() * 720 - 360}deg`,
          '--d': `${Math.random() * 120}ms`,
          '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        } as CSSProperties;
      }),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden="true">
      {pieces.map((style, i) => (
        <span key={i} className="confetti" style={style} />
      ))}
    </div>
  );
}

const CALLOUT_STYLES: Record<Callout['kind'], string> = {
  chain: 'bg-white text-[#504a43]',
  milestone: 'bg-[#edc22e] text-white [text-shadow:0_1px_2px_rgb(120_80_0/0.35)]',
  record: 'bg-[#8f6fd3] text-white',
  best: 'bg-accent text-accent-text',
};

interface GameBoardProps {
  session: Session;
  onMove: (direction: Direction) => void;
  inputEnabled: boolean;
  callout: Callout | null;
  children?: ReactNode;
}

export function GameBoard({ session, onMove, inputEnabled, callout, children }: GameBoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipe(ref, onMove, inputEnabled);
  const tiles = useMemo(() => buildRenderList(session), [session]);
  const values = useMemo(() => toValueBoard(session.game.tiles), [session.game.tiles]);

  return (
    <div
      ref={ref}
      className="board"
      role="group"
      aria-label="Game board"
      aria-describedby="board-help"
      data-testid="board"
    >
      <div className="board-grid" aria-hidden="true">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => (
          <div key={i} className="board-cell" />
        ))}
      </div>

      <div className="tile-layer">
        {tiles.map((t) => (
          <Tile key={t.key} tile={t.tile} kind={t.kind} milestone={t.milestone} win={t.win} />
        ))}
      </div>

      {/* Screen-reader view of the board (not live — explore on demand). */}
      <table className="sr-only">
        <caption>Board</caption>
        <tbody>
          {values.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={c}>{v || 'empty'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {callout && (
        <div
          key={callout.id}
          className={`callout pointer-events-none absolute top-[14%] left-1/2 z-30 rounded-full px-4 py-1.5 text-sm font-extrabold tracking-tight whitespace-nowrap shadow-lg sm:text-base ${CALLOUT_STYLES[callout.kind]}`}
          aria-hidden="true"
        >
          {callout.text}
        </div>
      )}

      {session.lastMove?.reachedWin && <Confetti key={session.revision} />}
      {children}
    </div>
  );
}
