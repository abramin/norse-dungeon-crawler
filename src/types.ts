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
  revealed?: boolean;
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

export interface PlayerState {
  x: number;
  y: number;
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
