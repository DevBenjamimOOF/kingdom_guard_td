
import { TowerType, EnemyType, TowerConfig, EnemyConfig } from './types';

export const GRID_SIZE = 24;
export const BASE_HP = 20;
export const STARTING_MONEY = 100;

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  [TowerType.NORMAL]: {
    type: TowerType.NORMAL,
    name: 'Arrow Tower',
    cost: 20,
    range: 4,
    damage: 5,
    cooldown: 30,
    color: '#3498db',
    description: 'Balanced damage and speed'
  },
  [TowerType.FIRE]: {
    type: TowerType.FIRE,
    name: 'Fire Mage',
    cost: 40,
    range: 3.5,
    damage: 6,
    cooldown: 45,
    color: '#e74c3c',
    description: 'Burns targets for 2 seconds'
  },
  [TowerType.SLOW]: {
    type: TowerType.SLOW,
    name: 'Ice Mage',
    cost: 35,
    range: 3,
    damage: 2,
    cooldown: 40,
    color: '#1abc9c',
    description: 'Slows targets by 50 percent'
  },
  [TowerType.AOE]: {
    type: TowerType.AOE,
    name: 'Bomb Tower',
    cost: 50,
    range: 3.5,
    damage: 15,
    cooldown: 60,
    color: '#f1c40f',
    description: 'Deals damage in an area'
  },
  [TowerType.SUPPORT]: {
    type: TowerType.SUPPORT,
    name: 'Shrine',
    cost: 45,
    range: 2.5,
    damage: 0,
    cooldown: 0,
    color: '#9b59b6',
    description: 'Boosts nearby tower damage'
  },
  [TowerType.WALL]: {
    type: TowerType.WALL,
    name: 'Stone Wall',
    cost: 5,
    range: 0,
    damage: 0,
    cooldown: 0,
    color: '#7f8c8d',
    description: 'Blocks enemy pathing'
  },
  [TowerType.DELETE]: {
    type: TowerType.DELETE,
    name: 'Sell Tool',
    cost: 0,
    range: 0,
    damage: 0,
    cooldown: 0,
    color: '#ff4444',
    description: 'Sell construction for half price'
  }
};

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  [EnemyType.NORMAL]: {
    type: EnemyType.NORMAL,
    hp: 30,
    speed: 1.0,
    reward: 2,
    color: '#ecf0f1',
    size: 0.35
  },
  [EnemyType.FAST]: {
    type: EnemyType.FAST,
    hp: 15,
    speed: 2.0,
    reward: 5,
    color: '#f39c12',
    size: 0.25
  },
  [EnemyType.TANK]: {
    type: EnemyType.TANK,
    hp: 180,
    speed: 0.5,
    reward: 10,
    color: '#2c3e50',
    size: 0.45
  },
  [EnemyType.BOSS]: {
    type: EnemyType.BOSS,
    hp: 1000,
    speed: 0.8,
    reward: 20,
    color: '#c0392b',
    size: 0.6
  }
};
