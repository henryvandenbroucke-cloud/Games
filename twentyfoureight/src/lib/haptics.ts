export const hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/** Fire-and-forget vibration. Silently does nothing where unsupported (e.g. iOS Safari). */
export function vibrate(pattern: number | number[]): void {
  if (!enabled || !hapticsSupported) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw without a user gesture — ignore */
  }
}
