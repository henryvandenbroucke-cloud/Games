import { memo, type CSSProperties } from 'react';
import type { TileData } from '../game/types';

/**
 * idle   – resting / sliding tile
 * new    – freshly spawned: scales in after the slide
 * merged – result of a merge: pops after its sources arrive
 * ghost  – a merge source sliding into its partner (rendered underneath)
 */
export type TileKind = 'idle' | 'new' | 'merged' | 'ghost';

interface TileProps {
  tile: TileData;
  kind: TileKind;
  milestone?: boolean;
  win?: boolean;
}

export function valueClass(value: number): string {
  return value <= 65536 ? `v-${value}` : 'v-super';
}

export const Tile = memo(function Tile({ tile, kind, milestone = false, win = false }: TileProps) {
  const label = String(tile.value);
  const style = { '--x': tile.col, '--y': tile.row } as CSSProperties;
  const classes = ['tile', `tile-${kind}`, milestone && 'tile-milestone', win && 'tile-win'].filter(Boolean).join(' ');
  return (
    <div className={classes} style={style} data-digits={Math.min(label.length, 6)} aria-hidden="true">
      <div className={`tile-inner ${valueClass(tile.value)}`}>
        <span className="tile-label">{label}</span>
      </div>
    </div>
  );
});
