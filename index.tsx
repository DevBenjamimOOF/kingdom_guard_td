import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// --- TYPES ---
enum TowerType {
  NORMAL = 'NORMAL',
  FIRE = 'FIRE',
  SLOW = 'SLOW',
  AOE = 'AOE',
  SUPPORT = 'SUPPORT',
  WALL = 'WALL',
  DELETE = 'DELETE'
}

enum EnemyType {
  NORMAL = 'NORMAL',
  FAST = 'FAST',
  TANK = 'TANK',
  BOSS = 'BOSS'
}

enum MapType {
  FREE = 'FREE',
  SNAKE = 'SNAKE',
  SPIRAL = 'SPIRAL'
}

interface GridPos {
  r: number;
  c: number;
}

interface TowerConfig {
  type: TowerType;
  name: string;
  cost: number;
  range: number;
  damage: number;
  cooldown: number;
  color: string;
  description: string;
}

interface EnemyConfig {
  type: EnemyType;
  hp: number;
  speed: number;
  reward: number;
  color: string;
  size: number;
}

interface Projectile {
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

interface Decoration {
  r: number;
  c: number;
  type: 'grass' | 'flower' | 'tree';
  color: string;
  offsetX: number;
  offsetY: number;
}

interface EnemyInstance {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  targetIdx: number;
  slowTimer: number;
  fireTimer: number;
  distanceTraveled: number;
}

interface TowerInstance {
  id: string;
  type: TowerType;
  r: number;
  c: number;
  level: number;
  cooldown: number;
}

// --- CONSTANTS ---
const GRID_SIZE = 24;
const BASE_HP = 20;
const STARTING_MONEY = 150;

const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  [TowerType.NORMAL]: { type: TowerType.NORMAL, name: 'Arqueiro', cost: 20, range: 4.5, damage: 8, cooldown: 30, color: '#3498db', description: 'Dano balanceado e longo alcance.' },
  [TowerType.FIRE]: { type: TowerType.FIRE, name: 'Mago de Fogo', cost: 45, range: 3.5, damage: 10, cooldown: 45, color: '#e74c3c', description: 'Queima os alvos por 2 segundos.' },
  [TowerType.SLOW]: { type: TowerType.SLOW, name: 'Mago de Gelo', cost: 40, range: 3.5, damage: 4, cooldown: 40, color: '#1abc9c', description: 'Reduz a velocidade em 50%.' },
  [TowerType.AOE]: { type: TowerType.AOE, name: 'Canhão', cost: 60, range: 4, damage: 20, cooldown: 70, color: '#f1c40f', description: 'Dano em área massivo.' },
  [TowerType.SUPPORT]: { type: TowerType.SUPPORT, name: 'Santuário', cost: 50, range: 3, damage: 0, cooldown: 0, color: '#9b59b6', description: 'Aumenta dano de torres próximas.' },
  [TowerType.WALL]: { type: TowerType.WALL, name: 'Muralha', cost: 5, range: 0, damage: 0, cooldown: 0, color: '#7f8c8d', description: 'Bloqueia o caminho.' },
  [TowerType.DELETE]: { type: TowerType.DELETE, name: 'Vender', cost: 0, range: 0, damage: 0, cooldown: 0, color: '#ff4444', description: 'Recupere 50% do custo.' }
};

const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  [EnemyType.NORMAL]: { type: EnemyType.NORMAL, hp: 40, speed: 1.0, reward: 3, color: '#ecf0f1', size: 0.35 },
  [EnemyType.FAST]: { type: EnemyType.FAST, hp: 20, speed: 2.2, reward: 5, color: '#f39c12', size: 0.25 },
  [EnemyType.TANK]: { type: EnemyType.TANK, hp: 250, speed: 0.5, reward: 12, color: '#2c3e50', size: 0.45 },
  [EnemyType.BOSS]: { type: EnemyType.BOSS, hp: 1500, speed: 0.8, reward: 50, color: '#c0392b', size: 0.65 }
};

// --- UTILS ---
function getShortestPath(grid: number[][], start: GridPos, end: GridPos): GridPos[] | null {
  const rows = grid.length;
  const cols = grid[0].length;
  const queue: GridPos[] = [start];
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  visited.add(`${start.r},${start.c}`);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.r === end.r && current.c === end.c) {
      const path: GridPos[] = [];
      let currStr = `${end.r},${end.c}`;
      while (currStr) {
        const [r, c] = currStr.split(',').map(Number);
        path.unshift({ r, c });
        currStr = parent.get(currStr) || '';
      }
      return path;
    }
    const neighbors = [{ r: current.r - 1, c: current.c }, { r: current.r + 1, c: current.c }, { r: current.r, c: current.c - 1 }, { r: current.r, c: current.c + 1 }];
    for (const n of neighbors) {
      const key = `${n.r},${n.c}`;
      if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols && grid[n.r][n.c] === 0 && !visited.has(key)) {
        visited.add(key);
        parent.set(key, `${current.r},${current.c}`);
        queue.push(n);
      }
    }
  }
  return null;
}

// --- AUDIO SERVICE ---
class AudioService {
  private ctx: AudioContext | null = null;
  private init() { if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
  playShoot() { this.playTone(440, 'sine', 0.1, 0.05); }
  playExplosion() { this.playTone(100, 'sawtooth', 0.3, 0.1); }
  playBuild() { this.playTone(600, 'triangle', 0.1, 0.05); }
  playHurt() { this.playTone(150, 'square', 0.2, 0.1); }
  playCoin() { this.playTone(880, 'sine', 0.1, 0.05); }
}
const audioService = new AudioService();

// --- APP COMPONENT ---
const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentMap, setCurrentMap] = useState<MapType | null>(null);
  const [money, setMoney] = useState(STARTING_MONEY);
  const [hp, setHp] = useState(BASE_HP);
  const [wave, setWave] = useState(1);
  const [selectedTower, setSelectedTower] = useState<TowerType>(TowerType.NORMAL);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWaveActive, setIsWaveActive] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<'tower' | 'enemy' | null>(null);

  const gameState = useRef({
    grid: Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0)),
    towers: [] as TowerInstance[],
    enemies: [] as EnemyInstance[],
    projectiles: [] as Projectile[],
    path: [] as GridPos[],
    spawnQueue: [] as EnemyType[],
    spawnTimer: 0,
    waveActive: false,
    money: STARTING_MONEY,
    hp: BASE_HP,
    wave: 1,
    decorations: [] as Decoration[]
  });

  const startPos = useMemo(() => ({ r: 0, c: 0 }), []);
  const endPos = useMemo(() => ({ r: GRID_SIZE - 1, c: GRID_SIZE - 1 }), []);

  const initGame = (type: MapType) => {
    const state = gameState.current;
    state.grid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    state.towers = []; state.enemies = []; state.projectiles = []; state.decorations = [];
    
    // Ambient Decorations
    for (let i = 0; i < 80; i++) {
      const r = Math.floor(Math.random() * GRID_SIZE);
      const c = Math.floor(Math.random() * GRID_SIZE);
      const rand = Math.random();
      const decType = rand < 0.7 ? 'grass' : rand < 0.9 ? 'flower' : 'tree';
      const color = decType === 'grass' ? '#27ae60' : decType === 'flower' ? '#ec4899' : '#14532d';
      state.decorations.push({ r, c, type: decType as any, color, offsetX: Math.random() * 0.6 - 0.3, offsetY: Math.random() * 0.6 - 0.3 });
    }

    if (type === MapType.SNAKE) {
      const path: GridPos[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        if (r % 4 === 0) for (let c = 0; c < GRID_SIZE; c++) { path.push({ r, c }); state.grid[r][c] = 2; }
        else if (r % 4 === 2) for (let c = GRID_SIZE - 1; c >= 0; c--) { path.push({ r, c }); state.grid[r][c] = 2; }
        else if (r % 4 === 1) { path.push({ r, c: GRID_SIZE - 1 }); state.grid[r][GRID_SIZE - 1] = 2; }
        else { path.push({ r, c: 0 }); state.grid[r][0] = 2; }
      }
      if (path[path.length - 1].c === 0) for (let c = 1; c < GRID_SIZE; c++) { path.push({ r: endPos.r, c }); state.grid[endPos.r][c] = 2; }
      state.path = path;
    } else if (type === MapType.SPIRAL) {
      const path: GridPos[] = [];
      const m = 2;
      for (let c = 0; c < GRID_SIZE - m; c++) path.push({ r: m, c });
      for (let r = m + 1; r < GRID_SIZE - m; r++) path.push({ r, c: GRID_SIZE - m - 1 });
      for (let c = GRID_SIZE - m - 2; c >= m; c--) path.push({ r: GRID_SIZE - m - 1, c });
      for (let r = GRID_SIZE - m; r < GRID_SIZE; r++) path.push({ r, c: m });
      for (let c = m + 1; c <= endPos.c; c++) path.push({ r: endPos.r, c });
      path.forEach(p => state.grid[p.r][p.c] = 2);
      state.path = path;
    } else {
      state.path = getShortestPath(state.grid, startPos, endPos) || [];
    }
    
    setMoney(STARTING_MONEY); setHp(BASE_HP); setWave(1); setIsWaveActive(false); setIsGameOver(false);
    setCurrentMap(type);
    state.money = STARTING_MONEY; state.hp = BASE_HP; state.wave = 1;
  };

  const spawnWave = useCallback(() => {
    if (gameState.current.waveActive) return;
    const w = gameState.current.wave;
    const queue: EnemyType[] = [];
    const count = 8 + w * 4;
    for (let i = 0; i < count; i++) {
      if (w % 5 === 0 && i === count - 1) queue.push(EnemyType.BOSS);
      else if (i % 4 === 0 && w > 2) queue.push(EnemyType.TANK);
      else if (i % 3 === 0 && w > 1) queue.push(EnemyType.FAST);
      else queue.push(EnemyType.NORMAL);
    }
    gameState.current.spawnQueue = queue;
    gameState.current.waveActive = true;
    setIsWaveActive(true);
  }, []);

  const getGridCoords = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const cellSize = canvas.width / GRID_SIZE;
    return { r: Math.floor(y / cellSize), c: Math.floor(x / cellSize), x, y };
  };

  const handleClick = (e: any) => {
    if (isGameOver) return;
    const coords = getGridCoords(e);
    if (!coords) return;
    const { r, c, x, y } = coords;
    const state = gameState.current;
    const cellSize = canvasRef.current!.width / GRID_SIZE;

    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;

    // Select Enemy
    let clickedEnemy = state.enemies.find(en => {
        const ex = (en.x + 0.5) * cellSize;
        const ey = (en.y + 0.5) * cellSize;
        return Math.sqrt((x - ex)**2 + (y - ey)**2) < cellSize;
    });
    if (clickedEnemy) { setSelectedObjectId(clickedEnemy.id); setSelectedObjectType('enemy'); return; }

    // Select/Build Tower
    let clickedTower = state.towers.find(t => t.r === r && t.c === c);
    if (clickedTower) {
        if (selectedTower === TowerType.DELETE) {
            state.grid[r][c] = 0;
            state.money += Math.floor(TOWER_CONFIGS[clickedTower.type].cost * 0.5);
            setMoney(state.money);
            state.towers = state.towers.filter(t => t.id !== clickedTower!.id);
            audioService.playCoin();
            if (currentMap === MapType.FREE) state.path = getShortestPath(state.grid, startPos, endPos) || state.path;
            setSelectedObjectId(null);
        } else {
            setSelectedObjectId(clickedTower.id);
            setSelectedObjectType('tower');
        }
        return;
    }

    if (selectedTower !== TowerType.DELETE && state.grid[r][c] === 0) {
        if ((r === startPos.r && c === startPos.c) || (r === endPos.r && c === endPos.c)) return;
        const config = TOWER_CONFIGS[selectedTower];
        if (state.money >= config.cost) {
            state.grid[r][c] = 1;
            if (currentMap === MapType.FREE) {
                const newPath = getShortestPath(state.grid, startPos, endPos);
                if (!newPath) { state.grid[r][c] = 0; return; }
                state.path = newPath;
            }
            state.money -= config.cost; setMoney(state.money);
            state.towers.push({ id: Math.random().toString(36).substring(7), type: selectedTower, r, c, level: 1, cooldown: 0 });
            audioService.playBuild();
        }
    }
  };

  useEffect(() => {
    if (!currentMap || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let frameId: number;

    const loop = () => {
      if (isGameOver) return;
      const state = gameState.current;
      const cellSize = canvas.width / GRID_SIZE;

      // Update Spawning
      if (state.waveActive && state.spawnQueue.length > 0) {
        state.spawnTimer++;
        if (state.spawnTimer > 45) {
          const type = state.spawnQueue.shift()!;
          const cfg = ENEMY_CONFIGS[type];
          const hpBoost = 1 + (state.wave * 0.2);
          state.enemies.push({ id: Math.random().toString(36).substring(7), type, x: state.path[0].c, y: state.path[0].r, hp: cfg.hp * hpBoost, maxHp: cfg.hp * hpBoost, targetIdx: 1, slowTimer: 0, fireTimer: 0, distanceTraveled: 0 });
          state.spawnTimer = 0;
        }
      }

      // Update Enemies
      state.enemies.forEach((en, i) => {
        const cfg = ENEMY_CONFIGS[en.type];
        let spd = cfg.speed / 20;
        if (en.slowTimer > 0) { spd *= 0.5; en.slowTimer--; }
        if (en.fireTimer > 0) { en.hp -= 0.15; en.fireTimer--; }
        const target = state.path[en.targetIdx];
        if (target) {
          const dx = target.c - en.x, dy = target.r - en.y, dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < spd) { en.x = target.c; en.y = target.r; if (en.targetIdx < state.path.length-1) en.targetIdx++; else { state.hp--; setHp(state.hp); state.enemies.splice(i, 1); audioService.playHurt(); if (state.hp <= 0) setIsGameOver(true); } }
          else { en.x += (dx/dist)*spd; en.y += (dy/dist)*spd; }
        }
        if (en.hp <= 0) { state.money += cfg.reward; setMoney(state.money); audioService.playCoin(); state.enemies.splice(i, 1); }
      });

      // Update Towers
      state.towers.forEach(t => {
        if (t.cooldown > 0) t.cooldown--;
        else if (t.type !== TowerType.SUPPORT && t.type !== TowerType.WALL) {
          const cfg = TOWER_CONFIGS[t.type];
          const target = state.enemies.find(e => Math.sqrt((e.x - t.c)**2 + (e.y - t.r)**2) <= cfg.range);
          if (target) {
            let dmgMult = 1;
            state.towers.forEach(s => { if (s.type === TowerType.SUPPORT && Math.sqrt((s.c - t.c)**2 + (s.r - t.r)**2) <= TOWER_CONFIGS[TowerType.SUPPORT].range) dmgMult += 0.4; });
            state.projectiles.push({ x: t.c + 0.5, y: t.r + 0.5, targetId: target.id, damage: cfg.damage * dmgMult, speed: 0.35, color: cfg.color, isAoE: t.type === TowerType.AOE, aoeRange: 1.5, isFire: t.type === TowerType.FIRE, isSlow: t.type === TowerType.SLOW });
            t.cooldown = cfg.cooldown; audioService.playShoot();
          }
        }
      });

      // Update Projectiles
      state.projectiles.forEach((p, i) => {
        const target = state.enemies.find(e => e.id === p.targetId);
        if (!target) { state.projectiles.splice(i, 1); return; }
        const dx = (target.x + 0.5) - p.x, dy = (target.y + 0.5) - p.y, dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < p.speed) {
          if (p.isAoE) { audioService.playExplosion(); state.enemies.forEach(e => { if (Math.sqrt((e.x - target.x)**2 + (e.y - target.y)**2) <= p.aoeRange!) e.hp -= p.damage; }); }
          else { target.hp -= p.damage; if (p.isFire) target.fireTimer = 120; if (p.isSlow) target.slowTimer = 90; }
          state.projectiles.splice(i, 1);
        } else { p.x += (dx/dist)*p.speed; p.y += (dy/dist)*p.speed; }
      });

      if (state.waveActive && state.enemies.length === 0 && state.spawnQueue.length === 0) {
        state.waveActive = false; setIsWaveActive(false); state.wave++; setWave(state.wave); state.money += 30; setMoney(state.money);
      }

      // DRAW
      ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      state.decorations.forEach(d => { ctx.fillStyle = d.color; const x = (d.c + 0.5 + d.offsetX) * cellSize, y = (d.r + 0.5 + d.offsetY) * cellSize; if (d.type === 'tree') { ctx.beginPath(); ctx.arc(x, y, cellSize*0.4, 0, Math.PI*2); ctx.fill(); } else ctx.fillRect(x, y, 2, 2); });
      ctx.fillStyle = '#451a03'; state.path.forEach(p => ctx.fillRect(p.c * cellSize, p.r * cellSize, cellSize, cellSize));
      ctx.fillStyle = '#22c55e'; ctx.fillRect(state.path[0].c*cellSize, state.path[0].r*cellSize, cellSize, cellSize);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(endPos.c*cellSize, endPos.r*cellSize, cellSize, cellSize);

      state.enemies.forEach(e => {
        const cfg = ENEMY_CONFIGS[e.type]; ctx.fillStyle = e.slowTimer > 0 ? '#1abc9c' : cfg.color;
        const ex = (e.x + 0.5) * cellSize, ey = (e.y + 0.5) * cellSize, sz = cfg.size * cellSize;
        ctx.beginPath(); if (e.type === EnemyType.BOSS) ctx.rect(ex-sz, ey-sz, sz*2, sz*2); else ctx.arc(ex, ey, sz, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(ex-cellSize/3, ey-cellSize/2-4, cellSize*2/3, 2);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(ex-cellSize/3, ey-cellSize/2-4, (e.hp/e.maxHp)*cellSize*2/3, 2);
      });

      state.towers.forEach(t => {
        const cfg = TOWER_CONFIGS[t.type]; ctx.fillStyle = cfg.color;
        const tx = (t.c + 0.5) * cellSize, ty = (t.r + 0.5) * cellSize;
        ctx.beginPath();
        if (t.type === TowerType.WALL) ctx.rect(t.c*cellSize+2, t.r*cellSize+2, cellSize-4, cellSize-4);
        else if (t.type === TowerType.SUPPORT) { ctx.arc(tx, ty, cellSize/3, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='white'; ctx.stroke(); }
        else { ctx.moveTo(tx, ty-cellSize/2.5); ctx.lineTo(tx+cellSize/2.5, ty+cellSize/2.5); ctx.lineTo(tx-cellSize/2.5, ty+cellSize/2.5); ctx.closePath(); }
        ctx.fill();
      });

      state.projectiles.forEach(p => { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x * cellSize, p.y * cellSize, 3, 0, Math.PI*2); ctx.fill(); });
      if (selectedObjectId) {
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
        if (selectedObjectType === 'tower') {
          const t = state.towers.find(t => t.id === selectedObjectId);
          if (t) { ctx.strokeRect(t.c*cellSize, t.r*cellSize, cellSize, cellSize); ctx.beginPath(); ctx.setLineDash([5,5]); ctx.arc((t.c+0.5)*cellSize, (t.r+0.5)*cellSize, TOWER_CONFIGS[t.type].range*cellSize, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
        }
      }

      frameId = requestAnimationFrame(loop);
    };
    loop(); return () => cancelAnimationFrame(frameId);
  }, [currentMap, isGameOver, selectedObjectId]);

  if (!currentMap) {
    return (
      <div className="flex flex-col h-screen bg-slate-950 items-center justify-center text-white p-6">
        <h1 className="text-5xl font-black mb-2 text-yellow-500 text-center tracking-tighter">KINGDOM GUARD</h1>
        <p className="text-slate-400 mb-12 text-sm uppercase tracking-widest font-bold">Tower Defense Edition</p>
        <div className="grid gap-4 w-full max-w-xs">
          <button onClick={() => initGame(MapType.FREE)} className="bg-emerald-600 p-6 rounded-2xl font-black text-lg hover:bg-emerald-500 shadow-xl transition-all">CAMINHO LIVRE</button>
          <button onClick={() => initGame(MapType.SNAKE)} className="bg-blue-600 p-6 rounded-2xl font-black text-lg hover:bg-blue-500 shadow-xl transition-all">ESTRADA SERPENTE</button>
          <button onClick={() => initGame(MapType.SPIRAL)} className="bg-purple-600 p-6 rounded-2xl font-black text-lg hover:bg-purple-500 shadow-xl transition-all">LOOP ESPIRAL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white select-none">
      <div className="flex justify-between items-center p-4 bg-slate-800 border-b border-slate-700 z-20">
        <div className="flex gap-6">
          <div className="flex flex-col"><span className="text-[10px] text-slate-400 font-bold">VIDAS</span><span className="text-xl font-black text-red-500">❤️ {hp}</span></div>
          <div className="flex flex-col"><span className="text-[10px] text-slate-400 font-bold">OURO</span><span className="text-xl font-black text-yellow-400">💰 {money}</span></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center"><span className="text-[10px] text-slate-400 font-bold">ONDA</span><div className="text-xl font-black">{wave}</div></div>
          {!isWaveActive && <button onClick={spawnWave} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-2 rounded-xl font-black shadow-lg">COMEÇAR</button>}
        </div>
        <button onClick={() => setCurrentMap(null)} className="text-[10px] bg-slate-700 px-3 py-1 rounded uppercase font-bold">Menu</button>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-2 bg-slate-950 min-h-0">
        <canvas ref={canvasRef} width={800} height={800} onClick={handleClick} onTouchStart={handleClick} className="max-w-full max-h-full aspect-square bg-slate-900 shadow-2xl rounded-lg cursor-crosshair border-2 border-slate-800" />
        {isGameOver && <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 z-50 text-center"><h1 className="text-7xl font-black text-red-600 mb-4">DERROTA</h1><button onClick={() => setCurrentMap(null)} className="bg-white text-black font-black py-4 px-10 rounded-2xl">RECOMEÇAR</button></div>}
      </div>

      <div className="bg-slate-800 p-4 border-t border-slate-700 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 justify-center min-w-max">
          {(Object.keys(TOWER_CONFIGS) as TowerType[]).map(type => {
            const cfg = TOWER_CONFIGS[type]; const active = selectedTower === type;
            return (
              <button key={type} onClick={() => setSelectedTower(type)} className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all w-24 ${active ? 'border-yellow-400 bg-slate-700' : 'border-transparent bg-slate-900'} ${money < cfg.cost && type !== TowerType.DELETE ? 'opacity-40 grayscale' : 'hover:scale-105'}`}>
                <div className="w-8 h-8 mb-1" style={{ color: cfg.color }}>
                  <svg viewBox="0 0 24 24" fill="currentColor">{type === TowerType.DELETE ? <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /> : <path d="M12 2L4 8V22H20V8L12 2Z" />}</svg>
                </div>
                <span className="text-[10px] font-black uppercase truncate w-full text-center">{cfg.name}</span>
                <span className="text-[10px] font-bold text-yellow-500">{type === TowerType.DELETE ? 'SELL' : `💰${cfg.cost}`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);