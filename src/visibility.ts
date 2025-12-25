import { Tile } from './types';

export const computeVisibility = (tiles: Tile[][], playerPos: { x: number; y: number }, radius: number): Tile[][] => {
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  const updated = tiles.map((row) => row.map((t) => ({ ...t, visible: false })));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dist = Math.hypot(playerPos.x - x, playerPos.y - y);
      if (dist <= radius) {
        updated[y][x].visible = true;
        updated[y][x].explored = true;
      }
    }
  }

  return updated;
};
