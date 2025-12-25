import React, { useEffect, useRef, useState } from 'react';
import { Gift, Heart, Map, Shield, Sparkles, Sword, Search } from 'lucide-react';
import DungeonCanvas, { DungeonCanvasHandle } from './DungeonCanvas';
import { CombatState, GameState, MonsterArchetype, MonsterInstance, Tile } from './types';
import { generateDungeon } from './dungeonGen';
import { computeVisibility } from './visibility';

const GRID_SIZE = 16;
const TILE_SIZE = 44;
const VISION_RADIUS = 4;

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

  useEffect(() => {
    initializeGame();
  }, []);

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
    tiles = placeSecretDoors(tiles);
    tiles = placeTreasures(tiles, start, boss);

    const { monstersById, tiles: withMonsters } = spawnMonsters(tiles, start, boss);
    const visibility = computeVisibility(withMonsters, start, VISION_RADIUS);

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

  const addLog = (message: string) => {
    setGame((prev) =>
      prev
        ? {
            ...prev,
            log: [...prev.log.slice(-30), message]
          }
        : prev
    );
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
      updated = updateTiles(updated, x, y, (tile) => ({ ...tile, type: 'trap', revealed: false }));
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

  const placeSecretDoors = (tiles: Tile[][]) => {
    const candidates: { x: number; y: number }[] = [];
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    for (let y = 1; y < tiles.length - 1; y++) {
      for (let x = 1; x < tiles[0].length - 1; x++) {
        if (tiles[y][x].type !== 'wall') continue;
        const neighbors = dirs.map((d) => tiles[y + d.y][x + d.x].type);
        const connectsCorridor = neighbors.some((t) => t === 'corridor');
        const connectsRoom = neighbors.some((t) => t === 'room');
        if (connectsCorridor && connectsRoom) {
          candidates.push({ x, y });
        }
      }
    }

    const secrets = Math.max(2, Math.min(4, candidates.length));
    let updated = tiles;
    for (let i = 0; i < secrets && candidates.length; i++) {
      const idx = roll(0, candidates.length - 1);
      const { x, y } = candidates.splice(idx, 1)[0];
      updated = updateTiles(updated, x, y, (tile) => ({ ...tile, type: 'secretDoor', revealed: false }));
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
        addLog('You cannot go that way.');
        return prev;
      }
      const target = prev.tiles[newY][newX];
      if (target.type === 'wall') {
        addLog('A solid wall blocks the path.');
        return prev;
      }
      if (target.type === 'secretDoor' && !target.revealed) {
        addLog('You sense a dead end here.');
        return prev;
      }

      let nextTiles = prev.tiles;
      let nextState: GameState = {
        ...prev,
        player: { ...prev.player, x: newX, y: newY }
      };

      if (target.type === 'trap') {
        const damage = roll(5, 15);
        addLog(`A hidden trap springs! You take ${damage} damage.`);
        nextState.player = { ...nextState.player, hp: Math.max(0, nextState.player.hp - damage) };
        nextTiles = updateTiles(nextTiles, newX, newY, (tile) => ({ ...tile, type: 'corridor', revealed: true }));
        canvasRef.current?.hitFlash('player');
      }

      if (target.type === 'treasure') {
        const gold = roll(10, 25);
        addLog(`You find ${gold} gold.`);
        nextState.player = { ...nextState.player, gold: nextState.player.gold + gold };
        nextTiles = updateTiles(nextTiles, newX, newY, (tile) => ({ ...tile, type: 'corridor', lootId: null }));
        canvasRef.current?.spawnParticles(newX, newY, 'treasure');
      }

      if (target.monsterId) {
        const monster = prev.monstersById[target.monsterId];
        if (monster) {
          addLog(`A ${prev.archetypesById[monster.archetypeId].name} engages you!`);
          nextState.combat = { active: true, monsterId: monster.id } as CombatState;
        }
      }

      const withVisibility = computeVisibility(nextTiles, { x: newX, y: newY }, VISION_RADIUS);
      nextState = { ...nextState, tiles: withVisibility };

      if (nextState.player.hp <= 0) {
        addLog('You succumb to your wounds.');
      }

      return nextState;
    });
  };

  const searchAround = () => {
    setGame((prev) => {
      if (!prev || prev.player.hp <= 0) return prev;
      const found: string[] = [];
      let tiles = prev.tiles;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = prev.player.x + dx;
          const y = prev.player.y + dy;
          if (x < 0 || y < 0 || x >= prev.gridSize || y >= prev.gridSize) continue;
          const tile = tiles[y][x];
          if ((tile.type === 'trap' || tile.type === 'secretDoor') && !tile.revealed) {
            if (Math.random() < 0.7) {
              tiles = updateTiles(tiles, x, y, (t) => ({ ...t, revealed: true }));
              found.push(tile.type === 'trap' ? 'trap' : 'secret door');
            }
          }
        }
      }
      if (found.length === 0) {
        addLog('You search the area but find nothing.');
      } else {
        addLog(`You discover ${found.join(' and ')} nearby!`);
      }
      return { ...prev, tiles };
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
      addLog(`You strike the ${archetype.name} for ${damage} damage.`);
      canvasRef.current?.hitFlash('monster');
      let tiles = prev.tiles;
      let monsters = { ...prev.monstersById };
      let combat: CombatState = { ...prev.combat };
      let player = { ...prev.player };

      if (newHP <= 0) {
        addLog(`The ${archetype.name} falls! +${archetype.gold} gold`);
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
    addLog(`The ${archetype.name} strikes you for ${damage} damage.`);
    canvasRef.current?.hitFlash('player');
    if (damage >= 8) {
      canvasRef.current?.screenShake?.(240, 6);
    }
    if (hp <= 0) {
      addLog('You fall to the dungeon floor...');
    }
    return { ...state, player: nextPlayer };
  };

  const restartGame = () => {
    initializeGame();
  };

  if (!game) return null;

  const { player, tiles, combat, log, inventory } = game;

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
              <div className="mt-3 text-xs text-blue-200 grid grid-cols-2 gap-2">
                <div>🧙 You | 💀 Monster | 👹 Boss</div>
                <div>💰 Treasure | ⚠️ Trap | ❓ Secret</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600 flex flex-col h-full">
            <h2 className="text-xl font-bold text-blue-300 mb-3">📜 Game Log</h2>
            <div className="bg-slate-900 rounded p-3 flex-1 overflow-y-auto text-sm text-blue-100 space-y-1">
              {log.map((entry, i) => (
                <div key={i} className="border-b border-slate-700 pb-1">
                  {entry}
                </div>
              ))}
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
