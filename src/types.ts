export type TileType =
  | 'wall'
  | 'room'
  | 'corridor'
  | 'door'
  | 'secretDoor'
  | 'trap'
  | 'treasure'
  | 'start'
  | 'boss';

export interface Tile {
  type: TileType;
  explored: boolean;
  visible: boolean;
  /**
   * Region type describes whether this tile belongs to a carved room or corridor space.
   * Walls may not have a regionType, but passable tiles should always carry one so that
   * searches and secret door placement can reason about connectivity.
   */
  regionType?: 'room' | 'corridor';
  /** Flood-fill component identifier for the passable region this tile belongs to. */
  regionId?: number;
  /** Whether a hidden feature (trap/secret door) has been revealed. */
  revealed?: boolean;
  /**
   * When a secret door is placed, we remember which two regions it would connect so that
   * revealing the door can relabel the dungeon consistently.
   */
  secretDoorLinks?: [number, number];
  /** Whether a trap has already been triggered. */
  triggered?: boolean;
  monsterId?: string | null;
  lootId?: string | null;
}

export type Tier = 'minion' | 'elite' | 'boss';

export interface MonsterArchetype {
  id: string;
  name: string;
  glyph: string;
  maxHP: number;
  atk: number;
  def: number;
  gold: number;
  tier?: Tier;
}

export interface MonsterInstance {
  id: string;
  archetypeId: string;
  hp: number;
  pos: { x: number; y: number };
}

export interface CombatState {
  active: boolean;
  monsterId: string | null;
  lastHitAt?: number;
}

export type FacingDirection = 'north' | 'south' | 'east' | 'west';

export interface PlayerState {
  x: number;
  y: number;
  facing: FacingDirection;
  hp: number;
  maxHP: number;
  atk: number;
  def: number;
  gold: number;
}

export interface GameState {
  gridSize: number;
  tiles: Tile[][];
  player: PlayerState;
  monstersById: Record<string, MonsterInstance>;
  archetypesById: Record<string, MonsterArchetype>;
  combat: CombatState;
  log: string[];
  inventory: string[];
}
