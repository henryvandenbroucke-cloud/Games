import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MILESTONES, SLIDE_MS } from '../game/constants';
import { GameController } from '../game/controller';
import { createInitialState, maxTile } from '../game/engine';
import { randomSeed } from '../game/random';
import { canUndo, createSession, type Session } from '../game/session';
import {
  loadBest,
  loadGame,
  loadStats,
  saveBest,
  saveGame,
  saveStats,
  type KeyValueStore,
  type Settings,
  type Stats,
} from '../game/storage';
import type { Direction } from '../game/types';
import { sound } from '../lib/audio';
import { vibrate } from '../lib/haptics';

export type CalloutKind = 'chain' | 'milestone' | 'record' | 'best';

export interface Callout {
  id: number;
  kind: CalloutKind;
  text: string;
}

function loadInitialSession(store: KeyValueStore): Session {
  const saved = loadGame(store);
  const best = loadBest(store);
  const game = saved?.game ?? createInitialState(randomSeed());
  return createSession(game, saved?.previous ?? null, best);
}

const CHAIN_WORDS = ['', '', 'Double!', 'Triple!', 'Quad combo!'];

export function useGame(store: KeyValueStore, settings: Settings) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [controller] = useState(
    () =>
      new GameController(loadInitialSession(store), {
        getMoveDelay: () => (settingsRef.current.animations ? SLIDE_MS : 0),
      }),
  );
  const session = useSyncExternalStore(controller.subscribe, controller.getSession, controller.getSession);

  const [stats, setStats] = useState<Stats>(() => loadStats(store));
  const statsRef = useRef(stats);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [announcement, setAnnouncement] = useState('');
  /** Best score when this game started — "New best!" fires once when it's beaten. */
  const bestAtStartRef = useRef(session.best);
  const celebratedBestRef = useRef(false);
  /** The game epoch already counted in "games played" (so undo + redo of move 1 can't double count). */
  const countedEpochRef = useRef<number | null>(session.game.moves > 0 ? session.epoch : null);

  const updateStats = useCallback(
    (fn: (s: Stats) => Stats) => {
      const next = fn(statsRef.current);
      statsRef.current = next;
      saveStats(store, next);
      setStats(next);
    },
    [store],
  );

  // Persistence + feedback for every committed change.
  useEffect(() => {
    return controller.subscribe((next, prev) => {
      saveGame(store, next.game, next.previous);
      if (next.best !== prev.best) saveBest(store, next.best);

      if (next.lastAction === 'new-game') {
        bestAtStartRef.current = next.best;
        celebratedBestRef.current = false;
        setAnnouncement('New game started.');
        return;
      }
      if (next.lastAction === 'reset-best') {
        bestAtStartRef.current = next.best;
        celebratedBestRef.current = next.best > 0;
        return;
      }
      if (next.lastAction !== 'move' || !next.lastMove) return;

      const ev = next.lastMove;
      const s = settingsRef.current;
      const mergedValues = ev.merges.map((m) => m.result.value);
      const top = maxTile(next.game.tiles);
      const previousRecord = statsRef.current.highestTile;

      const firstMoveOfGame = countedEpochRef.current !== next.epoch;
      countedEpochRef.current = next.epoch;
      updateStats((st) => ({
        gamesPlayed: st.gamesPlayed + (firstMoveOfGame ? 1 : 0),
        gamesWon: st.gamesWon + (ev.reachedWin ? 1 : 0),
        highestTile: Math.max(st.highestTile, top),
        totalMerges: st.totalMerges + ev.merges.length,
        totalMoves: st.totalMoves + 1,
      }));

      // --- Sound + haptics -------------------------------------------------
      const isMilestone = (MILESTONES as readonly number[]).includes(ev.highestMerge) || ev.highestMerge > 2048;
      if (s.sound) {
        if (ev.reachedWin) sound.victory();
        else if (mergedValues.length) {
          sound.merge(mergedValues);
          if (isMilestone) sound.milestone(ev.highestMerge);
        } else sound.move();
        if (ev.causedGameOver) setTimeout(() => sound.gameOver(), 250);
      }
      if (ev.reachedWin) vibrate([30, 40, 30, 40, 60]);
      else if (isMilestone) vibrate([18, 30, 18]);
      else if (mergedValues.length) vibrate(8);
      if (ev.causedGameOver) vibrate([40, 60, 80]);

      // --- Callouts (highest priority wins) --------------------------------
      let text = '';
      let kind: CalloutKind = 'chain';
      const beatBest = !celebratedBestRef.current && bestAtStartRef.current > 0 && next.game.score > bestAtStartRef.current;
      if (ev.highestMerge >= 256 && ev.highestMerge > previousRecord && previousRecord > 0) {
        text = `New record tile · ${ev.highestMerge}`;
        kind = 'record';
      } else if (beatBest) {
        text = 'New best score!';
        kind = 'best';
      } else if (isMilestone) {
        text = `${ev.highestMerge}!`;
        kind = 'milestone';
      } else if (ev.merges.length >= 2) {
        text = CHAIN_WORDS[Math.min(ev.merges.length, 4)];
      }
      if (beatBest) {
        celebratedBestRef.current = true;
        if (s.sound && !ev.reachedWin) setTimeout(() => sound.newBest(), 120);
      }
      if (text && !ev.reachedWin) setCallout({ id: next.revision, kind, text });

      if (ev.reachedWin) setAnnouncement('You reached 2048! Keep playing or start a new game.');
      else if (ev.causedGameOver) setAnnouncement(`No more moves. Final score ${next.game.score}. Best ${next.best}.`);
      else if (beatBest) setAnnouncement(`New best score: ${next.game.score}`);
    });
  }, [controller, store, updateStats]);

  const move = useCallback(
    (direction: Direction) => {
      if (settingsRef.current.sound) sound.unlock();
      controller.move(direction);
    },
    [controller],
  );
  const newGame = useCallback(() => controller.dispatch({ type: 'new-game', seed: randomSeed() }), [controller]);
  const undo = useCallback(() => {
    if (!canUndo(controller.getSession())) return;
    controller.dispatch({ type: 'undo' });
    setCallout(null);
    setAnnouncement('Move undone.');
  }, [controller]);
  const keepPlaying = useCallback(() => controller.dispatch({ type: 'keep-playing' }), [controller]);
  const resetBest = useCallback(() => controller.dispatch({ type: 'reset-best' }), [controller]);

  return {
    session,
    stats,
    callout,
    announcement,
    canUndo: canUndo(session),
    move,
    newGame,
    undo,
    keepPlaying,
    resetBest,
  };
}
