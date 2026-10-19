import { useEffect, useRef, type RefObject } from 'react';
import type { Direction } from '../game/types';

/** Distance (px) at which a drag commits mid-gesture — feels instant. */
const COMMIT_DISTANCE = 26;
/** Shorter flicks still count when the finger lifts. */
const FLICK_DISTANCE = 14;
/** The dominant axis must beat the other by this factor, else the gesture is ambiguous. */
const DOMINANCE = 1.25;

export function directionFromDelta(dx: number, dy: number, minDistance: number): Direction | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < minDistance) return null;
  if (ax > ay * DOMINANCE) return dx > 0 ? 'right' : 'left';
  if (ay > ax * DOMINANCE) return dy > 0 ? 'down' : 'up';
  return null;
}

/**
 * Pointer-based swipe detection on one element. Uses pointer capture so the
 * gesture keeps tracking outside the board, fires as soon as the drag is
 * clearly directional, and allows one move per gesture.
 */
export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (d: Direction) => void, enabled: boolean) {
  const handler = useRef(onSwipe);
  handler.current = onSwipe;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let active: { id: number; x: number; y: number; fired: boolean } | null = null;

    const down = (e: PointerEvent) => {
      if (!enabledRef.current || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      // Let buttons inside overlays work normally.
      if ((e.target as HTMLElement).closest('button, a, [data-no-swipe]')) return;
      active = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
    };
    const move = (e: PointerEvent) => {
      if (!active || active.id !== e.pointerId || active.fired) return;
      const dir = directionFromDelta(e.clientX - active.x, e.clientY - active.y, COMMIT_DISTANCE);
      if (dir) {
        active.fired = true;
        handler.current(dir);
      }
    };
    const up = (e: PointerEvent) => {
      if (!active || active.id !== e.pointerId) return;
      if (!active.fired) {
        const dir = directionFromDelta(e.clientX - active.x, e.clientY - active.y, FLICK_DISTANCE);
        if (dir) handler.current(dir);
      }
      active = null;
    };
    const cancel = (e: PointerEvent) => {
      if (active?.id === e.pointerId) active = null;
    };
    // Belt and braces for iOS: touch-action: none handles most cases, but
    // preventing touchmove guarantees the page never scrolls mid-swipe.
    const touchMove = (e: TouchEvent) => {
      if (enabledRef.current && e.cancelable) e.preventDefault();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('touchmove', touchMove, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('touchmove', touchMove);
    };
  }, [ref]);
}
