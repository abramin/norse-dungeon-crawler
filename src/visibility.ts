import { Tile } from './types';

const isOpaque = (tile: Tile) => tile.type === 'wall' || (tile.type === 'secretDoor' && !tile.revealed);

const hasLineOfSight = (tiles: Tile[][], from: { x: number; y: number }, to: { x: number; y: number }) => {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    if (!(x0 === from.x && y0 === from.y) && isOpaque(tiles[y0][x0])) return false;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return true;
};

export const computeVisibility = (tiles: Tile[][], playerPos: { x: number; y: number }, radius: number): Tile[][] => {
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  const updated = tiles.map((row) => row.map((t) => ({ ...t, visible: false })));

  for (let y = Math.max(0, playerPos.y - radius - 1); y < Math.min(rows, playerPos.y + radius + 2); y++) {
    for (let x = Math.max(0, playerPos.x - radius - 1); x < Math.min(cols, playerPos.x + radius + 2); x++) {
      const dist = Math.hypot(playerPos.x - x, playerPos.y - y);
      if (dist <= radius && hasLineOfSight(tiles, playerPos, { x, y })) {
        updated[y][x].visible = true;
        updated[y][x].explored = true;
      }
    }
  }

  return updated;
};
