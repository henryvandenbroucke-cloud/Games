import { BOARD_SIZE, SPAWN_TWO_PROBABILITY, START_TILES, WIN_VALUE } from './constants';
import { nextInt, nextRandom } from './random';
import type {
  Direction,
  GameState,
  Grid,
  MoveOutcome,
  TileData,
  TileMerge,
  TileMovement,
  ValueBoard,
} from './types';

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

export function emptyGrid(): Grid {
  return Array.from({ length: BOARD_SIZE }, () => Array<TileData | null>(BOARD_SIZE).fill(null));
}

export function toGrid(tiles: readonly TileData[]): Grid {
  const grid = emptyGrid();
  for (const tile of tiles) grid[tile.row][tile.col] = tile;
  return grid;
}

export function toValueBoard(tiles: readonly TileData[]): ValueBoard {
  return toGrid(tiles).map((row) => row.map((tile) => tile?.value ?? 0));
}

/** Build tiles from a value board (0 = empty). Ids are assigned row-major from `firstId`. */
export function tilesFromValueBoard(board: ValueBoard, firstId = 1): TileData[] {
  const tiles: TileData[] = [];
  let id = firstId;
  board.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value) tiles.push({ id: id++, value, row: r, col: c });
    }),
  );
  return tiles;
}

export function emptyCells(tiles: readonly TileData[]): Array<[number, number]> {
  const grid = toGrid(tiles);
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) if (!grid[r][c]) cells.push([r, c]);
  }
  return cells;
}

export function maxTile(tiles: readonly TileData[]): number {
  return tiles.reduce((max, t) => (t.value > max ? t.value : max), 0);
}

// ---------------------------------------------------------------------------
// Line collapsing — the heart of the rules
// ---------------------------------------------------------------------------

interface CollapsedLine {
  /** Resulting tiles in movement order (index 0 is the edge tiles move toward). */
  tiles: TileData[];
  /** Merge info; `index` is the position in `tiles` of the merge result. */
  merges: Array<{ sources: [TileData, TileData]; index: number }>;
  scoreGain: number;
  nextId: number;
}

/**
 * Collapse one line toward index 0. Each tile merges at most once, and merges
 * resolve from the leading edge: [2,2,2,_] → [4,2,_,_], [4,4,8,_] → [8,8,_,_].
 */
function collapseLine(cells: ReadonlyArray<TileData | null>, nextId: number): CollapsedLine {
  const present = cells.filter((cell): cell is TileData => cell !== null);
  const tiles: TileData[] = [];
  const merges: CollapsedLine['merges'] = [];
  let scoreGain = 0;

  for (let i = 0; i < present.length; i++) {
    const current = present[i];
    const following = present[i + 1];
    if (following && following.value === current.value) {
      const value = current.value * 2;
      merges.push({ sources: [current, following], index: tiles.length });
      tiles.push({ id: nextId++, value, row: -1, col: -1 });
      scoreGain += value;
      i++; // the following tile is consumed by this merge
    } else {
      tiles.push(current);
    }
  }
  return { tiles, merges, scoreGain, nextId };
}

/** Value-only line merge, e.g. mergeLine([2,2,2,0]) → { line: [4,2,0,0], scoreGain: 4 }. */
export function mergeLine(line: readonly number[]): { line: number[]; scoreGain: number } {
  const cells = line.map((value, i) => (value ? { id: i + 1, value, row: 0, col: i } : null));
  const { tiles, scoreGain } = collapseLine(cells, 1000);
  const out = tiles.map((t) => t.value);
  while (out.length < line.length) out.push(0);
  return { line: out, scoreGain };
}

export function calculateScoreGain(merges: ReadonlyArray<{ result: { value: number } }>): number {
  return merges.reduce((sum, m) => sum + m.result.value, 0);
}

/** Map (line, offset-from-leading-edge) to grid coordinates for a direction. */
function cellFor(direction: Direction, line: number, offset: number): [number, number] {
  const last = BOARD_SIZE - 1;
  switch (direction) {
    case 'left':
      return [line, offset];
    case 'right':
      return [line, last - offset];
    case 'up':
      return [offset, line];
    case 'down':
      return [last - offset, line];
  }
}

export interface SlideResult {
  tiles: TileData[];
  movements: TileMovement[];
  merges: TileMerge[];
  scoreGain: number;
  nextId: number;
  changed: boolean;
}

/** Slide every tile in `direction` (no spawning). Pure. */
export function slideTiles(tiles: readonly TileData[], direction: Direction, nextId: number): SlideResult {
  const grid = toGrid(tiles);
  const out: TileData[] = [];
  const movements: TileMovement[] = [];
  const merges: TileMerge[] = [];
  let scoreGain = 0;
  let id = nextId;

  for (let line = 0; line < BOARD_SIZE; line++) {
    const cells: Array<TileData | null> = [];
    for (let offset = 0; offset < BOARD_SIZE; offset++) {
      const [r, c] = cellFor(direction, line, offset);
      cells.push(grid[r][c]);
    }
    const collapsed = collapseLine(cells, id);
    id = collapsed.nextId;
    scoreGain += collapsed.scoreGain;

    const mergeAt = new Map(collapsed.merges.map((m) => [m.index, m.sources]));
    collapsed.tiles.forEach((tile, offset) => {
      const [row, col] = cellFor(direction, line, offset);
      const placed: TileData = { ...tile, row, col };
      out.push(placed);
      const sources = mergeAt.get(offset);
      if (sources) {
        merges.push({
          sources: [
            { ...sources[0], row, col },
            { ...sources[1], row, col },
          ],
          result: placed,
        });
        for (const s of sources) {
          movements.push({ id: s.id, fromRow: s.row, fromCol: s.col, toRow: row, toCol: col });
        }
      } else if (tile.row !== row || tile.col !== col) {
        movements.push({ id: tile.id, fromRow: tile.row, fromCol: tile.col, toRow: row, toCol: col });
      }
    });
  }

  const changed = movements.length > 0 || merges.length > 0;
  return { tiles: changed ? out : [...tiles], movements, merges, scoreGain, nextId: id, changed };
}

/** Value-board convenience wrapper around slideTiles (no spawning). */
export function moveBoard(board: ValueBoard, direction: Direction): { board: ValueBoard; scoreGain: number; changed: boolean } {
  const result = slideTiles(tilesFromValueBoard(board), direction, 10_000);
  return { board: toValueBoard(result.tiles), scoreGain: result.scoreGain, changed: result.changed };
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

export interface SpawnResult {
  tile: TileData | null;
  rng: number;
}

/** Spawn a 2 (90%) or 4 (10%) in a random empty cell, using the injectable PRNG state. */
export function spawnTile(tiles: readonly TileData[], rng: number, id: number): SpawnResult {
  const cells = emptyCells(tiles);
  if (cells.length === 0) return { tile: null, rng };
  const pick = nextInt(rng, cells.length);
  const roll = nextRandom(pick.state);
  const [row, col] = cells[pick.value];
  const value = roll.value < SPAWN_TWO_PROBABILITY ? 2 : 4;
  return { tile: { id, value, row, col }, rng: roll.state };
}

// ---------------------------------------------------------------------------
// Win / lose
// ---------------------------------------------------------------------------

export function canMove(tiles: readonly TileData[]): boolean {
  if (tiles.length < BOARD_SIZE * BOARD_SIZE) return true;
  const grid = toGrid(tiles);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = grid[r][c]?.value;
      if (v === undefined) return true;
      if (c + 1 < BOARD_SIZE && grid[r][c + 1]?.value === v) return true;
      if (r + 1 < BOARD_SIZE && grid[r + 1][c]?.value === v) return true;
    }
  }
  return false;
}

export function hasWon(tiles: readonly TileData[]): boolean {
  return tiles.some((t) => t.value >= WIN_VALUE);
}

export function isGameOver(tiles: readonly TileData[]): boolean {
  return !canMove(tiles);
}

// ---------------------------------------------------------------------------
// Game state transitions
// ---------------------------------------------------------------------------

export function createInitialState(seed: number): GameState {
  let tiles: TileData[] = [];
  let rng = seed >>> 0;
  let nextId = 1;
  for (let i = 0; i < START_TILES; i++) {
    const spawn = spawnTile(tiles, rng, nextId);
    rng = spawn.rng;
    if (spawn.tile) {
      tiles = [...tiles, spawn.tile];
      nextId++;
    }
  }
  return { tiles, score: 0, moves: 0, status: 'playing', wonAcknowledged: false, rng, nextId };
}

/** Alias matching the conventional name. */
export const createInitialBoard = createInitialState;

/**
 * Apply a move. Returns null for an invalid move (nothing slides or merges, or
 * the game is not in the playing state) — the caller must then leave every
 * piece of state untouched, including the PRNG.
 */
export function applyMove(state: GameState, direction: Direction): MoveOutcome | null {
  if (state.status !== 'playing') return null;
  const slide = slideTiles(state.tiles, direction, state.nextId);
  if (!slide.changed) return null;

  const spawn = spawnTile(slide.tiles, state.rng, slide.nextId);
  const tiles = spawn.tile ? [...slide.tiles, spawn.tile] : slide.tiles;
  const nextId = spawn.tile ? slide.nextId + 1 : slide.nextId;

  const reachedWin = !state.wonAcknowledged && hasWon(tiles);
  const causedGameOver = !reachedWin && isGameOver(tiles);

  const next: GameState = {
    tiles,
    score: state.score + slide.scoreGain,
    moves: state.moves + 1,
    status: reachedWin ? 'won' : causedGameOver ? 'over' : 'playing',
    wonAcknowledged: state.wonAcknowledged,
    rng: spawn.rng,
    nextId,
  };

  return {
    state: next,
    events: {
      direction,
      movements: slide.movements,
      merges: slide.merges,
      spawned: spawn.tile,
      scoreGain: slide.scoreGain,
      highestMerge: slide.merges.reduce((max, m) => Math.max(max, m.result.value), 0),
      reachedWin,
      causedGameOver,
    },
  };
}

/** Dismiss the victory overlay and continue. The overlay never returns this game. */
export function keepPlaying(state: GameState): GameState {
  if (state.status !== 'won') return state;
  return {
    ...state,
    wonAcknowledged: true,
    status: isGameOver(state.tiles) ? 'over' : 'playing',
  };
}
