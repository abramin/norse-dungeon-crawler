import { Tile } from './types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const rectsOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const carveRoom = (tiles: Tile[][], room: Rect) => {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tiles[y][x] = { ...tiles[y][x], type: 'room' };
    }
  }
};

const carveCorridor = (tiles: Tile[][], from: { x: number; y: number }, to: { x: number; y: number }) => {
  const xDir = to.x > from.x ? 1 : -1;
  for (let x = from.x; x !== to.x; x += xDir) {
    tiles[from.y][x] = { ...tiles[from.y][x], type: 'corridor' };
  }
  const yDir = to.y > from.y ? 1 : -1;
  for (let y = from.y; y !== to.y; y += yDir) {
    tiles[y][to.x] = { ...tiles[y][to.x], type: 'corridor' };
  }
  tiles[to.y][to.x] = { ...tiles[to.y][to.x], type: 'corridor' };
};

export const generateDungeon = (
  gridSize: number
): { tiles: Tile[][]; start: { x: number; y: number }; boss: { x: number; y: number } } => {
  const tiles: Tile[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({ type: 'wall', explored: false, visible: false }) as Tile)
  );

  const rooms: Rect[] = [];
  const roomCount = randomInt(4, 7);

  for (let i = 0; i < roomCount; i++) {
    const w = randomInt(3, 5);
    const h = randomInt(3, 5);
    const x = randomInt(1, gridSize - w - 1);
    const y = randomInt(1, gridSize - h - 1);
    const newRoom = { x, y, w, h };

    if (rooms.some((room) => rectsOverlap(room, newRoom))) {
      i--;
      continue;
    }

    rooms.push(newRoom);
    carveRoom(tiles, newRoom);
  }

  rooms.sort((a, b) => a.x - b.x + (a.y - b.y));

  for (let i = 0; i < rooms.length - 1; i++) {
    const current = rooms[i];
    const next = rooms[i + 1];
    const currentCenter = { x: Math.floor(current.x + current.w / 2), y: Math.floor(current.y + current.h / 2) };
    const nextCenter = { x: Math.floor(next.x + next.w / 2), y: Math.floor(next.y + next.h / 2) };
    carveCorridor(tiles, currentCenter, nextCenter);
  }

  const centers = rooms.map((r) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) }));
  const start = centers[0] ?? { x: 1, y: 1 };
  tiles[start.y][start.x] = { ...tiles[start.y][start.x], type: 'start' };

  let boss = start;
  let maxDist = -Infinity;
  centers.forEach((center) => {
    const dist = Math.hypot(center.x - start.x, center.y - start.y);
    if (dist > maxDist) {
      maxDist = dist;
      boss = center;
    }
  });

  tiles[boss.y][boss.x] = { ...tiles[boss.y][boss.x], type: 'boss' };

  return { tiles, start, boss };
};
