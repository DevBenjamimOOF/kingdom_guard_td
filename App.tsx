
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  TowerType, 
  EnemyType, 
  MapType,
  GridPos, 
  Point, 
  Projectile, 
  Particle,
  Decoration
} from './types';
import { 
  GRID_SIZE, 
  BASE_HP, 
  STARTING_MONEY, 
  TOWER_CONFIGS, 
  ENEMY_CONFIGS 
} from './constants';
import { getShortestPath } from './pathfinding';
import { audioService } from './services/audioService';

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

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentMap, setCurrentMap] = useState<MapType | null>(null);
  const [money, setMoney] = useState(STARTING_MONEY);
  const [hp, setHp] = useState(BASE_HP);
  const [wave, setWave] = useState(1);
  const [enemiesLeftInWave, setEnemiesLeftInWave] = useState(0);
  const [selectedTower, setSelectedTower] = useState<TowerType>(TowerType.NORMAL);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hoverPos, setHoverPos] = useState<GridPos | null>(null);
  const [isWaveActive, setIsWaveActive] = useState(false);
  
  // Selection state
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<'tower' | 'enemy' | null>(null);

  const gameState = useRef({
    grid: Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0)),
    towers: [] as TowerInstance[],
    enemies: [] as EnemyInstance[],
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
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

  const generateMap = (type: MapType) => {
    const state = gameState.current;
    state.grid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    state.towers = [];
    state.enemies = [];
    state.projectiles = [];
    state.particles = [];
    
    // Create decorations
    state.decorations = [];
    for (let i = 0; i < 60; i++) {
      const r = Math.floor(Math.random() * GRID_SIZE);
      const c = Math.floor(Math.random() * GRID_SIZE);
      const rand = Math.random();
      const decType = rand < 0.7 ? 'grass' : rand < 0.9 ? 'flower' : 'tree';
      const color = decType === 'grass' ? '#27ae60' : decType === 'flower' ? '#e91e63' : '#1e5a2d';
      state.decorations.push({
        r, c, type: decType as any, color,
        offsetX: Math.random() * 0.6 - 0.3,
        offsetY: Math.random() * 0.6 - 0.3
      });
    }

    if (type === MapType.SNAKE) {
      const path: GridPos[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        // Even horizontal bands (0, 4, 8...) go left to right
        if (r % 4 === 0) {
          for (let c = 0; c < GRID_SIZE; c++) { path.push({ r, c }); state.grid[r][c] = 2; }
        } 
        // Odd horizontal bands (2, 6, 10...) go right to left
        else if (r % 4 === 2) {
          for (let c = GRID_SIZE - 1; c >= 0; c--) { path.push({ r, c }); state.grid[r][c] = 2; }
        } 
        // Connectors on the right
        else if (r % 4 === 1) {
          path.push({ r, c: GRID_SIZE - 1 }); state.grid[r][GRID_SIZE - 1] = 2;
        } 
        // Connectors on the left
        else {
          path.push({ r, c: 0 }); state.grid[r][0] = 2;
        }
      }
      
      // Ensure it reaches exactly the red goal at (GRID_SIZE-1, GRID_SIZE-1)
      const last = path[path.length - 1];
      if (last.r !== endPos.r || last.c !== endPos.c) {
          // If we ended on the left (at c=0), we need to cross the bottom row to reach the exit
          if (last.c === 0) {
              for (let c = 1; c < GRID_SIZE; c++) { path.push({ r: endPos.r, c }); state.grid[endPos.r][c] = 2; }
          }
      }

      state.path = path;
    } else if (type === MapType.SPIRAL) {
      const path: GridPos[] = [];
      const margin = 2;
      for (let c = 0; c < GRID_SIZE - margin; c++) path.push({ r: margin, c });
      for (let r = margin + 1; r < GRID_SIZE - margin; r++) path.push({ r, c: GRID_SIZE - margin - 1 });
      for (let c = GRID_SIZE - margin - 2; c >= margin; c--) path.push({ r: GRID_SIZE - margin - 1, c });
      for (let r = GRID_SIZE - margin; r < GRID_SIZE; r++) path.push({ r, c: margin });
      // Final segment to end
      if (path[path.length-1].c !== endPos.c) {
          for (let c = margin + 1; c <= endPos.c; c++) path.push({ r: endPos.r, c });
      }
      
      path.forEach(p => state.grid[p.r][p.c] = 2);
      state.path = path;
    } else {
      state.path = getShortestPath(state.grid, startPos, endPos) || [];
    }
    
    setMoney(STARTING_MONEY);
    setHp(BASE_HP);
    setWave(1);
    setIsWaveActive(false);
    setIsGameOver(false);
    setSelectedObjectId(null);
    setSelectedObjectType(null);
    setCurrentMap(type);
  };

  const spawnWave = useCallback(() => {
    if (gameState.current.waveActive) return;
    const w = gameState.current.wave;
    const queue: EnemyType[] = [];
    const count = 5 + w * 3;
    for (let i = 0; i < count; i++) {
      if (w % 5 === 0 && i === count - 1) queue.push(EnemyType.BOSS);
      else if (i % 5 === 0 && w > 2) queue.push(EnemyType.TANK);
      else if (i % 3 === 0 && w > 1) queue.push(EnemyType.FAST);
      else queue.push(EnemyType.NORMAL);
    }
    gameState.current.spawnQueue = queue;
    gameState.current.waveActive = true;
    setIsWaveActive(true);
    setEnemiesLeftInWave(queue.length);
  }, []);

  const getGridCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Using any cast to avoid non-overlapping type errors between React and Native events
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const cellSize = canvas.width / GRID_SIZE;
    return { r: Math.floor(y / cellSize), c: Math.floor(x / cellSize), x, y };
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isGameOver) return;
    const coords = getGridCoords(e);
    if (!coords) return;
    const { r, c, x, y } = coords;
    const state = gameState.current;
    const cellSize = canvasRef.current!.width / GRID_SIZE;

    // Boundary check
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;

    // Check if clicked an enemy for selection
    let clickedEnemy = state.enemies.find(en => {
        const ex = en.x * cellSize + cellSize/2;
        const ey = en.y * cellSize + cellSize/2;
        const dist = Math.sqrt((x - ex)**2 + (y - ey)**2);
        return dist < cellSize;
    });

    if (clickedEnemy) {
        setSelectedObjectId(clickedEnemy.id);
        setSelectedObjectType('enemy');
        return;
    }

    // Check if clicked a tower for selection
    let clickedTower = state.towers.find(t => t.r === r && t.c === c);
    if (clickedTower) {
        setSelectedObjectId(clickedTower.id);
        setSelectedObjectType('tower');
        if (selectedTower === TowerType.DELETE) {
            const refund = Math.floor(TOWER_CONFIGS[clickedTower.type].cost * 0.5);
            state.grid[r][c] = 0;
            state.towers = state.towers.filter(t => t.id !== clickedTower!.id);
            state.money += refund;
            setMoney(state.money);
            audioService.playCoin();
            if (currentMap === MapType.FREE) {
                const newPath = getShortestPath(state.grid, startPos, endPos);
                if (newPath) state.path = newPath;
            }
            setSelectedObjectId(null);
            setSelectedObjectType(null);
        }
        return;
    }

    // Build logic
    if (selectedTower === TowerType.DELETE) return;
    if (state.grid[r][c] !== 0) return;
    if ((r === startPos.r && c === startPos.c) || (r === endPos.r && c === endPos.c)) return;

    const config = TOWER_CONFIGS[selectedTower];
    if (state.money < config.cost) return;

    state.grid[r][c] = 1;
    if (currentMap === MapType.FREE) {
        const newPath = getShortestPath(state.grid, startPos, endPos);
        if (!newPath) {
            state.grid[r][c] = 0;
            return;
        }
        state.path = newPath;
    }

    state.money -= config.cost;
    setMoney(state.money);
    state.towers.push({
      id: Math.random().toString(36).substr(2, 9),
      type: selectedTower,
      r, c, level: 1, cooldown: 0
    });
    audioService.playBuild();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getGridCoords(e);
    if (coords) {
      setHoverPos({ r: coords.r, c: coords.c });
    }
  };

  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas || !currentMap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      if (isGameOver) return;
      const state = gameState.current;

      if (state.waveActive && state.spawnQueue.length > 0) {
        state.spawnTimer++;
        if (state.spawnTimer > 40) {
          const type = state.spawnQueue.shift()!;
          const config = ENEMY_CONFIGS[type];
          const scale = 1 + (state.wave * 0.15);
          state.enemies.push({
            id: Math.random().toString(36).substr(2, 9),
            type, x: state.path[0].c, y: state.path[0].r,
            hp: config.hp * scale, maxHp: config.hp * scale,
            targetIdx: 1, slowTimer: 0, fireTimer: 0, distanceTraveled: 0
          });
          state.spawnTimer = 0;
        }
      }

      state.enemies.forEach((enemy, index) => {
        const config = ENEMY_CONFIGS[enemy.type];
        let speed = config.speed / 20;
        if (enemy.slowTimer > 0) { speed *= 0.5; enemy.slowTimer--; }
        if (enemy.fireTimer > 0) { enemy.hp -= 0.1; enemy.fireTimer--; }

        const targetCell = state.path[enemy.targetIdx];
        if (targetCell) {
          const dx = targetCell.c - enemy.x;
          const dy = targetCell.r - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < speed) {
            enemy.x = targetCell.c;
            enemy.y = targetCell.r;
            if (enemy.targetIdx < state.path.length - 1) enemy.targetIdx++;
            else {
              state.hp -= (enemy.type === EnemyType.BOSS ? 10 : 1);
              setHp(state.hp);
              audioService.playHurt();
              state.enemies.splice(index, 1);
              setEnemiesLeftInWave(state.enemies.length + state.spawnQueue.length);
              if (state.hp <= 0) setIsGameOver(true);
            }
          } else {
            enemy.x += (dx / dist) * speed;
            enemy.y += (dy / dist) * speed;
          }
          enemy.distanceTraveled += speed;
        }

        if (enemy.hp <= 0) {
          state.money += config.reward;
          setMoney(state.money);
          audioService.playCoin();
          state.enemies.splice(index, 1);
          setEnemiesLeftInWave(state.enemies.length + state.spawnQueue.length);
        }
      });

      if (state.waveActive && state.enemies.length === 0 && state.spawnQueue.length === 0) {
        state.waveActive = false;
        setIsWaveActive(false);
        state.wave++;
        setWave(state.wave);
        state.money += 20 + state.wave * 5;
        setMoney(state.money);
      }

      state.towers.forEach(tower => {
        const config = TOWER_CONFIGS[tower.type];
        if (tower.cooldown > 0) tower.cooldown--;
        else if (tower.type !== TowerType.SUPPORT && tower.type !== TowerType.WALL) {
          let bestTarget = state.enemies.find(e => {
            const dist = Math.sqrt((e.x - tower.c)**2 + (e.y - tower.r)**2);
            return dist <= config.range;
          });

          if (bestTarget) {
            let dmgMult = 1;
            state.towers.forEach(other => {
              if (other.type === TowerType.SUPPORT) {
                const d = Math.sqrt((other.c - tower.c)**2 + (other.r - tower.r)**2);
                if (d <= TOWER_CONFIGS[TowerType.SUPPORT].range) dmgMult += 0.5;
              }
            });
            audioService.playShoot();
            state.projectiles.push({
              x: tower.c + 0.5, y: tower.r + 0.5, targetId: bestTarget.id,
              damage: config.damage * dmgMult, speed: 0.3, color: config.color,
              isAoE: tower.type === TowerType.AOE, aoeRange: 1.5,
              isFire: tower.type === TowerType.FIRE, isSlow: tower.type === TowerType.SLOW
            });
            tower.cooldown = config.cooldown;
          }
        }
      });

      state.projectiles.forEach((p, idx) => {
        const target = state.enemies.find(e => e.id === p.targetId);
        if (!target) { state.projectiles.splice(idx, 1); return; }
        const dx = target.x + 0.5 - p.x;
        const dy = target.y + 0.5 - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < p.speed) {
          if (p.isAoE) {
            audioService.playExplosion();
            state.enemies.forEach(e => {
              if (Math.sqrt((e.x - target.x)**2 + (e.y - target.y)**2) <= p.aoeRange!) e.hp -= p.damage;
            });
          } else {
            target.hp -= p.damage;
            if (p.isFire) target.fireTimer = 120;
            if (p.isSlow) target.slowTimer = 90;
          }
          state.projectiles.splice(idx, 1);
        } else {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
        }
      });
    };

    const draw = () => {
      const state = gameState.current;
      const cellSize = canvas.width / GRID_SIZE;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grass background
      ctx.fillStyle = '#1b4d1b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Decorations
      state.decorations.forEach(d => {
        ctx.fillStyle = d.color;
        const x = (d.c + 0.5 + d.offsetX) * cellSize;
        const y = (d.r + 0.5 + d.offsetY) * cellSize;
        if (d.type === 'tree') {
            ctx.beginPath();
            ctx.arc(x, y, cellSize*0.4, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillRect(x, y, 2, 2);
        }
      });

      // Path
      ctx.fillStyle = '#3e2723';
      state.path.forEach(p => ctx.fillRect(p.c * cellSize, p.r * cellSize, cellSize, cellSize));

      // Grid (Very Subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(canvas.width, i * cellSize); ctx.stroke();
      }

      // Start/End markers
      ctx.fillStyle = '#2ecc71'; 
      ctx.fillRect(state.path[0].c*cellSize, state.path[0].r*cellSize, cellSize, cellSize);
      ctx.fillStyle = '#e74c3c'; 
      ctx.fillRect(endPos.c*cellSize, endPos.r*cellSize, cellSize, cellSize);

      // Selection ring
      if (selectedObjectId) {
          ctx.strokeStyle = '#f1c40f';
          ctx.lineWidth = 2;
          if (selectedObjectType === 'tower') {
              const t = state.towers.find(t => t.id === selectedObjectId);
              if (t) {
                  ctx.strokeRect(t.c * cellSize, t.r * cellSize, cellSize, cellSize);
                  ctx.beginPath();
                  ctx.arc((t.c+0.5)*cellSize, (t.r+0.5)*cellSize, TOWER_CONFIGS[t.type].range * cellSize, 0, Math.PI*2);
                  ctx.setLineDash([5, 5]);
                  ctx.stroke();
                  ctx.setLineDash([]);
              }
          } else {
              const e = state.enemies.find(e => e.id === selectedObjectId);
              if (e) {
                  ctx.beginPath();
                  ctx.arc((e.x+0.5)*cellSize, (e.y+0.5)*cellSize, cellSize*0.6, 0, Math.PI*2);
                  ctx.stroke();
              }
          }
      }

      // Enemies
      state.enemies.forEach(e => {
        const config = ENEMY_CONFIGS[e.type];
        ctx.fillStyle = config.color;
        if (e.slowTimer > 0) ctx.fillStyle = '#1abc9c';
        const ex = e.x * cellSize + cellSize / 2;
        const ey = e.y * cellSize + cellSize / 2;
        const sz = config.size * cellSize;
        ctx.beginPath();
        if (e.type === EnemyType.BOSS) ctx.rect(ex-sz, ey-sz, sz*2, sz*2);
        else ctx.arc(ex, ey, sz, 0, Math.PI*2);
        ctx.fill();
        // HP bar
        ctx.fillStyle = '#000'; ctx.fillRect(ex-cellSize/3, ey-cellSize/2-4, cellSize*2/3, 2);
        ctx.fillStyle = '#2ecc71'; ctx.fillRect(ex-cellSize/3, ey-cellSize/2-4, (e.hp/e.maxHp)*cellSize*2/3, 2);
      });

      // Towers
      state.towers.forEach(t => {
        const config = TOWER_CONFIGS[t.type];
        ctx.fillStyle = config.color;
        const tx = t.c * cellSize + cellSize / 2;
        const ty = t.r * cellSize + cellSize / 2;
        ctx.beginPath();
        if (t.type === TowerType.SUPPORT) ctx.arc(tx, ty, cellSize/3, 0, Math.PI*2);
        else if (t.type === TowerType.WALL) ctx.rect(t.c*cellSize+2, t.r*cellSize+2, cellSize-4, cellSize-4);
        else { ctx.moveTo(tx, ty-cellSize/3); ctx.lineTo(tx+cellSize/3, ty+cellSize/3); ctx.lineTo(tx-cellSize/3, ty+cellSize/3); ctx.closePath(); }
        ctx.fill();
      });

      // Projectiles
      state.projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x * cellSize, p.y * cellSize, 2, 0, Math.PI * 2); ctx.fill();
      });
    };

    const frame = () => { update(); draw(); animationId = requestAnimationFrame(frame); };
    frame();
    return () => cancelAnimationFrame(animationId);
  }, [currentMap, isGameOver, selectedObjectId, selectedObjectType, endPos]);

  const selectedData = useMemo(() => {
    if (!selectedObjectId) return null;
    if (selectedObjectType === 'tower') {
      const t = gameState.current.towers.find(t => t.id === selectedObjectId);
      if (!t) return null;
      return { ...TOWER_CONFIGS[t.type], level: t.level, r: t.r, c: t.c };
    } else {
      const e = gameState.current.enemies.find(e => e.id === selectedObjectId);
      if (!e) return null;
      return { ...ENEMY_CONFIGS[e.type], hp: e.hp, maxHp: e.maxHp, speed: e.distanceTraveled };
    }
  }, [selectedObjectId, selectedObjectType, hp, money]);

  if (!currentMap) {
    return (
      <div className="flex flex-col h-screen bg-[#1a1a1a] items-center justify-center text-white p-4">
        <h1 className="text-4xl md:text-6xl font-black mb-10 tracking-widest text-yellow-500 text-center drop-shadow-lg">KINGDOM GUARD</h1>
        <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
          <button onClick={() => generateMap(MapType.FREE)} className="bg-green-600 p-6 rounded-2xl font-black text-lg hover:bg-green-500 transition-all shadow-xl hover:-translate-y-1">FREE PATH</button>
          <button onClick={() => generateMap(MapType.SNAKE)} className="bg-blue-600 p-6 rounded-2xl font-black text-lg hover:bg-blue-500 transition-all shadow-xl hover:-translate-y-1">SNAKE ROAD</button>
          <button onClick={() => generateMap(MapType.SPIRAL)} className="bg-purple-600 p-6 rounded-2xl font-black text-lg hover:bg-purple-500 transition-all shadow-xl hover:-translate-y-1">SPIRAL LOOP</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-white select-none overflow-hidden relative">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-[#2c3e50] shadow-xl z-20 shrink-0">
        <div className="flex gap-4 md:gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Lives</span>
            <span className={`text-lg md:text-xl font-black ${hp < 5 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>❤️ {hp}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Gold</span>
            <span className="text-lg md:text-xl font-black text-yellow-400">💰 {money}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center hidden md:block">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Wave</span>
            <div className="text-2xl font-black">{wave}</div>
          </div>
          {!isWaveActive && !isGameOver && (
            <button onClick={spawnWave} className="bg-green-600 hover:bg-green-500 text-white font-black py-2 px-6 md:px-8 rounded-lg shadow-lg border-b-4 border-green-800 transition-all active:translate-y-1 active:border-b-0">START WAVE</button>
          )}
          {isWaveActive && (
             <div className="text-center md:hidden">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Wave</span>
                <div className="text-lg font-black">{wave}</div>
             </div>
          )}
        </div>

        <button onClick={() => setCurrentMap(null)} className="text-[10px] bg-red-900/40 px-3 py-1 rounded hover:bg-red-800 uppercase font-bold">Menu</button>
      </div>

      {/* Info Panel */}
      {selectedData && (
        <div className="absolute top-24 left-4 w-52 md:w-60 bg-black/85 border border-white/10 p-4 rounded-2xl backdrop-blur-md z-30 shadow-2xl animate-in fade-in slide-in-from-left-4">
           <div className="flex justify-between items-start mb-2">
             {/* Use any cast to safely access 'name' from tower config which may not exist on enemy config */}
             <h3 className="font-black text-xs md:text-sm uppercase tracking-wider" style={{ color: (selectedData as any).color }}>{(selectedData as any).name || selectedObjectType}</h3>
             <button onClick={() => setSelectedObjectId(null)} className="text-gray-500 hover:text-white">✕</button>
           </div>
           
           {selectedObjectType === 'tower' ? (
             <div className="text-[10px] md:text-[11px] space-y-1">
               <p className="text-gray-400 mb-2 leading-tight">{(selectedData as any).description}</p>
               <div className="flex justify-between border-t border-white/5 pt-1"><span>Position:</span><span>{(selectedData as any).c}, {(selectedData as any).r}</span></div>
               <div className="flex justify-between"><span>Damage:</span><span className="text-red-400">{(selectedData as any).damage}</span></div>
               <div className="flex justify-between"><span>Range:</span><span className="text-blue-400">{(selectedData as any).range} cells</span></div>
               <div className="flex justify-between"><span>Rate:</span><span className="text-green-400">{(60 / (selectedData as any).cooldown).toFixed(1)}/s</span></div>
             </div>
           ) : (
             <div className="text-[10px] md:text-[11px] space-y-1">
               <div className="flex justify-between"><span>Health:</span><span className="text-green-400">{Math.ceil((selectedData as any).hp)} / {(selectedData as any).maxHp}</span></div>
               <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1 mb-2">
                 <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${((selectedData as any).hp / (selectedData as any).maxHp) * 100}%` }}></div>
               </div>
               <div className="flex justify-between"><span>Reward:</span><span className="text-yellow-400">💰 {(selectedData as any).reward}</span></div>
             </div>
           )}
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 relative flex items-center justify-center p-2 md:p-4 bg-[#111] overflow-hidden min-h-0">
        <canvas 
          ref={canvasRef} 
          width={720} 
          height={720} 
          onClick={handleCanvasClick} 
          onMouseMove={handleMouseMove} 
          onMouseLeave={() => setHoverPos(null)} 
          onTouchStart={handleCanvasClick} 
          className="max-w-full max-h-full aspect-square bg-[#1b4d1b] border-2 md:border-4 border-[#222] shadow-2xl rounded-lg cursor-crosshair object-contain" 
        />

        {isGameOver && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8 z-50 text-center">
            <h1 className="text-5xl md:text-7xl font-black text-red-600 mb-2 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">DEFEAT</h1>
            <p className="text-lg md:text-xl text-gray-400 mb-10">The kingdom fell at wave {wave}</p>
            <button onClick={() => setCurrentMap(null)} className="bg-white text-black font-black py-4 px-10 rounded-2xl hover:bg-gray-200 uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">Try Another Map</button>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="bg-[#2c3e50] p-3 md:p-4 border-t border-white/5 shadow-2xl shrink-0">
        <div className="flex gap-2 md:gap-4 overflow-x-auto justify-start md:justify-center items-end h-20 md:h-24 pb-1 no-scrollbar">
          {(Object.keys(TOWER_CONFIGS) as TowerType[]).map((type) => {
            const config = TOWER_CONFIGS[type];
            const isSelected = selectedTower === type;
            const canAfford = money >= config.cost || type === TowerType.DELETE;
            return (
              <button key={type} onClick={() => setSelectedTower(type)} className={`flex flex-col items-center p-2 md:p-3 rounded-xl border-2 transition-all w-20 md:w-24 shrink-0 relative ${isSelected ? 'border-yellow-400 bg-white/10 -translate-y-2' : 'border-transparent bg-black/30'} ${!canAfford ? 'opacity-30 grayscale' : 'hover:bg-white/5 active:scale-95'}`}>
                <div className="w-8 h-8 md:w-10 md:h-10 mb-1 flex items-center justify-center" style={{ color: config.color }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 md:w-8 md:h-8 filter drop-shadow">
                    {type === TowerType.WALL ? <rect x="4" y="4" width="16" height="16" /> : type === TowerType.SUPPORT ? <circle cx="12" cy="12" r="8" /> : type === TowerType.DELETE ? <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /> : <path d="M12 2L4 8V22H20V8L12 2ZM12 10C13.1 10 14 10.9 14 12C14 13.1 13.1 14 12 14C10.9 14 10 13.1 10 12C10 10.9 10.9 10 12 10Z" />}
                  </svg>
                </div>
                <span className="text-[9px] md:text-[10px] font-black truncate w-full text-center uppercase tracking-tighter">{config.name}</span>
                <span className="text-[9px] md:text-[10px] font-bold text-yellow-500">{type === TowerType.DELETE ? 'SELL' : `💰${config.cost}`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;
