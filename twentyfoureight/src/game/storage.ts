import { BOARD_SIZE, STORAGE_KEYS } from './constants';
import { hasWon, isGameOver } from './engine';
import { isValidSeed } from './random';
import type { GameState, GameStatus, TileData } from './types';

/** The subset of the Web Storage API we use — injectable for tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

/** localStorage when usable (it can throw in private modes / sandboxes), memory otherwise. */
export function getBrowserStore(): KeyValueStore {
  try {
    const ls = window.localStorage;
    const probe = '__tfe_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return createMemoryStore();
  }
}

function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage disabled — the game keeps running
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isPowerOfTwoTile = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= 2 ** 30 && (v & (v - 1)) === 0;
const STATUSES: readonly GameStatus[] = ['playing', 'won', 'over'];

function validateTile(raw: unknown): TileData | null {
  if (!isObject(raw)) return null;
  const { id, value, row, col } = raw;
  if (!isNonNegInt(id) || id < 1) return null;
  if (!isPowerOfTwoTile(value)) return null;
  if (!isNonNegInt(row) || row >= BOARD_SIZE) return null;
  if (!isNonNegInt(col) || col >= BOARD_SIZE) return null;
  return { id, value, row, col };
}

/** Returns a clean GameState, or null if the data is unusable. Never throws. */
export function validateGameState(raw: unknown): GameState | null {
  if (!isObject(raw) || !Array.isArray(raw.tiles) || raw.tiles.length > BOARD_SIZE * BOARD_SIZE) return null;

  const tiles: TileData[] = [];
  const ids = new Set<number>();
  const cells = new Set<number>();
  for (const t of raw.tiles) {
    const tile = validateTile(t);
    if (!tile) return null;
    const cell = tile.row * BOARD_SIZE + tile.col;
    if (ids.has(tile.id) || cells.has(cell)) return null;
    ids.add(tile.id);
    cells.add(cell);
    tiles.push(tile);
  }
  if (tiles.length === 0) return null;

  const { score, moves, status, wonAcknowledged, rng, nextId } = raw;
  if (!isNonNegInt(score) || !isNonNegInt(moves)) return null;
  if (typeof status !== 'string' || !STATUSES.includes(status as GameStatus)) return null;
  if (typeof wonAcknowledged !== 'boolean' || !isValidSeed(rng)) return null;
  const maxId = Math.max(...ids);
  if (!isNonNegInt(nextId) || nextId <= maxId) return null;

  // Re-derive status so a tampered/outdated save can't leave the game stuck.
  let fixedStatus = status as GameStatus;
  if (fixedStatus === 'won' && (wonAcknowledged || !hasWon(tiles))) fixedStatus = 'playing';
  if (fixedStatus !== 'won') fixedStatus = isGameOver(tiles) ? 'over' : 'playing';

  return { tiles, score, moves, status: fixedStatus, wonAcknowledged, rng, nextId };
}

// ---------------------------------------------------------------------------
// Game save
// ---------------------------------------------------------------------------

const SAVE_VERSION = 1;

export interface SavedGame {
  game: GameState;
  previous: GameState | null;
}

export function serializeGameState(game: GameState, previous: GameState | null = null): string {
  return JSON.stringify({ version: SAVE_VERSION, game, previous });
}

export function restoreGameState(json: string | null | undefined): SavedGame | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(raw) || raw.version !== SAVE_VERSION) return null;
  const game = validateGameState(raw.game);
  if (!game) return null;
  // A broken undo snapshot only costs the undo, never the game.
  const previous = raw.previous == null ? null : validateGameState(raw.previous);
  return { game, previous };
}

export function saveGame(store: KeyValueStore, game: GameState, previous: GameState | null): boolean {
  try {
    store.setItem(STORAGE_KEYS.game, serializeGameState(game, previous));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(store: KeyValueStore): SavedGame | null {
  try {
    return restoreGameState(store.getItem(STORAGE_KEYS.game));
  } catch {
    return null;
  }
}

export function clearGame(store: KeyValueStore): void {
  try {
    store.removeItem(STORAGE_KEYS.game);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Best score — stored on its own so nothing else can corrupt it
// ---------------------------------------------------------------------------

export function loadBest(store: KeyValueStore): number {
  const raw = readJson(store, STORAGE_KEYS.best);
  return isNonNegInt(raw) ? raw : 0;
}

export function saveBest(store: KeyValueStore, best: number): boolean {
  return writeJson(store, STORAGE_KEYS.best, Math.max(0, Math.floor(best)));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  animations: boolean;
  theme: ThemePreference;
}

export const DEFAULT_SETTINGS: Settings = { sound: false, haptics: true, animations: true, theme: 'system' };

/** Field-by-field: one bad value falls back to its default without discarding the rest. */
export function loadSettings(store: KeyValueStore, defaults: Settings = DEFAULT_SETTINGS): Settings {
  const raw = readJson(store, STORAGE_KEYS.settings);
  if (!isObject(raw)) return { ...defaults };
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const theme: ThemePreference =
    raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : defaults.theme;
  return {
    sound: bool(raw.sound, defaults.sound),
    haptics: bool(raw.haptics, defaults.haptics),
    animations: bool(raw.animations, defaults.animations),
    theme,
  };
}

export function saveSettings(store: KeyValueStore, settings: Settings): boolean {
  return writeJson(store, STORAGE_KEYS.settings, settings);
}

// ---------------------------------------------------------------------------
// Lifetime stats
// ---------------------------------------------------------------------------

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  highestTile: number;
  totalMerges: number;
  totalMoves: number;
}

export const EMPTY_STATS: Stats = { gamesPlayed: 0, gamesWon: 0, highestTile: 0, totalMerges: 0, totalMoves: 0 };

export function loadStats(store: KeyValueStore): Stats {
  const raw = readJson(store, STORAGE_KEYS.stats);
  if (!isObject(raw)) return { ...EMPTY_STATS };
  const n = (v: unknown) => (isNonNegInt(v) ? v : 0);
  return {
    gamesPlayed: n(raw.gamesPlayed),
    gamesWon: n(raw.gamesWon),
    highestTile: n(raw.highestTile),
    totalMerges: n(raw.totalMerges),
    totalMoves: n(raw.totalMoves),
  };
}

export function saveStats(store: KeyValueStore, stats: Stats): boolean {
  return writeJson(store, STORAGE_KEYS.stats, stats);
}
