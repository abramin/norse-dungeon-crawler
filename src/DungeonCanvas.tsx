import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { CombatState, DungeonTile, PlayerState } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  color: string;
}

interface Flash {
  target: 'player' | 'enemy';
  ttl: number;
  duration: number;
  color: string;
}

interface Shake {
  duration: number;
  elapsed: number;
  intensity: number;
}

interface DungeonCanvasProps {
  dungeon: DungeonTile[][];
  explored: Set<string>;
  player: PlayerState;
  combat: CombatState | null;
  tileSize?: number;
  visionRadius: number;
}

export interface DungeonCanvasHandle {
  spawnTreasureParticles: (x: number, y: number) => void;
  flashTarget: (target: 'player' | 'enemy', power?: number) => void;
  shake: (duration?: number, intensity?: number) => void;
}

const palette: Record<string, string> = {
  wall: '#1f2937',
  corridor: '#334155',
  floor: '#475569',
  door: '#9ca3af',
  secret: '#7dd3fc',
  trap: '#f97316',
  treasure: '#facc15',
  start: '#22c55e',
  boss: '#ef4444',
  enemy: '#b91c1c',
  item: '#a855f7',
  puzzle: '#6366f1',
  empty: '#475569'
};

const DungeonCanvas = forwardRef<DungeonCanvasHandle, DungeonCanvasProps>(
  ({ dungeon, explored, player, combat, tileSize = 48, visionRadius }, ref)
) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();
  const propsRef = useRef({ dungeon, explored, player, combat });
  const particlesRef = useRef<Particle[]>([]);
  const flashesRef = useRef<Flash[]>([]);
  const shakeRef = useRef<Shake | null>(null);
  const renderedPlayerRef = useRef<{ x: number; y: number }>({ x: player.x, y: player.y });
  const dimsRef = useRef<{ width: number; height: number }>({ width: dungeon[0]?.length || 0, height: dungeon.length || 0 });
  const timeRef = useRef({ last: 0, elapsed: 0 });

  useEffect(() => {
    propsRef.current = { dungeon, explored, player, combat };
    dimsRef.current = {
      width: (dungeon[0]?.length || 0) * tileSize,
      height: (dungeon.length || 0) * tileSize
    };
  }, [dungeon, explored, player, combat, tileSize]);

  useImperativeHandle(ref, () => ({
    spawnTreasureParticles: (x, y) => {
      const count = 12;
      const created: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.05 + Math.random() * 0.15;
        created.push({
          x: x + 0.5,
          y: y + 0.5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          ttl: 300 + Math.random() * 300,
          color: '#facc15'
        });
      }
      particlesRef.current = [...particlesRef.current, ...created];
    },
    flashTarget: (target, power = 1) => {
      flashesRef.current = [
        ...flashesRef.current,
        {
          target,
          ttl: 120,
          duration: 120,
          color: target === 'player' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.5)'
        }
      ];
      if (power >= 8) {
        shakeRef.current = { duration: 220, elapsed: 0, intensity: 6 };
      }
    },
    shake: (duration = 200, intensity = 5) => {
      shakeRef.current = { duration, elapsed: 0, intensity };
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimsRef.current;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // Scale drawing to handle high-DPI displays for crisp pixels.
    ctx.scale(dpr, dpr);

    timeRef.current = { last: performance.now(), elapsed: 0 };

    const render = (timestamp: number) => {
      const delta = timestamp - timeRef.current.last;
      timeRef.current.last = timestamp;
      timeRef.current.elapsed += delta;

      drawFrame(ctx, delta);
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [tileSize, dungeon]);

  const drawFrame = (ctx: CanvasRenderingContext2D, delta: number) => {
    const { dungeon: map, explored: exploredSet, player: currentPlayer, combat: currentCombat } = propsRef.current;
    if (!map.length) return;

    const { width, height } = dimsRef.current;

    // Smooth player rendering by easing towards the logical grid position.
    renderedPlayerRef.current = {
      x: renderedPlayerRef.current.x + (currentPlayer.x - renderedPlayerRef.current.x) * 0.18,
      y: renderedPlayerRef.current.y + (currentPlayer.y - renderedPlayerRef.current.y) * 0.18
    };

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const shake = shakeRef.current;
    if (shake) {
      shake.elapsed += delta;
      if (shake.elapsed < shake.duration) {
        const force = (shake.duration - shake.elapsed) / shake.duration;
        ctx.translate((Math.random() - 0.5) * shake.intensity * force, (Math.random() - 0.5) * shake.intensity * force);
      } else {
        shakeRef.current = null;
      }
    }

    drawTiles(ctx, map, exploredSet, currentPlayer);
    drawEntities(ctx, map, exploredSet, currentPlayer, currentCombat);
    applyLighting(ctx);
    drawParticles(ctx, delta);
    drawFlashes(ctx, delta);

    ctx.restore();
  };

  const drawTiles = (
    ctx: CanvasRenderingContext2D,
    map: DungeonTile[][],
    exploredSet: Set<string>,
    currentPlayer: PlayerState
  ) => {
    const cols = map[0].length;
    const rows = map.length;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = map[y][x];
        const exploredKey = `${x},${y}`;
        const isExplored = exploredSet.has(exploredKey);
        const dist = Math.hypot(currentPlayer.x - x, currentPlayer.y - y);
        const isVisible = dist <= visionRadius;
        const baseColor = palette[tile.type] || palette.empty;

        if (!isExplored) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          continue;
        }

        ctx.fillStyle = baseColor;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

        if (!isVisible) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  };

  const drawEntities = (
    ctx: CanvasRenderingContext2D,
    map: DungeonTile[][],
    exploredSet: Set<string>,
    currentPlayer: PlayerState,
    currentCombat: CombatState | null
  ) => {
    const cols = map[0].length;
    const rows = map.length;
    const pulse = 0.5 + Math.sin(timeRef.current.elapsed / 200) * 0.5;
    const playerCenter = {
      x: (renderedPlayerRef.current.x + 0.5) * tileSize,
      y: (renderedPlayerRef.current.y + 0.5) * tileSize
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = map[y][x];
        const exploredKey = `${x},${y}`;
        if (!exploredSet.has(exploredKey)) continue;

        const centerX = x * tileSize + tileSize / 2;
        const centerY = y * tileSize + tileSize / 2;

        if (tile.type === 'enemy' || tile.type === 'boss') {
          ctx.fillStyle = tile.type === 'boss' ? '#f87171' : '#ef4444';
          ctx.beginPath();
          ctx.arc(centerX, centerY, tileSize * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = `${tileSize * 0.35}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const marker = tile.type === 'boss' ? 'F' : tile.enemy?.name?.[0] ?? 'M';
          ctx.fillText(marker, centerX, centerY + 1);

          if (currentCombat && currentPlayer.x === x && currentPlayer.y === y) {
            ctx.strokeStyle = `rgba(255,255,255,${0.4 + pulse * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, tileSize * 0.4 + pulse * 2, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (tile.type === 'treasure') {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(centerX - tileSize * 0.2, centerY - tileSize * 0.12, tileSize * 0.4, tileSize * 0.24);
          ctx.fillStyle = '#854d0e';
          ctx.fillRect(centerX - tileSize * 0.2, centerY, tileSize * 0.4, tileSize * 0.12);
        } else if (tile.type === 'item') {
          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.moveTo(centerX, centerY - tileSize * 0.2);
          ctx.lineTo(centerX + tileSize * 0.2, centerY + tileSize * 0.2);
          ctx.lineTo(centerX - tileSize * 0.2, centerY + tileSize * 0.2);
          ctx.closePath();
          ctx.fill();
        } else if (tile.type === 'puzzle') {
          ctx.strokeStyle = '#a5b4fc';
          ctx.lineWidth = 2;
          ctx.strokeRect(centerX - tileSize * 0.22, centerY - tileSize * 0.22, tileSize * 0.44, tileSize * 0.44);
        }
      }
    }

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(playerCenter.x, playerCenter.y, tileSize * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    ctx.font = `${tileSize * 0.32}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ᚠ', playerCenter.x, playerCenter.y + 1);
  };

  const applyLighting = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimsRef.current;
    const centerX = (renderedPlayerRef.current.x + 0.5) * tileSize;
    const centerY = (renderedPlayerRef.current.y + 0.5) * tileSize;
    const radius = tileSize * (visionRadius + 0.5);

    // Draw a dark overlay then remove a radial gradient around the player for soft lighting.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(centerX, centerY, tileSize * 0.6, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, delta: number) => {
    const next: Particle[] = [];
    particlesRef.current.forEach((p) => {
      p.life += delta;
      if (p.life < p.ttl) {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        const alpha = 1 - p.life / p.ttl;
        ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x * tileSize, p.y * tileSize, tileSize * 0.08 + alpha * tileSize * 0.04, 0, Math.PI * 2);
        ctx.fill();
        next.push(p);
      }
    });
    particlesRef.current = next;
  };

  const drawFlashes = (ctx: CanvasRenderingContext2D, delta: number) => {
    const next: Flash[] = [];
    flashesRef.current.forEach((flash) => {
      flash.ttl -= delta;
      if (flash.ttl > 0) {
        const alpha = Math.max(0, flash.ttl / flash.duration);
        ctx.save();
        ctx.fillStyle = flash.color.replace(/0\.\d+\)/, `${alpha})`);
        ctx.fillRect(0, 0, dimsRef.current.width, dimsRef.current.height);
        ctx.restore();
        next.push(flash);
      }
    });
    flashesRef.current = next;
  };

  return <canvas ref={canvasRef} className="w-full rounded-lg border-2 border-slate-800 bg-slate-950" />;
});

DungeonCanvas.displayName = 'DungeonCanvas';

export default DungeonCanvas;
