import { sessionReducer, type Session, type SessionAction } from './session';
import type { Direction } from './types';

export type Scheduler = (fn: () => void, ms: number) => () => void;

const defaultScheduler: Scheduler = (fn, ms) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};

/** Inputs beyond this many pending moves are ignored (prevents runaway key-repeat). */
export const MAX_QUEUED_MOVES = 16;

export interface ControllerOptions {
  /** How long a move's slide animation lasts; the next queued move waits this long. 0 = instant. */
  getMoveDelay: () => number;
  scheduler?: Scheduler;
}

export type SessionListener = (session: Session, previous: Session) => void;

/**
 * Owns the authoritative session outside React so rapid inputs are applied
 * against the latest state (never a stale closure). Moves are queued and
 * applied one per animation, so the visuals always match the model and no
 * input is lost.
 */
export class GameController {
  private session: Session;
  private readonly queue: Direction[] = [];
  private cancelTimer: (() => void) | null = null;
  private readonly listeners = new Set<SessionListener>();
  private readonly scheduler: Scheduler;

  constructor(
    initial: Session,
    private readonly options: ControllerOptions,
  ) {
    this.session = initial;
    this.scheduler = options.scheduler ?? defaultScheduler;
  }

  getSession = (): Session => this.session;

  subscribe = (listener: SessionListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get pendingMoves(): number {
    return this.queue.length;
  }

  get isAnimating(): boolean {
    return this.cancelTimer !== null;
  }

  /** Queue a move. Returns false if the queue is full. */
  move(direction: Direction): boolean {
    if (this.queue.length >= MAX_QUEUED_MOVES) return false;
    this.queue.push(direction);
    if (!this.cancelTimer) this.drain();
    return true;
  }

  /** Non-move actions discard pending moves (they were aimed at the old board). */
  dispatch(action: SessionAction): void {
    if (action.type === 'move') {
      this.move(action.direction);
      return;
    }
    this.queue.length = 0;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.commit(sessionReducer(this.session, action));
  }

  dispose(): void {
    this.queue.length = 0;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.listeners.clear();
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const direction = this.queue.shift()!;
      const next = sessionReducer(this.session, { type: 'move', direction });
      if (next === this.session) continue; // invalid move: nothing changes, try the next input
      this.commit(next);

      let delay = this.options.getMoveDelay();
      // Catch up faster when the player is swiping ahead of the animations.
      if (this.queue.length > 1) delay = Math.round(delay * 0.6);
      if (delay > 0) {
        this.cancelTimer = this.scheduler(() => {
          this.cancelTimer = null;
          this.drain();
        }, delay);
        return;
      }
    }
  }

  private commit(next: Session): void {
    if (next === this.session) return;
    const previous = this.session;
    this.session = next;
    for (const listener of this.listeners) listener(next, previous);
  }
}
