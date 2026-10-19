import { useEffect, useRef } from 'react';
import type { Direction } from '../game/types';

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
};

interface KeyboardOptions {
  enabled: boolean;
  onMove: (direction: Direction) => void;
  onUndo: () => void;
}

/** Arrow keys / WASD to move, Ctrl/Cmd+Z or U to undo. */
export function useKeyboard({ enabled, onMove, onUndo }: KeyboardOptions) {
  const ref = useRef({ enabled, onMove, onUndo });
  ref.current = { enabled, onMove, onUndo };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { enabled, onMove, onUndo } = ref.current;
      if (!enabled || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;

      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'u' || e.key === 'U') {
        onUndo();
        return;
      }
      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;
      e.preventDefault(); // stop arrow keys from scrolling the page
      if (e.repeat) return; // one move per press keeps the board readable
      onMove(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
