import { Tile, FacingDirection } from './types';

export interface RaycastResult {
  distance: number;
  tileType: string;
  side: 'ns' | 'ew'; // Which side of wall was hit (for shading)
  wallX: number; // Where exactly the wall was hit (0-1) for texturing
  tile: Tile | null;
  gridX: number;
  gridY: number;
}

export interface RaycastConfig {
  fov: number; // Field of view in radians
  maxDistance: number;
}

const DEFAULT_CONFIG: RaycastConfig = {
  fov: Math.PI / 3, // 60 degrees
  maxDistance: 16,
};

// Convert facing direction to angle in radians
export function facingToAngle(facing: FacingDirection): number {
  switch (facing) {
    case 'north': return -Math.PI / 2;
    case 'south': return Math.PI / 2;
    case 'east': return 0;
    case 'west': return Math.PI;
  }
}

// Get display type for a tile (handles hidden traps and secret doors)
function getDisplayType(tile: Tile): string {
  if (tile.type === 'trap' && !tile.revealed && !tile.triggered) {
    return tile.regionType === 'room' ? 'room' : 'corridor';
  }
  if (tile.type === 'secretDoor' && !tile.revealed) {
    return 'wall';
  }
  return tile.type;
}

// Check if a tile blocks movement/sight
function isBlocking(tile: Tile): boolean {
  const displayType = getDisplayType(tile);
  return displayType === 'wall';
}

// Cast a single ray and find what it hits
export function castRay(
  tiles: Tile[][],
  playerX: number,
  playerY: number,
  angle: number,
  config: RaycastConfig = DEFAULT_CONFIG
): RaycastResult {
  const gridWidth = tiles[0]?.length ?? 0;
  const gridHeight = tiles.length;

  // Ray direction
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);

  // Current grid position
  let mapX = Math.floor(playerX);
  let mapY = Math.floor(playerY);

  // Length of ray from one side to next
  const deltaDistX = Math.abs(1 / rayDirX);
  const deltaDistY = Math.abs(1 / rayDirY);

  // Direction to step in
  const stepX = rayDirX < 0 ? -1 : 1;
  const stepY = rayDirY < 0 ? -1 : 1;

  // Initial distance to first grid line
  let sideDistX = rayDirX < 0
    ? (playerX - mapX) * deltaDistX
    : (mapX + 1 - playerX) * deltaDistX;
  let sideDistY = rayDirY < 0
    ? (playerY - mapY) * deltaDistY
    : (mapY + 1 - playerY) * deltaDistY;

  let hit = false;
  let side: 'ns' | 'ew' = 'ew';
  let distance = 0;

  // DDA algorithm
  while (!hit && distance < config.maxDistance) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 'ew';
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 'ns';
    }

    // Check bounds
    if (mapX < 0 || mapX >= gridWidth || mapY < 0 || mapY >= gridHeight) {
      distance = config.maxDistance;
      break;
    }

    const tile = tiles[mapY][mapX];
    if (isBlocking(tile)) {
      hit = true;
    }

    // Calculate distance
    if (side === 'ew') {
      distance = sideDistX - deltaDistX;
    } else {
      distance = sideDistY - deltaDistY;
    }
  }

  // Calculate wall X (where exactly the ray hit for texturing)
  let wallX: number;
  if (side === 'ew') {
    wallX = playerY + distance * rayDirY;
  } else {
    wallX = playerX + distance * rayDirX;
  }
  wallX -= Math.floor(wallX);

  const tile = (mapX >= 0 && mapX < gridWidth && mapY >= 0 && mapY < gridHeight)
    ? tiles[mapY][mapX]
    : null;

  return {
    distance: Math.max(0.1, distance), // Prevent division by zero
    tileType: tile ? getDisplayType(tile) : 'wall',
    side,
    wallX,
    tile,
    gridX: mapX,
    gridY: mapY,
  };
}

// Cast all rays for a frame
export function castAllRays(
  tiles: Tile[][],
  playerX: number,
  playerY: number,
  facing: FacingDirection,
  screenWidth: number,
  config: RaycastConfig = DEFAULT_CONFIG
): RaycastResult[] {
  const results: RaycastResult[] = [];
  const playerAngle = facingToAngle(facing);

  for (let x = 0; x < screenWidth; x++) {
    // Calculate ray angle for this screen column
    const cameraX = (2 * x) / screenWidth - 1; // -1 to 1
    const rayAngle = playerAngle + cameraX * (config.fov / 2);

    results.push(castRay(tiles, playerX, playerY, rayAngle, config));
  }

  return results;
}

// Get visible entities (monsters, treasures) in front of the player
export interface VisibleEntity {
  type: 'monster' | 'treasure' | 'trap' | 'door';
  x: number;
  y: number;
  distance: number;
  screenX: number; // Position on screen (0-1)
  tile: Tile;
  monsterId?: string;
  isBoss?: boolean;
}

export function getVisibleEntities(
  tiles: Tile[][],
  playerX: number,
  playerY: number,
  facing: FacingDirection,
  config: RaycastConfig = DEFAULT_CONFIG
): VisibleEntity[] {
  const entities: VisibleEntity[] = [];
  const playerAngle = facingToAngle(facing);
  const gridWidth = tiles[0]?.length ?? 0;
  const gridHeight = tiles.length;

  // Check tiles in a cone in front of the player
  for (let dy = -config.maxDistance; dy <= config.maxDistance; dy++) {
    for (let dx = -config.maxDistance; dx <= config.maxDistance; dx++) {
      const tileX = Math.floor(playerX) + dx;
      const tileY = Math.floor(playerY) + dy;

      if (tileX < 0 || tileX >= gridWidth || tileY < 0 || tileY >= gridHeight) continue;

      const tile = tiles[tileY][tileX];
      if (!tile.visible) continue;

      // Calculate angle to this tile
      const entityX = tileX + 0.5;
      const entityY = tileY + 0.5;
      const dx2 = entityX - playerX;
      const dy2 = entityY - playerY;
      const distance = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (distance < 0.5 || distance > config.maxDistance) continue;

      const angleToEntity = Math.atan2(dy2, dx2);
      let angleDiff = angleToEntity - playerAngle;

      // Normalize angle difference
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      // Check if entity is within FOV
      if (Math.abs(angleDiff) > config.fov / 2) continue;

      // Calculate screen X position (0 to 1)
      const screenX = 0.5 + angleDiff / config.fov;

      // Add entities based on tile type
      if (tile.monsterId) {
        entities.push({
          type: 'monster',
          x: entityX,
          y: entityY,
          distance,
          screenX,
          tile,
          monsterId: tile.monsterId,
          isBoss: tile.type === 'boss',
        });
      } else if (tile.type === 'treasure') {
        entities.push({
          type: 'treasure',
          x: entityX,
          y: entityY,
          distance,
          screenX,
          tile,
        });
      } else if (tile.type === 'trap' && tile.revealed && !tile.triggered) {
        entities.push({
          type: 'trap',
          x: entityX,
          y: entityY,
          distance,
          screenX,
          tile,
        });
      } else if (tile.type === 'door' || (tile.type === 'secretDoor' && tile.revealed)) {
        entities.push({
          type: 'door',
          x: entityX,
          y: entityY,
          distance,
          screenX,
          tile,
        });
      }
    }
  }

  // Sort by distance (furthest first for proper rendering order)
  entities.sort((a, b) => b.distance - a.distance);

  return entities;
}

// Movement helpers
export function getForwardDelta(facing: FacingDirection): { dx: number; dy: number } {
  switch (facing) {
    case 'north': return { dx: 0, dy: -1 };
    case 'south': return { dx: 0, dy: 1 };
    case 'east': return { dx: 1, dy: 0 };
    case 'west': return { dx: -1, dy: 0 };
  }
}

export function getStrafeDelta(facing: FacingDirection, direction: 'left' | 'right'): { dx: number; dy: number } {
  const rightMap: Record<FacingDirection, FacingDirection> = {
    north: 'east',
    east: 'south',
    south: 'west',
    west: 'north',
  };
  const leftMap: Record<FacingDirection, FacingDirection> = {
    north: 'west',
    west: 'south',
    south: 'east',
    east: 'north',
  };

  const strafeFacing = direction === 'right' ? rightMap[facing] : leftMap[facing];
  return getForwardDelta(strafeFacing);
}

export function turnLeft(facing: FacingDirection): FacingDirection {
  const map: Record<FacingDirection, FacingDirection> = {
    north: 'west',
    west: 'south',
    south: 'east',
    east: 'north',
  };
  return map[facing];
}

export function turnRight(facing: FacingDirection): FacingDirection {
  const map: Record<FacingDirection, FacingDirection> = {
    north: 'east',
    east: 'south',
    south: 'west',
    west: 'north',
  };
  return map[facing];
}
