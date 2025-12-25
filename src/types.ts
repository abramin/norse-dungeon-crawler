export type ItemEffect = 'heal' | 'attack' | 'defense' | 'maxHealth';

export interface Item {
  name: string;
  effect: ItemEffect;
  value: number;
  icon: string;
}

export interface Enemy {
  name: string;
  health: number;
  attack: number;
  defense: number;
  gold: number;
}

export type TileType = 'start' | 'boss' | 'enemy' | 'treasure' | 'item' | 'puzzle' | 'empty';

export interface DungeonTile {
  type: TileType;
  enemy?: Enemy;
  item?: Item;
  riddle?: Riddle;
}

export interface PlayerState {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  gold: number;
  inventory: Item[];
}

export interface CombatState extends Enemy {
  maxHealth: number;
}

export interface PuzzleState {
  question: string;
  answer: string;
  reward: string;
}

export type NotificationType =
  | 'info'
  | 'combat'
  | 'boss'
  | 'treasure'
  | 'item'
  | 'puzzle'
  | 'victory'
  | 'defeat'
  | 'success';

export interface NotificationState {
  message: string;
  type: NotificationType;
}
