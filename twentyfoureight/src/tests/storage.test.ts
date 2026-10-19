import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../game/constants';
import { applyMove, createInitialState, tilesFromValueBoard } from '../game/engine';
import {
  DEFAULT_SETTINGS,
  createMemoryStore,
  loadBest,
  loadGame,
  loadSettings,
  loadStats,
  restoreGameState,
  saveBest,
  saveGame,
  saveSettings,
  serializeGameState,
  validateGameState,
  type KeyValueStore,
} from '../game/storage';

describe('game save / restore', () => {
  it('round-trips a game and its undo snapshot', () => {
    const start = createInitialState(2024);
    const dirs = ['left', 'up', 'right', 'down'] as const;
    let game = start;
    let previous = null;
    for (let i = 0; i < 20; i++) {
      const outcome = applyMove(game, dirs[i % 4]);
      if (outcome) {
        previous = game;
        game = outcome.state;
      }
    }
    const store = createMemoryStore();
    expect(saveGame(store, game, previous)).toBe(true);
    expect(loadGame(store)).toEqual({ game, previous });
  });

  it('serialize / restore are inverse', () => {
    const game = createInitialState(9);
    expect(restoreGameState(serializeGameState(game))).toEqual({ game, previous: null });
  });

  it.each([
    ['not json', '{oops'],
    ['wrong version', JSON.stringify({ version: 99, game: createInitialState(1) })],
    ['null', 'null'],
    ['array', '[]'],
    ['missing tiles', JSON.stringify({ version: 1, game: { score: 1 } })],
    ['bad tile value', JSON.stringify({ version: 1, game: { ...createInitialState(1), tiles: [{ id: 1, value: 3, row: 0, col: 0 }] } })],
    ['out of bounds', JSON.stringify({ version: 1, game: { ...createInitialState(1), tiles: [{ id: 1, value: 2, row: 4, col: 0 }] } })],
    [
      'overlapping tiles',
      JSON.stringify({
        version: 1,
        game: { ...createInitialState(1), tiles: [{ id: 1, value: 2, row: 0, col: 0 }, { id: 2, value: 4, row: 0, col: 0 }] },
      }),
    ],
    ['negative score', JSON.stringify({ version: 1, game: { ...createInitialState(1), score: -5 } })],
    ['bad status', JSON.stringify({ version: 1, game: { ...createInitialState(1), status: 'hacked' } })],
    ['stale nextId', JSON.stringify({ version: 1, game: { ...createInitialState(1), nextId: 1 } })],
  ])('rejects corrupted data without throwing (%s)', (_label, json) => {
    expect(() => restoreGameState(json)).not.toThrow();
    expect(restoreGameState(json)).toBeNull();
  });

  it('keeps the game when only the undo snapshot is corrupt', () => {
    const game = createInitialState(5);
    const json = JSON.stringify({ version: 1, game, previous: { garbage: true } });
    expect(restoreGameState(json)).toEqual({ game, previous: null });
  });

  it('repairs an inconsistent status', () => {
    const game = { ...createInitialState(5), status: 'over' as const };
    expect(validateGameState(game)?.status).toBe('playing');
    const won = {
      ...createInitialState(5),
      tiles: tilesFromValueBoard([[2048, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]),
      nextId: 10,
      status: 'won' as const,
      wonAcknowledged: true,
    };
    expect(validateGameState(won)?.status).toBe('playing');
  });

  it('survives a storage backend that throws', () => {
    const exploding: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadGame(exploding)).toBeNull();
    expect(saveGame(exploding, createInitialState(1), null)).toBe(false);
    expect(loadBest(exploding)).toBe(0);
    expect(loadSettings(exploding)).toEqual(DEFAULT_SETTINGS);
    expect(loadStats(exploding).gamesPlayed).toBe(0);
  });
});

describe('best score and preferences', () => {
  it('persists best score independently of a corrupted game save', () => {
    const store = createMemoryStore();
    saveBest(store, 5120);
    store.setItem(STORAGE_KEYS.game, 'corrupted!!');
    store.setItem(STORAGE_KEYS.settings, 'also corrupted');
    expect(loadGame(store)).toBeNull();
    expect(loadBest(store)).toBe(5120);
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back field by field for settings', () => {
    const store = createMemoryStore();
    store.setItem(STORAGE_KEYS.settings, JSON.stringify({ sound: true, theme: 'neon', animations: 'yes' }));
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, sound: true });
  });

  it('round-trips settings', () => {
    const store = createMemoryStore();
    const settings = { sound: true, haptics: false, animations: false, theme: 'dark' as const };
    saveSettings(store, settings);
    expect(loadSettings(store)).toEqual(settings);
  });

  it('rejects a non-numeric best score', () => {
    const store = createMemoryStore({ [STORAGE_KEYS.best]: '"lots"' });
    expect(loadBest(store)).toBe(0);
  });
});
