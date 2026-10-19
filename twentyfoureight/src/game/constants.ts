export const BOARD_SIZE = 4;
export const WIN_VALUE = 2048;
export const START_TILES = 2;
/** Probability that a spawned tile is a 2 (otherwise a 4). */
export const SPAWN_TWO_PROBABILITY = 0.9;

/** Tile values that get extra visual + audio emphasis when created. */
export const MILESTONES = [128, 256, 512, 1024, 2048] as const;

/** Slide duration in ms. Kept in sync with --slide-ms in globals.css. */
export const SLIDE_MS = 110;

export const STORAGE_KEYS = {
  game: 'tfe:game:v1',
  best: 'tfe:best:v1',
  settings: 'tfe:settings:v1',
  stats: 'tfe:stats:v1',
} as const;
