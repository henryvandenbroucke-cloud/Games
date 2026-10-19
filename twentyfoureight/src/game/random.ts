/**
 * Mulberry32: a tiny, fast, seedable PRNG. The whole generator state is one
 * uint32, so it serializes trivially and can be snapshotted for undo.
 */
export interface RandomResult {
  value: number; // [0, 1)
  state: number; // next generator state
}

export function nextRandom(state: number): RandomResult {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

/** Random integer in [0, max). */
export function nextInt(state: number, max: number): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: Math.floor(r.value * max), state: r.state };
}

/** A fresh seed from the platform RNG (non-deterministic). */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

export function isValidSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
