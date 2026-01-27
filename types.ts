
export enum TowerType {
  NORMAL = 'NORMAL',
  FIRE = 'FIRE',
  SLOW = 'SLOW',
  AOE = 'AOE',
  SUPPORT = 'SUPPORT',
  WALL = 'WALL',
  DELETE = 'DELETE'
}

export enum EnemyType {
  NORMAL = 'NORMAL',
  FAST = 'FAST',
  TANK = 'TANK',
  BOSS = 'BOSS'
}

export enum MapType {
  FREE = 'FREE',
  SNAKE = 'SNAKE',
  SPIRAL = 'SPIRAL'
}

export interface Point {
  x: number;
  y: number;
}

export interface GridPos {
  r: number;
  c: number;
}

export interface TowerConfig {
  type: TowerType;
  name: string;
  cost: number;
  range: number;
  damage: number;
  cooldown: number; // in frames
  color: string;
  description: string;
}

export interface EnemyConfig {
  type: EnemyType;
  hp: number;
  speed: number;
  reward: number;
  color: string;
  size: number;
}

export interface Projectile {
  x: number;
  y: number;
  targetId: string;
  damage: number;
  speed: number;
  color: string;
  isAoE?: boolean;
  aoeRange?: number;
  isFire?: boolean;
  isSlow?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Decoration {
  r: number;
  c: number;
  type: 'grass' | 'flower' | 'tree';
  color: string;
  offsetX: number;
  offsetY: number;
}
