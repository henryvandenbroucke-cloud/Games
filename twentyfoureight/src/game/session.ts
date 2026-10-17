import { applyMove, createInitialState, keepPlaying } from './engine';
import type { Direction, GameState, MoveEvents } from './types';

/**
 * Everything the game screen needs: the live game, a one-step undo snapshot,
 * the best score, and metadata about the last change (for animations).
 */
export interface Session {
  game: GameState;
  /** Snapshot taken before the last valid move. Undo is limited to one step. */
  previous: GameState | null;
  best: number;
  /** Animation metadata for the most recent move (null after undo/new game/load). */
  lastMove: MoveEvents | null;
  lastAction: SessionAction['type'] | 'init';
  /** Increments on every change; used to key transient effects. */
  revision: number;
  /** Increments on every new game, so tile ids from different games never collide as React keys. */
  epoch: number;
}

export type SessionAction =
  | { type: 'move'; direction: Direction }
  | { type: 'new-game'; seed: number }
  | { type: 'undo' }
  | { type: 'keep-playing' }
  | { type: 'reset-best' };

export function createSession(game: GameState, previous: GameState | null = null, best = 0): Session {
  return {
    game,
    previous,
    best: Math.max(best, game.score),
    lastMove: null,
    lastAction: 'init',
    revision: 0,
    epoch: 0,
  };
}

export function canUndo(session: Session): boolean {
  return session.previous !== null && session.game.status !== 'won';
}

/** Pure reducer. Returns the *same object* when an action changes nothing. */
export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case 'move': {
      const outcome = applyMove(session.game, action.direction);
      if (!outcome) return session;
      return {
        game: outcome.state,
        previous: session.game,
        best: Math.max(session.best, outcome.state.score),
        lastMove: outcome.events,
        lastAction: 'move',
        revision: session.revision + 1,
        epoch: session.epoch,
      };
    }
    case 'new-game':
      return {
        game: createInitialState(action.seed),
        previous: null,
        best: session.best,
        lastMove: null,
        lastAction: 'new-game',
        revision: session.revision + 1,
        epoch: session.epoch + 1,
      };
    case 'undo': {
      if (!canUndo(session) || !session.previous) return session;
      return {
        // Continuing past 2048 is remembered even across undo, so the victory
        // overlay can never reappear in the same game.
        game: {
          ...session.previous,
          wonAcknowledged: session.previous.wonAcknowledged || session.game.wonAcknowledged,
        },
        previous: null,
        best: session.best,
        lastMove: null,
        lastAction: 'undo',
        revision: session.revision + 1,
        epoch: session.epoch,
      };
    }
    case 'keep-playing': {
      const game = keepPlaying(session.game);
      if (game === session.game) return session;
      return { ...session, game, lastMove: null, lastAction: 'keep-playing', revision: session.revision + 1 };
    }
    case 'reset-best':
      return {
        ...session,
        best: session.game.score,
        lastMove: null,
        lastAction: 'reset-best',
        revision: session.revision + 1,
      };
  }
}
