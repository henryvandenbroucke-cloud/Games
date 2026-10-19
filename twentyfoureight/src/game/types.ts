export type Direction = 'up' | 'down' | 'left' | 'right';

/** A numbered tile with a stable identity, used to drive animations. */
export interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
}

/** 4×4 grid of tiles (or null for empty cells), indexed as grid[row][col]. */
export type Grid = (TileData | null)[][];

/** Plain value grid (0 = empty), handy for tests and debugging. */
export type ValueBoard = number[][];

export type GameStatus = 'playing' | 'won' | 'over';

export interface GameState {
  tiles: TileData[];
  score: number;
  /** Number of valid moves made in this game. */
  moves: number;
  status: GameStatus;
  /** True once the player chose "Keep Playing" — the victory overlay never returns this game. */
  wonAcknowledged: boolean;
  /** Seeded PRNG state (uint32). Part of the snapshot so undo cannot reroll spawns. */
  rng: number;
  /** Next tile id to hand out. */
  nextId: number;
}

export interface TileMovement {
  id: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface TileMerge {
  /** Ids of the two source tiles that collided. */
  sources: [TileData, TileData];
  /** The resulting tile (new id). */
  result: TileData;
}

/** Everything the presentation layer needs to animate one move. */
export interface MoveEvents {
  direction: Direction;
  movements: TileMovement[];
  merges: TileMerge[];
  spawned: TileData | null;
  scoreGain: number;
  /** Highest value created by a merge in this move (0 if none). */
  highestMerge: number;
  /** True if this move created the first 2048 of the game. */
  reachedWin: boolean;
  /** True if this move left the board with no possible moves. */
  causedGameOver: boolean;
}

export interface MoveOutcome {
  state: GameState;
  events: MoveEvents;
}
