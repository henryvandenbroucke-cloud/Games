import { describe, expect, it } from 'vitest';
import {
  applyMove,
  calculateScoreGain,
  canMove,
  createInitialState,
  emptyCells,
  hasWon,
  isGameOver,
  keepPlaying,
  mergeLine,
  moveBoard,
  slideTiles,
  spawnTile,
  tilesFromValueBoard,
  toValueBoard,
} from '../game/engine';
import { nextRandom } from '../game/random';
import { canUndo, createSession, sessionReducer } from '../game/session';
import type { GameState, ValueBoard } from '../game/types';

function stateFrom(board: ValueBoard, overrides: Partial<GameState> = {}): GameState {
  const tiles = tilesFromValueBoard(board);
  return {
    tiles,
    score: 0,
    moves: 0,
    status: 'playing',
    wonAcknowledged: false,
    rng: 12345,
    nextId: tiles.length + 1,
    ...overrides,
  };
}

/** A full board with no equal neighbours. */
const DEAD_BOARD: ValueBoard = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 2],
];

describe('starting a game', () => {
  it('creates a valid 4×4 board', () => {
    const board = toValueBoard(createInitialState(1).tiles);
    expect(board).toHaveLength(4);
    for (const row of board) expect(row).toHaveLength(4);
  });

  it('spawns exactly two tiles, each a 2 or 4, in distinct cells', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { tiles } = createInitialState(seed * 7919);
      expect(tiles).toHaveLength(2);
      for (const t of tiles) expect([2, 4]).toContain(t.value);
      expect(`${tiles[0].row},${tiles[0].col}`).not.toBe(`${tiles[1].row},${tiles[1].col}`);
      expect(new Set(tiles.map((t) => t.id)).size).toBe(2);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(createInitialState(42)).toEqual(createInitialState(42));
  });

  it('spawns 2s roughly 90% of the time', () => {
    let twos = 0;
    let total = 0;
    let rng = 99;
    for (let i = 0; i < 5000; i++) {
      const spawn = spawnTile([], rng, 1);
      rng = spawn.rng;
      total++;
      if (spawn.tile!.value === 2) twos++;
    }
    expect(twos / total).toBeGreaterThan(0.87);
    expect(twos / total).toBeLessThan(0.93);
  });
});

describe('mergeLine', () => {
  it.each([
    [[2, 2, 2, 0], [4, 2, 0, 0], 4],
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[4, 4, 8, 0], [8, 8, 0, 0], 8],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
    [[2, 0, 2, 0], [4, 0, 0, 0], 4],
    [[2, 4, 8, 16], [2, 4, 8, 16], 0],
    [[8, 8, 16, 16], [16, 32, 0, 0], 48],
    [[0, 4, 4, 4], [8, 4, 0, 0], 8],
    [[1024, 1024, 0, 0], [2048, 0, 0, 0], 2048],
  ])('%j → %j (+%i)', (input, expected, gain) => {
    expect(mergeLine(input)).toEqual({ line: expected, scoreGain: gain });
  });

  it('never merges different tiles', () => {
    expect(mergeLine([2, 4, 2, 4]).line).toEqual([2, 4, 2, 4]);
    expect(mergeLine([2, 0, 4, 0]).line).toEqual([2, 4, 0, 0]);
  });
});

describe('moveBoard in every direction', () => {
  const board: ValueBoard = [
    [2, 2, 0, 4],
    [0, 0, 0, 0],
    [4, 0, 4, 8],
    [0, 2, 0, 2],
  ];

  it('slides left', () => {
    expect(moveBoard(board, 'left').board).toEqual([
      [4, 4, 0, 0],
      [0, 0, 0, 0],
      [8, 8, 0, 0],
      [4, 0, 0, 0],
    ]);
  });

  it('slides right', () => {
    expect(moveBoard(board, 'right').board).toEqual([
      [0, 0, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 8, 8],
      [0, 0, 0, 4],
    ]);
  });

  it('slides up', () => {
    expect(moveBoard(board, 'up').board).toEqual([
      [2, 4, 4, 4],
      [4, 0, 0, 8],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
    ]);
  });

  it('slides down', () => {
    expect(moveBoard(board, 'down').board).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 4],
      [2, 0, 0, 8],
      [4, 4, 4, 2],
    ]);
  });

  it('resolves merges in the direction of movement', () => {
    const col: ValueBoard = [[2], [2], [2], [0]].map((r) => [...r, 0, 0, 0]);
    expect(moveBoard(col, 'up').board.map((r) => r[0])).toEqual([4, 2, 0, 0]);
    expect(moveBoard(col, 'down').board.map((r) => r[0])).toEqual([0, 0, 2, 4]);
    expect(moveBoard([[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right').board[0]).toEqual([0, 0, 2, 4]);
  });

  it('reports no change when nothing can slide', () => {
    expect(moveBoard(DEAD_BOARD, 'left').changed).toBe(false);
    expect(moveBoard([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left').changed).toBe(false);
  });
});

describe('merging and scoring', () => {
  it('lets a tile merge at most once per move', () => {
    const result = moveBoard([[4, 4, 8, 0], [2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0]], 'left');
    expect(result.board[0]).toEqual([8, 8, 0, 0]);
    expect(result.board[1]).toEqual([4, 4, 0, 0]);
  });

  it('accumulates score across independent merges', () => {
    const result = moveBoard(
      [
        [8, 8, 0, 0],
        [2, 2, 4, 4],
        [0, 0, 0, 0],
        [16, 0, 16, 0],
      ],
      'left',
    );
    expect(result.scoreGain).toBe(16 + 4 + 8 + 32);
  });

  it('calculateScoreGain sums merge results', () => {
    const slide = slideTiles(tilesFromValueBoard([[2, 2, 8, 8], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', 100);
    expect(calculateScoreGain(slide.merges)).toBe(20);
    expect(slide.merges).toHaveLength(2);
  });

  it('tracks tile identity: merged tiles get a new id, movers keep theirs', () => {
    const tiles = tilesFromValueBoard([[0, 2, 0, 2], [0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const slide = slideTiles(tiles, 'left', 50);
    const merged = slide.tiles.find((t) => t.value === 4 && t.row === 0)!;
    expect(merged.id).toBe(50);
    const four = slide.tiles.find((t) => t.row === 1)!;
    expect(four.id).toBe(tiles[2].id);
    expect(four.col).toBe(0);
    expect(slide.merges[0].sources.map((s) => s.id)).toEqual([tiles[0].id, tiles[1].id]);
  });

  it('adds merge gains to the game score', () => {
    const outcome = applyMove(stateFrom([[8, 8, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { score: 10 }), 'left');
    expect(outcome!.state.score).toBe(26);
    expect(outcome!.events.scoreGain).toBe(16);
  });
});

describe('spawning after moves', () => {
  it('invalid moves do not spawn, score, or advance the PRNG', () => {
    const state = stateFrom([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(applyMove(state, 'left')).toBeNull();
    expect(applyMove(state, 'up')).toBeNull();
    const session = createSession(state);
    expect(sessionReducer(session, { type: 'move', direction: 'left' })).toBe(session);
  });

  it('valid moves spawn exactly one new tile in an empty cell', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = stateFrom([[2, 0, 0, 2], [0, 4, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0]], { rng: seed });
      const outcome = applyMove(state, 'right')!;
      const slid = moveBoard(toValueBoard(state.tiles), 'right').board;
      const after = toValueBoard(outcome.state.tiles);
      const diffs: Array<[number, number]> = [];
      after.forEach((row, r) => row.forEach((v, c) => v !== slid[r][c] && diffs.push([r, c])));
      expect(diffs).toHaveLength(1);
      const [r, c] = diffs[0];
      expect(slid[r][c]).toBe(0);
      expect([2, 4]).toContain(after[r][c]);
      expect(outcome.events.spawned).toMatchObject({ row: r, col: c });
      expect(outcome.state.tiles.length).toBe(state.tiles.length - 1 + 1);
    }
  });

  it('only spawns into empty cells', () => {
    const tiles = tilesFromValueBoard([[2, 4, 8, 16], [32, 64, 128, 256], [2, 4, 8, 16], [32, 64, 128, 0]]);
    for (let rng = 0; rng < 50; rng++) {
      const spawn = spawnTile(tiles, rng, 99);
      expect(spawn.tile).toMatchObject({ row: 3, col: 3 });
    }
    expect(spawnTile(tilesFromValueBoard(DEAD_BOARD), 1, 99).tile).toBeNull();
    expect(emptyCells(tiles)).toEqual([[3, 3]]);
  });

  it('spawns deterministically from the PRNG state', () => {
    const state = stateFrom([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { rng: 777 });
    expect(applyMove(state, 'left')).toEqual(applyMove(state, 'left'));
    expect(applyMove(state, 'left')!.state.rng).not.toBe(777);
  });
});

describe('winning', () => {
  it('detects 2048', () => {
    expect(hasWon(tilesFromValueBoard([[2048, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]))).toBe(true);
    expect(hasWon(tilesFromValueBoard([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]))).toBe(false);
  });

  it('enters the won state when 2048 is created', () => {
    const outcome = applyMove(stateFrom([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left')!;
    expect(outcome.state.status).toBe('won');
    expect(outcome.events.reachedWin).toBe(true);
    // Moves are blocked until the player chooses.
    expect(applyMove(outcome.state, 'right')).toBeNull();
  });

  it('keep playing acknowledges the win and the overlay never returns', () => {
    const won = applyMove(stateFrom([[1024, 1024, 0, 0], [1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left')!.state;
    expect(won.status).toBe('won');
    const continued = keepPlaying(won);
    expect(continued.status).toBe('playing');
    expect(continued.wonAcknowledged).toBe(true);
    // Making another 2048-or-higher tile must not trigger the victory state again.
    const next = applyMove(continued, 'up')!;
    expect(next.state.tiles.some((t) => t.value === 4096)).toBe(true);
    expect(next.state.status).toBe('playing');
    expect(next.events.reachedWin).toBe(false);
  });

  it('undo after continuing does not resurrect the victory overlay', () => {
    let session = createSession(stateFrom([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]));
    session = sessionReducer(session, { type: 'move', direction: 'left' });
    expect(session.game.status).toBe('won');
    expect(canUndo(session)).toBe(false);
    session = sessionReducer(session, { type: 'keep-playing' });
    session = sessionReducer(session, { type: 'move', direction: 'right' });
    session = sessionReducer(session, { type: 'undo' });
    expect(session.game.wonAcknowledged).toBe(true);
  });
});

describe('game over', () => {
  it('triggers when no valid moves remain', () => {
    expect(isGameOver(tilesFromValueBoard(DEAD_BOARD))).toBe(true);
    const state = stateFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 8, 8],
    ]);
    // Merging 8+8 → 16 frees one cell; whatever spawns, check consistency with canMove.
    const outcome = applyMove(state, 'left')!;
    expect(outcome.state.status).toBe(canMove(outcome.state.tiles) ? 'playing' : 'over');
    expect(outcome.events.causedGameOver).toBe(outcome.state.status === 'over');
  });

  it('a full board with adjacent equal tiles is not game over', () => {
    const horizontal = DEAD_BOARD.map((r) => [...r]);
    horizontal[0][1] = 2;
    expect(isGameOver(tilesFromValueBoard(horizontal))).toBe(false);
    const vertical = DEAD_BOARD.map((r) => [...r]);
    vertical[1][3] = 4;
    expect(isGameOver(tilesFromValueBoard(vertical))).toBe(false);
  });

  it('reaches game over through play, and stays consistent', () => {
    // Find a seed where the final spawn closes the board.
    const base: ValueBoard = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 16],
      [8, 8, 32, 64],
    ];
    let found = false;
    for (let rng = 0; rng < 200 && !found; rng++) {
      const outcome = applyMove(stateFrom(base, { rng }), 'right');
      if (outcome?.state.status === 'over') {
        found = true;
        expect(canMove(outcome.state.tiles)).toBe(false);
        expect(applyMove(outcome.state, 'left')).toBeNull();
      }
    }
    expect(found).toBe(true);
  });
});

describe('undo', () => {
  it('restores the previous board, score and PRNG state', () => {
    const start = stateFrom([[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { score: 100, rng: 5 });
    let session = createSession(start, null, 100);
    session = sessionReducer(session, { type: 'move', direction: 'left' });
    expect(session.game.score).toBe(104);
    expect(canUndo(session)).toBe(true);
    const afterMove = session.game;
    session = sessionReducer(session, { type: 'undo' });
    expect(session.game).toEqual(start);
    expect(session.best).toBe(104); // best score survives undo
    expect(canUndo(session)).toBe(false); // one step only
    // The same move after undo yields the same spawn — no rerolling.
    session = sessionReducer(session, { type: 'move', direction: 'left' });
    expect(session.game).toEqual(afterMove);
  });

  it('new game clears undo history', () => {
    let session = createSession(stateFrom([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]));
    session = sessionReducer(session, { type: 'move', direction: 'left' });
    session = sessionReducer(session, { type: 'new-game', seed: 3 });
    expect(session.previous).toBeNull();
    expect(canUndo(session)).toBe(false);
    expect(session.game.score).toBe(0);
  });

  it('undo with nothing to undo is a no-op', () => {
    const session = createSession(createInitialState(1));
    expect(sessionReducer(session, { type: 'undo' })).toBe(session);
  });
});

describe('random', () => {
  it('produces values in [0, 1)', () => {
    let s = 0;
    for (let i = 0; i < 1000; i++) {
      const r = nextRandom(s);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      s = r.state;
    }
  });
});
