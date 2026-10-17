# TwentyFourEight

A polished, mobile-first take on the 2048 sliding-tile puzzle. It's built with React, TypeScript, Vite and Tailwind CSS and needs no backend.

> Merge. Think. Reach 2048.

## Run it

```bash
cd twentyfoureight
npm install
npm run dev        # http://localhost:5173 (add --host to try it on your phone over Wi-Fi)
npm test           # Vitest suite (engine, storage, input queue)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

The build uses relative asset paths, so you can host `dist/` from any static host or sub-path (GitHub Pages, Netlify, etc.).

## Features

- **Faithful rules.** The board is 4×4. New tiles are a 2 (90%) or a 4 (10%). A tile merges at most once per move, and merges resolve in the direction of the move. An invalid move changes nothing, including the random number generator.
- **Real animation system.** Every tile keeps a stable identity. Tiles slide with CSS transforms. Merging tiles slide into each other before the result pops. New tiles scale in. Milestone tiles (128 and up) glow, and the 2048 tile shines gold with confetti.
- **Rapid input queue.** Moves wait in a queue and play out one animation at a time, with no lost inputs and no visual desync. The queue speeds up when you swipe ahead of it.
- **Controls.** Swipe on the board, which is the only area that blocks scrolling. On desktop, use the arrow keys or WASD. U or Ctrl/Cmd+Z undoes a move.
- **Undo.** You get one step back. The snapshot includes the generator state, so undoing and repeating a move gives the same spawn and can't be used to reroll.
- **Win and lose screens.** The win overlay offers Keep Playing (it never returns in that game) or New Game. The game-over overlay shows your final and best score, with Try Again, Undo and Close.
- **Reasons to come back.** Merge tones climb a musical scale as tiles grow. Callouts appear for combos ("Double!", "Triple!"), milestones, a new personal-record tile and a new best score. A progress meter counts the doublings left to the next goal, and lifetime stats track games, wins, win rate, highest tile, merges and moves.
- **Settings.** Sound (synthesized with Web Audio, off by default), vibration (where supported), animations on or off, and a light, dark or automatic theme. You can also reset your best score, with confirmation.
- **Auto-save.** The game, undo snapshot, best score, settings and stats are each stored under a separate localStorage key and checked on load. Corrupt or outdated data is thrown away safely, and a bad save never takes your best score with it.
- **Accessibility.** Native `<dialog>` modals, visible focus rings, switch and radio roles, a screen-reader table of the board, polite announcements for wins, losses and new bests, and support for `prefers-reduced-motion`.

## Architecture

```
src/
  game/            pure, framework-free logic
    engine.ts      slide/merge/spawn/win/lose: applyMove(), mergeLine(), moveBoard(), canMove() …
    session.ts     reducer: game + one-step undo + best score + last-move animation metadata
    controller.ts  owns the session outside React; queues moves one animation at a time
    random.ts      seedable Mulberry32 PRNG (state is a single uint32)
    storage.ts     validated localStorage persistence (injectable store for tests)
    constants.ts, types.ts
  hooks/           useGame (wiring, sound, haptics, stats, callouts), useSwipe, useKeyboard, useSettings
  components/      GameBoard, Tile, ScoreCard, GameControls, GameOverlay, ProgressMeter, Modal, Settings/Stats dialogs
  lib/             audio.ts (Web Audio synth), haptics.ts
  styles/          globals.css: design tokens, tile palette, animations, themes
  tests/           engine / storage / controller tests
```

Game rules never depend on animation timing. The engine returns the new state along with *events* (movements, merges, spawn). The board uses those events to render "ghost" tiles that slide into each merge and then fade under the merged tile.

## Credits

Inspired by [2048](https://github.com/gabrielecirulli/2048) by Gabriele Cirulli, which was itself based on 1024 by Veewo Studio. All artwork, colours and code in this repository are original.
