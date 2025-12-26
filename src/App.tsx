import React, { useEffect, useRef, useState } from 'react';
import { Gift, Heart, Shield, Sparkles, Sword, Search, RotateCcw, RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import FirstPersonCanvas, { FirstPersonCanvasHandle } from './FirstPersonCanvas';
import Minimap from './Minimap';
import CompassHUD from './CompassHUD';
import { CombatState, FacingDirection, GameState, MonsterArchetype, MonsterInstance, Tile } from './types';
import { generateDungeon, labelRegions } from './dungeonGen';
import { computeVisibility } from './visibility';
import { getForwardDelta, getStrafeDelta, turnLeft, turnRight } from './RaycastEngine';

const GRID_SIZE = 16;
const VISION_RADIUS = 5;
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
  const canvasRef = useRef<FirstPersonCanvasHandle | null>(null);
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

      // First-person controls
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveForward();
      }
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveBackward();
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        strafeLeft();
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        strafeRight();
      }
      if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleTurnLeft();
      }
      if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleTurnRight();
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (game?.combat.active) {
          resolvePlayerAttack();
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        searchAround();
      }
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
      player: { x: start.x, y: start.y, facing: 'south', hp: 40, maxHP: 40, atk: 6, def: 4, gold: 0 },
      monstersById,
      archetypesById: toRecord(archetypes),
      combat: { active: false, monsterId: null },
      log: ['You enter the frozen halls beneath Yggdrasil...', 'Use W/S to move, Q/E to turn, SPACE to attack.'],
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

  // Movement functions for first-person view
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
        canvasRef.current?.screenShake?.(200, 10);
      }

      if (target.type === 'treasure') {
        const gold = roll(10, 25);
        appendLog(`You find ${gold} gold in a chest!`);
        nextState.player = { ...nextState.player, gold: nextState.player.gold + gold };
        nextTiles = updateTiles(nextTiles, newX, newY, (tile) => ({ ...tile, type: 'corridor', lootId: null }));
        canvasRef.current?.spawnParticles(newX, newY, 'treasure');
      }

      if (target.monsterId) {
        const monster = prev.monstersById[target.monsterId];
        if (monster) {
          appendLog(`A ${prev.archetypesById[monster.archetypeId].name} blocks your path!`);
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

  const moveForward = () => {
    setGame((prev) => {
      if (!prev) return prev;
      const delta = getForwardDelta(prev.player.facing);
      return prev; // Return prev, then call tryMove
    });
    // Get current facing and move
    if (game) {
      const delta = getForwardDelta(game.player.facing);
      tryMove(delta.dx, delta.dy);
    }
  };

  const moveBackward = () => {
    if (game) {
      const delta = getForwardDelta(game.player.facing);
      tryMove(-delta.dx, -delta.dy);
    }
  };

  const strafeLeft = () => {
    if (game) {
      const delta = getStrafeDelta(game.player.facing, 'left');
      tryMove(delta.dx, delta.dy);
    }
  };

  const strafeRight = () => {
    if (game) {
      const delta = getStrafeDelta(game.player.facing, 'right');
      tryMove(delta.dx, delta.dy);
    }
  };

  const handleTurnLeft = () => {
    setGame((prev) => {
      if (!prev || prev.player.hp <= 0) return prev;
      const newFacing = turnLeft(prev.player.facing);
      return {
        ...prev,
        player: { ...prev.player, facing: newFacing }
      };
    });
  };

  const handleTurnRight = () => {
    setGame((prev) => {
      if (!prev || prev.player.hp <= 0) return prev;
      const newFacing = turnRight(prev.player.facing);
      return {
        ...prev,
        player: { ...prev.player, facing: newFacing }
      };
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
      const message =
        found.length === 0
          ? 'You search carefully but find nothing nearby.'
          : `You discover ${found.join(' and ')}!`;

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
      appendLog(`You strike the ${archetype.name} for ${damage} damage!`);
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
    appendLog(`The ${archetype.name} strikes back for ${damage} damage!`);
    canvasRef.current?.hitFlash('player');
    if (damage >= 8) {
      canvasRef.current?.screenShake?.(240, 8);
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

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-2 md:p-4 flex flex-col items-center overflow-auto">
      <div className="max-w-[1200px] w-full bg-slate-800 rounded-lg shadow-2xl border-2 border-slate-600 p-3 md:p-4 my-2">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-3 text-slate-200 drop-shadow-lg">
          Norse Dungeon Crawler
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
          {/* Main View Area */}
          <div className="space-y-3">
            {/* First Person View with HUD overlays */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <FirstPersonCanvas
                ref={canvasRef}
                tiles={tiles}
                player={player}
                combat={combat}
                width={640}
                height={400}
              />

              {/* Minimap overlay - top left */}
              <div className="absolute top-2 left-2 opacity-90 hover:opacity-100 transition-opacity">
                <Minimap tiles={tiles} player={player} size={120} />
              </div>

              {/* Compass overlay - top right */}
              <div className="absolute top-2 right-2 opacity-90 hover:opacity-100 transition-opacity">
                <CompassHUD facing={player.facing} size={70} />
              </div>

              {/* Stats overlay - bottom left */}
              <div className="absolute bottom-2 left-2 bg-slate-900/80 rounded-lg p-2 text-sm">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className={player.hp < player.maxHP * 0.3 ? 'text-red-400 font-bold' : ''}>
                      {player.hp}/{player.maxHP}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span>{player.gold}</span>
                  </div>
                </div>
              </div>

              {/* Combat indicator overlay - bottom center */}
              {combat.active && combat.monsterId && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-red-900/90 rounded-lg px-4 py-2 border border-red-600">
                  <div className="text-red-100 text-center text-sm">
                    <span className="font-bold">COMBAT!</span>
                    {' - Press SPACE to attack'}
                  </div>
                </div>
              )}

              {/* Death overlay */}
              {player.hp <= 0 && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-2">💀</div>
                    <h3 className="text-2xl font-bold text-red-400 mb-2">DEFEATED</h3>
                    <p className="text-slate-400 mb-4">Your journey ends here...</p>
                    <button
                      onClick={restartGame}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Turn Left */}
                <button
                  onClick={handleTurnLeft}
                  className="bg-slate-600 hover:bg-slate-500 text-white p-2 rounded flex items-center gap-1 text-sm"
                  title="Turn Left (Q)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Q</span>
                </button>

                {/* Movement cluster */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={moveForward}
                    className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"
                    title="Move Forward (W)"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={strafeLeft}
                      className="bg-slate-600 hover:bg-slate-500 text-white p-2 rounded"
                      title="Strafe Left (A)"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={moveBackward}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"
                      title="Move Backward (S)"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                    <button
                      onClick={strafeRight}
                      className="bg-slate-600 hover:bg-slate-500 text-white p-2 rounded"
                      title="Strafe Right (D)"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Turn Right */}
                <button
                  onClick={handleTurnRight}
                  className="bg-slate-600 hover:bg-slate-500 text-white p-2 rounded flex items-center gap-1 text-sm"
                  title="Turn Right (E)"
                >
                  <span className="hidden sm:inline">E</span>
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Divider */}
                <div className="w-px h-10 bg-slate-500 mx-2 hidden sm:block" />

                {/* Action buttons */}
                <button
                  onClick={searchAround}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
                  title="Search (F)"
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>

                {combat.active && (
                  <button
                    onClick={resolvePlayerAttack}
                    className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded flex items-center gap-1 text-sm font-bold animate-pulse"
                    title="Attack (Space)"
                  >
                    <Sword className="w-4 h-4" />
                    <span>Attack!</span>
                  </button>
                )}
              </div>

              {/* Key hints */}
              <div className="mt-2 text-center text-xs text-slate-400">
                <span className="hidden sm:inline">W/S: Move | A/D: Strafe | Q/E: Turn | F: Search | SPACE: Attack</span>
                <span className="sm:hidden">Use buttons or keyboard</span>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-3">
            {/* Stats Panel */}
            <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
              <h2 className="text-lg font-bold text-slate-300 mb-2 flex items-center gap-2">
                <Heart className="w-4 h-4" /> Hero Stats
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-slate-200">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span>HP: {player.hp}/{player.maxHP}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <Sword className="w-4 h-4 text-orange-400" />
                  <span>ATK: {player.atk}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>DEF: {player.def}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>Gold: {player.gold}</span>
                </div>
              </div>
            </div>

            {/* Combat Panel */}
            {combat.active && combat.monsterId && (
              <div className="bg-red-900/50 rounded-lg p-3 border border-red-600">
                <h3 className="font-bold text-red-200 mb-2 flex items-center gap-2">
                  <Sword className="w-4 h-4" /> Combat
                </h3>
                {(() => {
                  const instance = game.monstersById[combat.monsterId!];
                  const archetype = instance ? game.archetypesById[instance.archetypeId] : null;
                  return (
                    <div className="text-sm">
                      <div className="font-bold text-red-100">{archetype?.name ?? 'Monster'}</div>
                      <div className="text-red-200">
                        HP: {instance?.hp ?? '?'} / {archetype?.maxHP ?? '?'}
                      </div>
                      <div className="text-red-300 text-xs">
                        ATK: {archetype?.atk ?? '?'} | DEF: {archetype?.def ?? '?'}
                      </div>
                      {/* HP Bar */}
                      <div className="mt-2 h-2 bg-red-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 transition-all duration-300"
                          style={{ width: `${((instance?.hp ?? 0) / (archetype?.maxHP ?? 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Inventory */}
            <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
              <h2 className="text-lg font-bold text-slate-300 mb-2 flex items-center gap-2">
                <Gift className="w-4 h-4" /> Inventory
              </h2>
              <div className="text-sm text-slate-300 max-h-24 overflow-y-auto">
                {inventory.length === 0 ? (
                  <p className="text-slate-400 italic">Empty</p>
                ) : (
                  inventory.map((item, i) => <div key={i}>• {item}</div>)
                )}
              </div>
            </div>

            {/* Game Log */}
            <div className="bg-slate-700 rounded-lg p-3 border border-slate-600 flex-1">
              <h2 className="text-lg font-bold text-slate-300 mb-2">Game Log</h2>
              <div
                ref={logContainerRef}
                className="bg-slate-900 rounded p-2 h-48 overflow-y-auto text-xs text-slate-300 space-y-1"
              >
                {log.map((entry, i) => (
                  <div key={i} className="border-b border-slate-700 pb-1">
                    {entry}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NorseDungeonCrawler;
