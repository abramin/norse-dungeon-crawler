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
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  color: string;
  size: number;
}

const palette: Record<string, string> = {
  wall: '#0d101c',
  room: '#2c3a4f',
  corridor: '#1f2937',
  door: '#9ca3af',
  secretDoor: '#7dd3fc',
  trap: '#f97316',
  treasure: '#facc15',
  start: '#22c55e',
  boss: '#ef4444'
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const DungeonCanvas = forwardRef<DungeonCanvasHandle, DungeonCanvasProps>(({ tiles, player, combat, tileSize = 48 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const tilesRef = useRef<Tile[][]>(tiles);
  const playerRef = useRef<PlayerState>(player);
  const combatRef = useRef<CombatState>(combat);
  const renderPlayerRef = useRef<{ x: number; y: number }>({ x: player.x + 0.5, y: player.y + 0.5 });
  const flashRef = useRef({ player: 0, monster: 0 });
  const shakeRef = useRef<{ until: number; intensity: number }>({ until: 0, intensity: 0 });
  const patternsRef = useRef<Record<string, CanvasPattern | null>>({});
  const dprRef = useRef<number>(1);
  const tileSizeRef = useRef<number>(tileSize);

  useImperativeHandle(ref, () => ({
    spawnParticles: (x, y, kind = 'treasure') => {
      const color = kind === 'treasure' ? '#facc15' : '#e11d48';
      const burst: Particle[] = Array.from({ length: 16 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 0.6;
        return {
          x: x + 0.5,
          y: y + 0.5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          ttl: 360 + Math.random() * 520,
          color,
          size: 0.09 + Math.random() * 0.06
        };
      });
      particlesRef.current = [...particlesRef.current, ...burst];
    },
    hitFlash: (target) => {
      flashRef.current = { ...flashRef.current, [target]: 1 };
    },
    screenShake: (duration = 220, intensity = 6) => {
      const now = performance.now();
      shakeRef.current = { until: now + duration, intensity };
    }
  }));

  useEffect(() => {
    tilesRef.current = tiles;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const width = tiles[0]?.length ?? 0;
    const height = tiles.length;
    canvas.width = width * tileSize * dpr;
    canvas.height = height * tileSize * dpr;
    canvas.style.width = `${width * tileSize}px`;
    canvas.style.height = `${height * tileSize}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [tiles, tileSize]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    combatRef.current = combat;
  }, [combat]);

  useEffect(() => {
    tileSizeRef.current = tileSize;
  }, [tileSize]);

  const createPattern = (type: 'stone' | 'plank' | 'hatch', base: string, accent: string) => {
    const off = document.createElement('canvas');
    off.width = 64;
    off.height = 64;
    const c = off.getContext('2d');
    if (!c) return null;
    c.fillStyle = base;
    c.fillRect(0, 0, off.width, off.height);

    c.lineWidth = type === 'plank' ? 4 : 2;
    c.strokeStyle = accent;
    c.globalAlpha = 0.2;
    c.beginPath();
    if (type === 'stone') {
      for (let i = 8; i < 64; i += 16) {
        c.moveTo(i, 0);
        c.lineTo(i - 8, 64);
      }
      for (let j = 12; j < 64; j += 18) {
        c.moveTo(0, j);
        c.lineTo(64, j - 6);
      }
    } else if (type === 'plank') {
      for (let i = 0; i <= 64; i += 16) {
        c.moveTo(i, 0);
        c.lineTo(i, 64);
      }
    } else {
      for (let i = 0; i < 64; i += 8) {
        c.moveTo(i, 0);
        c.lineTo(i + 8, 64);
      }
    }
    c.stroke();
    c.globalAlpha = 0.08;
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const r = Math.random() * 1.6 + 0.6;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    return c.createPattern(off, 'repeat');
  };

  const drawTile = (ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number) => {
    const px = x * size;
    const py = y * size;
    const radius = 6;
    const isVisible = tile.visible;
    const isExplored = tile.explored;
    const lighting = isVisible ? 1 : isExplored ? 0.45 : 0.2;

    const baseColor = palette[tile.type] ?? '#0f172a';
    const gradient = ctx.createLinearGradient(px, py, px, py + size);
    gradient.addColorStop(0, `${baseColor}ee`);
    gradient.addColorStop(1, `${baseColor}aa`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(px + radius, py);
    ctx.lineTo(px + size - radius, py);
    ctx.quadraticCurveTo(px + size, py, px + size, py + radius);
    ctx.lineTo(px + size, py + size - radius);
    ctx.quadraticCurveTo(px + size, py + size, px + size - radius, py + size);
    ctx.lineTo(px + radius, py + size);
    ctx.quadraticCurveTo(px, py + size, px, py + size - radius);
    ctx.lineTo(px, py + radius);
    ctx.quadraticCurveTo(px, py, px + radius, py);
    ctx.closePath();
    ctx.fill();

    let patternKey: string | null = null;
    if (tile.type === 'room') patternKey = 'stone';
    if (tile.type === 'corridor') patternKey = 'hatch';
    if (tile.type === 'door') patternKey = 'plank';
    if (patternKey) {
      if (!patternsRef.current[patternKey]) {
        if (patternKey === 'stone') patternsRef.current[patternKey] = createPattern('stone', baseColor, '#9ca3af');
        if (patternKey === 'hatch') patternsRef.current[patternKey] = createPattern('hatch', baseColor, '#7c3aed');
        if (patternKey === 'plank') patternsRef.current[patternKey] = createPattern('plank', '#4b5563', '#111827');
      }
      const pattern = patternsRef.current[patternKey];
      if (pattern) {
        ctx.globalAlpha = 0.2 + 0.2 * lighting;
        ctx.fillStyle = pattern;
        ctx.fillRect(px, py, size, size);
        ctx.globalAlpha = 1;
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);

    const rim = ctx.createLinearGradient(px, py, px + size, py + size);
    rim.addColorStop(0, 'rgba(255,255,255,0.08)');
    rim.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);

    if (tile.type === 'secretDoor' && tile.revealed) {
      ctx.strokeStyle = '#7dd3fc';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px + 8, py + 8, size - 16, size - 16);
      ctx.setLineDash([]);
    }

    if (tile.type === 'door') {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px + size * 0.2, py + size * 0.5);
      ctx.lineTo(px + size * 0.8, py + size * 0.5);
      ctx.stroke();
    }

    if (tile.type === 'trap' && (tile.revealed || combatRef.current.active)) {
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px + size * 0.2, py + size * 0.8);
      ctx.lineTo(px + size * 0.5, py + size * 0.2);
      ctx.lineTo(px + size * 0.8, py + size * 0.8);
      ctx.closePath();
      ctx.stroke();
    }

    if (tile.type === 'treasure') {
      const g = ctx.createLinearGradient(px, py, px, py + size);
      g.addColorStop(0, '#f8e7a6');
      g.addColorStop(1, '#eab308');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 2;
      const chestX = px + size * 0.22;
      const chestY = py + size * 0.28;
      const chestW = size * 0.56;
      const chestH = size * 0.44;
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(chestX + r, chestY);
      ctx.lineTo(chestX + chestW - r, chestY);
      ctx.quadraticCurveTo(chestX + chestW, chestY, chestX + chestW, chestY + r);
      ctx.lineTo(chestX + chestW, chestY + chestH - r);
      ctx.quadraticCurveTo(chestX + chestW, chestY + chestH, chestX + chestW - r, chestY + chestH);
      ctx.lineTo(chestX + r, chestY + chestH);
      ctx.quadraticCurveTo(chestX, chestY + chestH, chestX, chestY + chestH - r);
      ctx.lineTo(chestX, chestY + r);
      ctx.quadraticCurveTo(chestX, chestY, chestX + r, chestY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(px + size * 0.3, py + size * 0.36);
      ctx.lineTo(px + size * 0.7, py + size * 0.36);
      ctx.stroke();
    }

    if (tile.type === 'start' || tile.type === 'boss') {
      const ring = ctx.createRadialGradient(
        px + size / 2,
        py + size / 2,
        size * 0.08,
        px + size / 2,
        py + size / 2,
        size * 0.46
      );
      ring.addColorStop(0, tile.type === 'start' ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.6)');
      ring.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ring;
      ctx.fillRect(px, py, size, size);
    }

    if (!isVisible) {
      ctx.fillStyle = `rgba(4,6,15,${clamp(1 - lighting, 0.45, 0.82)})`;
      ctx.fillRect(px, py, size, size);
    } else {
      const glow = ctx.createRadialGradient(
        px + size / 2,
        py + size / 2,
        size * 0.05,
        px + size / 2,
        py + size / 2,
        size * 0.7
      );
      glow.addColorStop(0, 'rgba(255,255,255,0.08)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px, py, size, size);
    }

    if (!isExplored) {
      ctx.fillStyle = 'rgba(5,7,12,0.8)';
      ctx.fillRect(px, py, size, size);
    }
  };

  const drawToken = (
    ctx: CanvasRenderingContext2D,
    position: { x: number; y: number },
    size: number,
    fill: string,
    outline: string,
    shadow: string
  ) => {
    const px = position.x * size;
    const py = position.y * size;
    const r = size * 0.32;
    const cx = px + size / 2;
    const cy = py + size / 2;
    const gradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r * 1.1);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, fill);

    ctx.save();
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = gradient;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame: number;
    let last = performance.now();

    const render = (time: number) => {
      const dt = time - last;
      last = time;
      const currentTiles = tilesRef.current;
      const width = currentTiles[0]?.length ?? 0;
      const height = currentTiles.length;
      const size = tileSizeRef.current;

      const canvasWidth = width * size;
      const canvasHeight = height * size;

      if (canvas.style.width !== `${canvasWidth}px` || canvas.style.height !== `${canvasHeight}px`) {
        const dpr = dprRef.current;
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const bgGradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      bgGradient.addColorStop(0, '#0b1220');
      bgGradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.save();

      const now = performance.now();
      if (shakeRef.current.until > now) {
        const intensity = shakeRef.current.intensity * ((shakeRef.current.until - now) / 300);
        const offsetX = (Math.random() - 0.5) * intensity;
        const offsetY = (Math.random() - 0.5) * intensity;
        ctx.translate(offsetX, offsetY);
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = currentTiles[y][x];
          drawTile(ctx, tile, x, y, size);
        }
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = currentTiles[y][x];
          if (tile.visible && tile.monsterId) {
            const fill = tile.type === 'boss' ? '#f43f5e' : '#f97316';
            const outline = tile.type === 'boss' ? '#fecdd3' : '#fed7aa';
            drawToken(ctx, { x, y }, size, fill, outline, 'rgba(248,113,113,0.8)');
          }
        }
      }

      const targetPos = { x: playerRef.current.x + 0.5, y: playerRef.current.y + 0.5 };
      const lerpSpeed = 1 - Math.pow(1 - 0.18, dt / 16.67);
      renderPlayerRef.current = {
        x: lerp(renderPlayerRef.current.x, targetPos.x, lerpSpeed),
        y: lerp(renderPlayerRef.current.y, targetPos.y, lerpSpeed)
      };
      drawToken(ctx, renderPlayerRef.current, size, '#34d399', '#99f6e4', 'rgba(52,211,153,0.9)');

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life += dt;
        if (p.life < p.ttl) {
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          const alpha = 1 - p.life / p.ttl;
          const s = size * p.size;
          const gradient = ctx.createRadialGradient(p.x * size, p.y * size, 0, p.x * size, p.y * size, s * 2.4);
          gradient.addColorStop(0, `${p.color}ff`);
          gradient.addColorStop(1, `${p.color}00`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x * size, p.y * size, s * 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x * size, p.y * size, s, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          return true;
        }
        return false;
      });

      if (flashRef.current.player > 0 || flashRef.current.monster > 0) {
        const playerFlash = flashRef.current.player;
        const monsterFlash = flashRef.current.monster;
        if (playerFlash > 0) flashRef.current.player = clamp(playerFlash - dt / 220, 0, 1);
        if (monsterFlash > 0) flashRef.current.monster = clamp(monsterFlash - dt / 220, 0, 1);
        if (playerFlash > 0) {
          ctx.fillStyle = `rgba(52,211,153,${playerFlash * 0.25})`;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
        if (monsterFlash > 0) {
          ctx.fillStyle = `rgba(239,68,68,${monsterFlash * 0.25})`;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
      }

      ctx.restore();

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-lg border-2 border-slate-800 bg-slate-950" />;
});

DungeonCanvas.displayName = 'DungeonCanvas';

export default DungeonCanvas;
