import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { CombatState, PlayerState, Tile } from './types';

interface DungeonCanvasProps {
  tiles: Tile[][];
  player: PlayerState;
  combat: CombatState;
  tileSize?: number;
}

export interface DungeonCanvasHandle {
  spawnParticles: (x: number, y: number, kind?: 'treasure' | 'monster') => void;
  hitFlash: (target: 'player' | 'monster') => void;
  screenShake?: (duration?: number, intensity?: number) => void;
}

interface Particle {
  x: number;
  y: number;
  life: number;
  ttl: number;
  color: string;
}

const palette: Record<string, string> = {
  wall: '#1f2937',
  room: '#475569',
  corridor: '#334155',
  door: '#9ca3af',
  secretDoor: '#7dd3fc',
  trap: '#f97316',
  treasure: '#facc15',
  start: '#22c55e',
  boss: '#ef4444'
};

const DungeonCanvas = forwardRef<DungeonCanvasHandle, DungeonCanvasProps>(({ tiles, player, combat, tileSize = 48 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useImperativeHandle(ref, () => ({
    spawnParticles: (x, y, kind = 'treasure') => {
      const color = kind === 'treasure' ? '#facc15' : '#e11d48';
      const burst: Particle[] = Array.from({ length: 12 }, () => ({
        x: x + 0.5,
        y: y + 0.5,
        life: 0,
        ttl: 300 + Math.random() * 300,
        color
      }));
      particlesRef.current = [...particlesRef.current, ...burst];
    },
    hitFlash: () => {
      // intentionally minimal for logic-only pass
    },
    screenShake: () => {
      // no-op placeholder
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = tiles[0]?.length ?? 0;
    const height = tiles.length;
    canvas.width = width * tileSize;
    canvas.height = height * tileSize;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = tiles[y][x];
          const color = palette[tile.type] ?? '#0f172a';
          ctx.fillStyle = tile.explored ? color : '#0f172a';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          if (!tile.visible) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
          if (tile.visible && tile.monsterId) {
            ctx.fillStyle = tile.type === 'boss' ? '#f87171' : '#ef4444';
            ctx.beginPath();
            ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, tileSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          if (tile.visible && tile.type === 'trap' && (tile.revealed || combat.active)) {
            ctx.fillStyle = '#fb923c';
            ctx.fillRect(x * tileSize + tileSize * 0.25, y * tileSize + tileSize * 0.25, tileSize * 0.5, tileSize * 0.5);
          }
          if (tile.visible && tile.type === 'treasure') {
            ctx.fillStyle = '#facc15';
            ctx.fillRect(x * tileSize + tileSize * 0.2, y * tileSize + tileSize * 0.2, tileSize * 0.6, tileSize * 0.6);
          }
          if (tile.visible && tile.type === 'secretDoor' && tile.revealed) {
            ctx.strokeStyle = '#7dd3fc';
            ctx.strokeRect(x * tileSize + 6, y * tileSize + 6, tileSize - 12, tileSize - 12);
          }
        }
      }

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc((player.x + 0.5) * tileSize, (player.y + 0.5) * tileSize, tileSize * 0.3, 0, Math.PI * 2);
      ctx.fill();

      const now = performance.now();
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life += 16;
        if (p.life < p.ttl) {
          const alpha = 1 - p.life / p.ttl;
          ctx.fillStyle = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x * tileSize, p.y * tileSize, tileSize * 0.08, 0, Math.PI * 2);
          ctx.fill();
          return true;
        }
        return false;
      });

      requestAnimationFrame(draw);
    };

    draw();
  }, [tiles, player, tileSize, combat]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-lg border-2 border-slate-800 bg-slate-950" />;
});

DungeonCanvas.displayName = 'DungeonCanvas';

export default DungeonCanvas;
