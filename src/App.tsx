import React, { useEffect, useRef, useState } from 'react';
import { Gift, Heart, Map, Shield, Sparkles, Sword, Search } from 'lucide-react';
import DungeonCanvas, { DungeonCanvasHandle } from './DungeonCanvas';
import { CombatState, GameState, MonsterArchetype, MonsterInstance, Tile } from './types';
import { generateDungeon, labelRegions } from './dungeonGen';
import { computeVisibility } from './visibility';

const GRID_SIZE = 16;
const TILE_SIZE = 44;
const VISION_RADIUS = 4;
const MAX_LOG = 30;
const SEARCH_DISTANCE = 10;
const SEARCH_CHANCE = 0.85;

const archetypes: MonsterArchetype[] = [
  { id: 'goblin', name: 'Goblin', glyph: 'g', maxHP: 10, atk: 3, def: 1, gold: 5, tier: 'minion' },
  { id: 'orc', name: 'Orc', glyph: 'o', maxHP: 16, atk: 5, def: 2, gold: 12, tier: 'minion' },
  { id: 'skeleton', name: 'Skeleton', glyph: 's', maxHP: 12, atk: 4, def: 1, gold: 8, tier: 'minion' },
  { id: 'zombie', name: 'Zombie', glyph: 'z', maxHP: 14, atk: 4, def: 2, gold: 10, tier: 'minion' },
  { id: 'chaosWarrior', name: 'Chaos Warrior', glyph: 'c', maxHP: 22, atk: 6, def: 3, gold: 18, tier: 'elite' },
  { id: 'abomination', name: 'Abomination', glyph: 'a', maxHP: 24, atk: 6, def: 3, gold: 20, tier: 'elite' },
  { id: 'gargoyle', name: 'Gargoyle', glyph: 'G', maxHP: 32, atk: 8, def: 4, gold: 50, tier: 'boss' }
];

const toRecord = <T extends { id: string }>(list: T[]) =>
  list.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

const roll = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const NorseDungeonCrawler: React.FC = () => {
  const canvasRef = useRef<DungeonCanvasHandle | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (!game) return;
    const handle = requestAnimationFrame(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => cancelAnimationFrame(handle);
  }, [game?.log]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') tryMove(0, -1);
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') tryMove(0, 1);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') tryMove(-1, 0);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') tryMove(1, 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const initializeGame = () => {
    const { tiles: baseTiles, start, boss } = generateDungeon(GRID_SIZE);

    let tiles = baseTiles;
    tiles = placeTraps(tiles, start, boss);
    tiles = placeTreasures(tiles, start, boss);
    tiles = labelRegions(tiles);
    tiles = placeSecretDoors(tiles);
    tiles = labelRegions(tiles);

    const { monstersById, tiles: withMonsters } = spawnMonsters(tiles, start, boss);
    const labeled = labelRegions(withMonsters);
    const visibility = computeVisibility(labeled, start, VISION_RADIUS);

    const initialState: GameState = {
      gridSize: GRID_SIZE,
      tiles: visibility,
      player: { x: start.x, y: start.y, hp: 40, maxHP: 40, atk: 6, def: 4, gold: 0 },
      monstersById,
      archetypesById: toRecord(archetypes),
      combat: { active: false, monsterId: null },
      log: ['You enter the frozen halls beneath Yggdrasil...'],
      inventory: []
    };

    setGame(initialState);
  };

  const appendLog = (message: string) => {
    setGame((prev) => (prev ? { ...prev, log: [...prev.log, message].slice(-MAX_LOG) } : prev));
  };

  const updateTiles = (tiles: Tile[][], x: number, y: number, updater: (tile: Tile) => Tile) => {
    return tiles.map((row, rowIndex) =>
      rowIndex === y ? row.map((tile, colIndex) => (colIndex === x ? updater(tile) : tile)) : row
    );
  };

  const placeTraps = (tiles: Tile[][], start: { x: number; y: number }, boss: { x: number; y: number }) => {
    const candidates: { x: number; y: number }[] = [];
    tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        if ((tile.type === 'room' || tile.type === 'corridor') && !(x === start.x && y === start.y) && !(x === boss.x && y === boss.y)) {
          candidates.push({ x, y });
        }
      });
    });

    const traps = roll(3, 6);
    let placed = 0;
    let updated = tiles;
    while (placed < traps && candidates.length) {
      const idx = roll(0, candidates.length - 1);
      const { x, y } = candidates.splice(idx, 1)[0];
      updated = updateTiles(updated, x, y, (tile) => ({ ...tile, type: 'trap', revealed: false, triggered: false }));
      placed++;
    }

    return updated;
  };

  const placeTreasures = (tiles: Tile[][], start: { x: number; y: number }, boss: { x: number; y: number }) => {
    const candidates: { x: number; y: number }[] = [];
    tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        if ((tile.type === 'room' || tile.type === 'corridor') && !(x === start.x && y === start.y) && !(x === boss.x && y === boss.y)) {
          candidates.push({ x, y });
        }
      });
    });

    const treasures = roll(3, 6);
    let updated = tiles;
    for (let i = 0; i < treasures && candidates.length; i++) {
      const idx = roll(0, candidates.length - 1);
      const { x, y } = candidates.splice(idx, 1)[0];
      updated = updateTiles(updated, x, y, (tile) => ({ ...tile, type: 'treasure' }));
    }

    return updated;
  };

  // Secret doors are only carved along boundaries between distinct passable regions.
  const placeSecretDoors = (tiles: Tile[][]) => {
    const candidates: { x: number; y: number; regions: [number, number] }[] = [];
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    for (let y = 1; y < tiles.length - 1; y++) {
      for (let x = 1; x < tiles[0].length - 1; x++) {
        const tile = tiles[y][x];
        if (tile.type !== 'wall') continue;

        const neighborRegions = new Set<number>();
        dirs.forEach((d) => {
          const neighbor = tiles[y + d.y][x + d.x];
          if (neighbor.regionId !== undefined) {
            neighborRegions.add(neighbor.regionId);
          }
        });

        if (neighborRegions.size >= 2) {
          const [a, b] = Array.from(neighborRegions) as [number, number];
          candidates.push({ x, y, regions: [a, b] });
        }
      }
    }

    const secrets = candidates.length === 0 ? 0 : roll(1, Math.min(2, candidates.length));
    let updated = tiles;
    for (let i = 0; i < secrets && candidates.length; i++) {
      const idx = roll(0, candidates.length - 1);
      const { x, y, regions } = candidates.splice(idx, 1)[0];
      updated = updateTiles(updated, x, y, (tile) => ({
        ...tile,
        type: 'secretDoor',
        revealed: false,
        secretDoorLinks: regions
      }));
    }

    return updated;
  };

  const spawnMonsters = (
    tiles: Tile[][],
    start: { x: number; y: number },
    boss: { x: number; y: number }
  ): { tiles: Tile[][]; monstersById: Record<string, MonsterInstance> } => {
    const walkable: { x: number; y: number }[] = [];
    tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile.type === 'room' || tile.type === 'corridor' || tile.type === 'boss') {
          if (!(x === start.x && y === start.y)) {
            walkable.push({ x, y });
          }
        }
      });
    });

    let updatedTiles = tiles;
    const monsterCount = roll(6, 10);
    const monstersById: Record<string, MonsterInstance> = {};

    const nonBossArchetypes = archetypes.filter((a) => a.tier !== 'boss');

    for (let i = 0; i < monsterCount && walkable.length; i++) {
      const idx = roll(0, walkable.length - 1);
      const { x, y } = walkable.splice(idx, 1)[0];
      if (x === boss.x && y === boss.y) continue;
      const archetype = nonBossArchetypes[roll(0, nonBossArchetypes.length - 1)];
      const id = `${archetype.id}-${i}-${Date.now()}`;
      monstersById[id] = { id, archetypeId: archetype.id, hp: archetype.maxHP, pos: { x, y } };
      updatedTiles = updateTiles(updatedTiles, x, y, (tile) => ({ ...tile, monsterId: id }));
    }

    const bossArchetype = archetypes.find((a) => a.tier === 'boss');
    if (bossArchetype) {
      const bossId = `${bossArchetype.id}-boss`;
      monstersById[bossId] = { id: bossId, archetypeId: bossArchetype.id, hp: bossArchetype.maxHP, pos: boss };
      updatedTiles = updateTiles(updatedTiles, boss.x, boss.y, (tile) => ({ ...tile, monsterId: bossId }));
    }

    return { tiles: updatedTiles, monstersById };
  };

  const tryMove = (dx: number, dy: number) => {
    setGame((prev) => {
      if (!prev || prev.combat.active || prev.player.hp <= 0) return prev;
      const newX = prev.player.x + dx;
      const newY = prev.player.y + dy;
      if (newX < 0 || newY < 0 || newX >= prev.gridSize || newY >= prev.gridSize) {
        appendLog('You cannot go that way.');
        return prev;
      }
      const target = prev.tiles[newY][newX];
      if (target.type === 'wall') {
        appendLog('A solid wall blocks the path.');
        return prev;
      }
      if (target.type === 'secretDoor' && !target.revealed) {
        appendLog('You sense a dead end here.');
        return prev;
      }

      let nextTiles = prev.tiles;
      let nextState: GameState = {
        ...prev,
        player: { ...prev.player, x: newX, y: newY }
      };

      if (target.type === 'trap' && !target.triggered) {
        const damage = roll(5, 15);
        appendLog(`A hidden trap springs! You take ${damage} damage.`);
        nextState.player = { ...nextState.player, hp: Math.max(0, nextState.player.hp - damage) };
        nextTiles = updateTiles(nextTiles, newX, newY, (tile) => ({ ...tile, revealed: true, triggered: true }));
        canvasRef.current?.hitFlash('player');
      }

      if (target.type === 'treasure') {
        const gold = roll(10, 25);
        appendLog(`You find ${gold} gold.`);
        nextState.player = { ...nextState.player, gold: nextState.player.gold + gold };
        nextTiles = updateTiles(nextTiles, newX, newY, (tile) => ({ ...tile, type: 'corridor', lootId: null }));
        canvasRef.current?.spawnParticles(newX, newY, 'treasure');
      }

      if (target.monsterId) {
        const monster = prev.monstersById[target.monsterId];
        if (monster) {
          appendLog(`A ${prev.archetypesById[monster.archetypeId].name} engages you!`);
          nextState.combat = { active: true, monsterId: monster.id } as CombatState;
        }
      }

      const withRegions = labelRegions(nextTiles);
      const withVisibility = computeVisibility(withRegions, { x: newX, y: newY }, VISION_RADIUS);
      nextState = { ...nextState, tiles: withVisibility };

      if (nextState.player.hp <= 0) {
        appendLog('You succumb to your wounds.');
      }

      return nextState;
    });
  };

  const searchAround = () => {
    setGame((prev) => {
      if (!prev || prev.player.hp <= 0) return prev;
      const found: string[] = [];
      let tiles = prev.tiles;
      const playerRegion = prev.tiles[prev.player.y][prev.player.x].regionId;

      for (let y = 0; y < prev.gridSize; y++) {
        for (let x = 0; x < prev.gridSize; x++) {
          const tile = tiles[y][x];
          if (playerRegion === undefined || tile.regionId !== playerRegion) continue;
          const dist = Math.hypot(prev.player.x - x, prev.player.y - y);
          if (dist > SEARCH_DISTANCE) continue;
          if ((tile.type === 'trap' || tile.type === 'secretDoor') && !tile.revealed) {
            if (Math.random() < SEARCH_CHANCE) {
              tiles = updateTiles(tiles, x, y, (t) => ({ ...t, revealed: true }));
              found.push(tile.type === 'trap' ? 'trap' : 'secret door');
            }
          }
        }
      }

      const needsRelabel = found.some((f) => f === 'secret door');
      const nextTiles = needsRelabel ? labelRegions(tiles) : tiles;
      const chance = Math.round(SEARCH_CHANCE * 100);
      const message =
        found.length === 0
          ? `You search carefully (${chance}% focus) but find nothing in this area.`
          : `You discover ${found.join(' and ')} nearby!`;

      return { ...prev, tiles: nextTiles, log: [...prev.log, message].slice(-MAX_LOG) };
    });
  };

  const resolvePlayerAttack = () => {
    setGame((prev) => {
      if (!prev || !prev.combat.active || !prev.combat.monsterId || prev.player.hp <= 0) return prev;
      const monster = prev.monstersById[prev.combat.monsterId];
      const archetype = monster ? prev.archetypesById[monster.archetypeId] : undefined;
      if (!monster || !archetype) return prev;

      const rollValue = roll(1, 6);
      const damage = Math.max(1, prev.player.atk + rollValue - archetype.def);
      const newHP = monster.hp - damage;
      appendLog(`You strike the ${archetype.name} for ${damage} damage.`);
      canvasRef.current?.hitFlash('monster');
      let tiles = prev.tiles;
      let monsters = { ...prev.monstersById };
      let combat: CombatState = { ...prev.combat };
      let player = { ...prev.player };

      if (newHP <= 0) {
        appendLog(`The ${archetype.name} falls! +${archetype.gold} gold`);
        player = { ...player, gold: player.gold + archetype.gold };
        tiles = updateTiles(tiles, monster.pos.x, monster.pos.y, (tile) => ({ ...tile, monsterId: null }));
        delete monsters[monster.id];
        combat = { active: false, monsterId: null };
        canvasRef.current?.spawnParticles(monster.pos.x, monster.pos.y, 'monster');
      } else {
        monsters[monster.id] = { ...monster, hp: newHP };
        combat = { ...combat, lastHitAt: Date.now() };
      }

      const afterPlayer = { ...prev, tiles, monstersById: monsters, combat, player };
      return newHP <= 0 ? afterPlayer : resolveMonsterAttack(afterPlayer);
    });
  };

  const resolveMonsterAttack = (state: GameState) => {
    if (!state.combat.active || !state.combat.monsterId) return state;
    const monster = state.monstersById[state.combat.monsterId];
    const archetype = monster ? state.archetypesById[monster.archetypeId] : undefined;
    if (!monster || !archetype) return state;
    const rollValue = roll(1, 6);
    const damage = Math.max(1, archetype.atk + rollValue - state.player.def);
    const hp = state.player.hp - damage;
    const nextPlayer = { ...state.player, hp };
    appendLog(`The ${archetype.name} strikes you for ${damage} damage.`);
    canvasRef.current?.hitFlash('player');
    if (damage >= 8) {
      canvasRef.current?.screenShake?.(240, 6);
    }
    if (hp <= 0) {
      appendLog('You fall to the dungeon floor...');
    }
    return { ...state, player: nextPlayer };
  };

  const restartGame = () => {
    initializeGame();
  };

  if (!game) return null;

  const { player, tiles, combat, log, inventory } = game;

  const legendItems: { label: string; style: React.CSSProperties; marker?: 'door' | 'secret' | 'trap' }[] = [
    {
      label: 'Wall',
      style: {
        backgroundColor: '#070910',
        border: '2px solid #111827',
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.08)'
      }
    },
    {
      label: 'Room',
      style: {
        backgroundColor: '#2f3f5b',
        border: '1px solid rgba(255,255,255,0.15)',
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.15) 6%, transparent 8%), radial-gradient(circle at 70% 70%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 5%, transparent 7%)'
      }
    },
    {
      label: 'Corridor',
      style: {
        backgroundColor: '#1b2434',
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(124,58,237,0.4), rgba(124,58,237,0.4) 6px, transparent 6px, transparent 12px)'
      }
    },
    { label: 'Door', style: { backgroundColor: '#c0a16d', border: '2px solid #2b1f12' }, marker: 'door' },
    {
      label: 'Secret door',
      style: { backgroundColor: '#070910', border: '2px dashed #7dd3fc' },
      marker: 'secret'
    },
    {
      label: 'Trap (revealed)',
      style: { backgroundColor: '#1b2434', border: '2px solid rgba(251,146,60,0.8)' },
      marker: 'trap'
    }
  ];

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 flex flex-col items-center overflow-auto">
      <div className="max-w-[1600px] w-full bg-slate-800 rounded-lg shadow-2xl border-4 border-blue-700 p-6 my-4">
        <h1 className="text-4xl font-bold text-center mb-4 text-blue-200 drop-shadow-lg">⚔️ Norse Dungeon Crawler ⚔️</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4">
          <div className="space-y-3">
            <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
              <h2 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5" /> Hero Stats
              </h2>
              <div className="grid grid-cols-2 gap-2 text-blue-100">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" /> HP: {player.hp}/{player.maxHP}
                </div>
                <div className="flex items-center gap-2">
                  <Sword className="w-4 h-4 text-orange-400" /> ATK: {player.atk}
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" /> DEF: {player.def}
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-300" /> Gold: {player.gold}
                </div>
              </div>
            </div>

            <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
              <h2 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5" /> Inventory
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto text-blue-100">
                {inventory.length === 0 ? <p className="text-blue-200 text-sm italic">Empty</p> : inventory.map((item, i) => <div key={i}>• {item}</div>)}
              </div>
            </div>

            <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
              <h3 className="text-lg font-bold text-blue-300 mb-2 flex items-center gap-2">
                <Search className="w-5 h-5" /> Actions
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div></div>
                <button onClick={() => tryMove(0, -1)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">
                  ↑
                </button>
                <div></div>
                <button onClick={() => tryMove(-1, 0)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">
                  ←
                </button>
                <div className="bg-slate-600 rounded flex items-center justify-center text-2xl">👤</div>
                <button onClick={() => tryMove(1, 0)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">
                  →
                </button>
                <div></div>
                <button onClick={() => tryMove(0, 1)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">
                  ↓
                </button>
                <div></div>
              </div>
              <button onClick={searchAround} className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded">
                Search nearby
              </button>
            </div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
            <h2 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
              <Map className="w-5 h-5" /> Dungeon Map
            </h2>
            <div className="bg-slate-950 p-3 rounded border-2 border-slate-800">
              <DungeonCanvas ref={canvasRef} tiles={tiles} player={player} combat={combat} tileSize={TILE_SIZE} />
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-blue-200">
                {legendItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-9 h-6 rounded-sm relative overflow-hidden" style={item.style}>
                      {item.marker === 'door' && (
                        <div className="absolute inset-1 rounded-sm border border-amber-900 bg-amber-200/80" />
                      )}
                      {item.marker === 'secret' && (
                        <div className="absolute inset-1 rounded-sm border border-sky-300 border-dashed" />
                      )}
                      {item.marker === 'trap' && (
                        <div className="absolute inset-0 flex items-center justify-center text-amber-400 text-[11px] leading-none">▲</div>
                      )}
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600 flex flex-col h-full">
            <h2 className="text-xl font-bold text-blue-300 mb-3">📜 Game Log</h2>
            <div
              ref={logContainerRef}
              className="bg-slate-900 rounded p-3 flex-1 overflow-y-auto text-sm text-blue-100 space-y-1"
            >
              {log.map((entry, i) => (
                <div key={i} className="border-b border-slate-700 pb-1">
                  {entry}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {combat.active && combat.monsterId && (
              <div className="mt-4 bg-red-900 rounded p-3 border-2 border-red-600">
                <h3 className="font-bold text-red-200 mb-2">⚔️ Combat!</h3>
                {(() => {
                  const instance = game.monstersById[combat.monsterId!];
                  const archetype = instance ? game.archetypesById[instance.archetypeId] : null;
                  return (
                    <div className="text-red-100 mb-2">
                      <div className="font-bold">{archetype?.name ?? 'Monster'}</div>
                      <div>HP: {instance?.hp ?? '?'} / {archetype?.maxHP ?? '?'}</div>
                      <div>ATK: {archetype?.atk ?? '?'} | DEF: {archetype?.def ?? '?'}</div>
                    </div>
                  );
                })()}
                <button onClick={resolvePlayerAttack} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded">
                  Attack! (Roll Dice)
                </button>
              </div>
            )}

            {player.hp <= 0 && (
              <div className="mt-4 bg-gray-900 rounded p-4 border-2 border-gray-600 text-center">
                <h3 className="font-bold text-gray-200 text-xl mb-2">💀 Defeated 💀</h3>
                <p className="text-gray-300 mb-3">Your journey ends here...</p>
                <button onClick={restartGame} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded">
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NorseDungeonCrawler;
