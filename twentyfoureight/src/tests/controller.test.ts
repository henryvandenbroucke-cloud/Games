import { describe, expect, it } from 'vitest';
import { GameController, MAX_QUEUED_MOVES, type Scheduler } from '../game/controller';
import { createInitialState } from '../game/engine';
import { createSession, sessionReducer, type Session } from '../game/session';
import type { Direction } from '../game/types';

/** Manual scheduler: timers only fire when the test calls flush(). */
function manualScheduler() {
  let pending: Array<{ fn: () => void; cancelled: boolean }> = [];
  const scheduler: Scheduler = (fn) => {
    const entry = { fn, cancelled: false };
    pending.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  const flush = () => {
    while (pending.length) {
      const batch = pending;
      pending = [];
      for (const e of batch) if (!e.cancelled) e.fn();
    }
  };
  return { scheduler, flush, get pending() {
    return pending.filter((e) => !e.cancelled).length;
  } };
}

const DIRS: Direction[] = ['left', 'up', 'right', 'down', 'left', 'left', 'up', 'down', 'right', 'up', 'left', 'down'];

function sequential(start: Session, dirs: Direction[]): Session {
  return dirs.reduce((s, direction) => sessionReducer(s, { type: 'move', direction }), start);
}

describe('rapid input handling', () => {
  it('applies a burst of inputs in order with none lost', () => {
    const start = createSession(createInitialState(31337));
    const timers = manualScheduler();
    const controller = new GameController(start, { getMoveDelay: () => 110, scheduler: timers.scheduler });
    const seen: number[] = [];
    controller.subscribe((s) => seen.push(s.revision));

    for (const d of DIRS) controller.move(d);
    // Only the first move is applied before its animation finishes.
    expect(controller.getSession().revision).toBe(1);
    timers.flush();

    const expected = sequential(start, DIRS);
    expect(controller.getSession().game).toEqual(expected.game);
    expect(controller.getSession().revision).toBe(expected.revision);
    // Each committed revision is seen exactly once, in order.
    expect(seen).toEqual(Array.from({ length: expected.revision }, (_, i) => i + 1));
  });

  it('applies instantly when animations are off', () => {
    const start = createSession(createInitialState(7));
    const controller = new GameController(start, { getMoveDelay: () => 0 });
    for (const d of DIRS) controller.move(d);
    expect(controller.getSession().game).toEqual(sequential(start, DIRS).game);
    expect(controller.isAnimating).toBe(false);
  });

  it('skips invalid moves without stalling the queue', () => {
    // Two tiles already packed left: "left" is invalid, "right" is valid.
    const start = createSession({
      tiles: [
        { id: 1, value: 2, row: 0, col: 0 },
        { id: 2, value: 4, row: 0, col: 1 },
      ],
      score: 0,
      moves: 0,
      status: 'playing',
      wonAcknowledged: false,
      rng: 1,
      nextId: 3,
    });
    const timers = manualScheduler();
    const controller = new GameController(start, { getMoveDelay: () => 100, scheduler: timers.scheduler });
    controller.move('left');
    expect(controller.getSession()).toBe(start);
    expect(controller.isAnimating).toBe(false);
    controller.move('right');
    expect(controller.getSession().game.moves).toBe(1);
  });

  it('discards queued moves when a new game starts', () => {
    const start = createSession(createInitialState(11));
    const timers = manualScheduler();
    const controller = new GameController(start, { getMoveDelay: () => 100, scheduler: timers.scheduler });
    for (const d of DIRS) controller.move(d);
    controller.dispatch({ type: 'new-game', seed: 5 });
    timers.flush();
    expect(controller.getSession().game).toEqual(createInitialState(5));
    expect(controller.pendingMoves).toBe(0);
  });

  it('caps the queue', () => {
    const start = createSession(createInitialState(11));
    const timers = manualScheduler();
    const controller = new GameController(start, { getMoveDelay: () => 100, scheduler: timers.scheduler });
    let accepted = 0;
    for (let i = 0; i < MAX_QUEUED_MOVES + 10; i++) if (controller.move(i % 2 ? 'left' : 'right')) accepted++;
    expect(accepted).toBe(MAX_QUEUED_MOVES + 1); // first one applies immediately, then the queue fills
  });
});
