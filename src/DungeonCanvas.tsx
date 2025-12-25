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
  wall: '#070910',
  wallSide: '#03040a',
  wallDeep: '#010309',
  room: '#2f3f5b',
  corridor: '#1b2434',
  door: '#c0a16d',
  secretDoor: '#7dd3fc',
  trap: '#f97316',
  treasure: '#facc15',
  start: '#22c55e',
  boss: '#ef4444'
};

const RenderSettings = {
  wallHeightPx: 12,
  shadowStrength: 0.35,
  shadowBlur: 14,
  shadowReachTiles: 2
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pseudoRandom = (x: number, y: number, seed = 1) => {
  const s = Math.sin(x * 374761393 + y * 668265263 + seed * 31.4159) * 43758.5453;
  return s - Math.floor(s);
};

const DungeonCanvas = forwardRef<DungeonCanvasHandle, DungeonCanvasProps>(({ tiles, player, combat, tileSize = 48 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const tilesRef = useRef<Tile[][]>(tiles);
  const playerRef = useRef<PlayerState>(player);
  const combatRef = useRef<CombatState>(combat);
  const renderPlayerRef = useRef<{ x: number; y: number }>({ x: player.x + 0.5, y: player.y + 0.5 });
  const flashRef = useRef({ player: 0, monster: 0 });
  const shakeRef = useRef<{ until: number; intensity: number }>({ until: 0, intensity: 0 });
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

  const getLighting = (tile: Tile) => (tile.visible ? 1 : tile.explored ? 0.55 : 0.18);

  const getDisplayType = (tile: Tile) =>
    tile.type === 'trap' && !tile.revealed && !tile.triggered
      ? tile.regionType === 'room'
        ? 'room'
        : 'corridor'
      : tile.type === 'secretDoor'
      ? tile.revealed
        ? 'door'
        : 'wall'
      : tile.type;

  const isPassableDisplayType = (type: string) => type !== 'wall' && type !== 'secretDoor';

  const drawFloorTile = (ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number) => {
    const displayType = getDisplayType(tile);
    if (displayType === 'wall' || displayType === 'door') return;

    const px = x * size;
    const py = y * size;
    const radius = 8;
    const lighting = getLighting(tile);
    const baseColor = palette[displayType] ?? palette.room;

    ctx.save();
    roundedRectPath(ctx, px + 2, py + 2, size - 4, size - 4, radius);

    const fillGradient = ctx.createLinearGradient(px, py, px + size, py + size);
    fillGradient.addColorStop(0, `${baseColor}`);
    fillGradient.addColorStop(1, `${baseColor}cc`);
    ctx.fillStyle = fillGradient;
    ctx.fill();

    const bevel = ctx.createLinearGradient(px, py, px + size, py + size);
    bevel.addColorStop(0, `rgba(255,255,255,${0.12 * lighting})`);
    bevel.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = bevel;
    ctx.fill();

    const innerShadow = ctx.createRadialGradient(
      px + size / 2,
      py + size / 2,
      size * 0.12,
      px + size / 2,
      py + size / 2,
      size * 0.7
    );
    innerShadow.addColorStop(0, 'rgba(0,0,0,0)');
    innerShadow.addColorStop(1, `rgba(0,0,0,${0.55 * (1 - lighting)})`);
    ctx.fillStyle = innerShadow;
    ctx.fill();

    if (displayType === 'room') {
      ctx.fillStyle = `rgba(255,255,255,${0.12 * lighting})`;
      for (let i = 0; i < 6; i++) {
        const ox = pseudoRandom(x + i * 3, y + i * 7, 2);
        const oy = pseudoRandom(x + i * 5, y + i * 11, 3);
        ctx.beginPath();
        ctx.arc(px + size * (0.15 + ox * 0.7), py + size * (0.2 + oy * 0.6), size * (0.01 + ox * 0.015), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (displayType === 'corridor') {
      ctx.save();
      ctx.translate(px + size / 2, py + size / 2);
      const angle = pseudoRandom(x, y) > 0.5 ? Math.PI / 4 : -Math.PI / 4;
      ctx.rotate(angle);
      ctx.strokeStyle = `rgba(124,58,237,${0.28 * lighting})`;
      ctx.lineWidth = 1.4;
      for (let i = -size; i < size; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, -size);
        ctx.lineTo(i, size);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = displayType === 'room' ? 3 : 2;
    roundedRectPath(ctx, px + 1.5, py + 1.5, size - 3, size - 3, radius);
    ctx.stroke();

    if (tile.type === 'trap' && tile.revealed) {
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(px + size * 0.22, py + size * 0.78);
      ctx.lineTo(px + size * 0.5, py + size * 0.18);
      ctx.lineTo(px + size * 0.78, py + size * 0.78);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + size * 0.28, py + size * 0.66);
      ctx.lineTo(px + size * 0.5, py + size * 0.35);
      ctx.lineTo(px + size * 0.72, py + size * 0.66);
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
      ring.addColorStop(0, tile.type === 'start' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.6)');
      ring.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ring;
      ctx.fillRect(px, py, size, size);
    }

    ctx.restore();
  };

  const roundedRectPath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /**
   * Render an extruded wall tile composed of side faces (south/east), a top cap, and subtle edge highlights.
   * Drawing order matters: faces first so the beveled top can cover seams, then outlines.
   */
  const drawWallExtrusion = (
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    x: number,
    y: number,
    size: number
  ) => {
    const px = x * size;
    const py = y * size;
    const radius = 8;
    const lighting = getLighting(tile);
    const wallTop = palette.wall;
    const side = palette.wallSide;
    const deep = palette.wallDeep;
    const h = RenderSettings.wallHeightPx;
    const faceInset = 3;

    // South face (falls off the bottom edge)
    ctx.save();
    ctx.fillStyle = `${side}f0`;
    ctx.beginPath();
    ctx.moveTo(px + faceInset, py + size - faceInset);
    ctx.lineTo(px + size - faceInset, py + size - faceInset);
    ctx.lineTo(px + size - faceInset, py + size - faceInset + h);
    ctx.lineTo(px + faceInset, py + size - faceInset + h);
    ctx.closePath();
    ctx.fill();

    const southShade = ctx.createLinearGradient(px, py + size - faceInset, px, py + size + h);
    southShade.addColorStop(0, 'rgba(0,0,0,0)');
    southShade.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = southShade;
    ctx.fill();

    // East face (extrudes to the right)
    ctx.fillStyle = `${deep}f0`;
    ctx.beginPath();
    ctx.moveTo(px + size - faceInset, py + faceInset);
    ctx.lineTo(px + size - faceInset + h, py + faceInset + h * 0.1);
    ctx.lineTo(px + size - faceInset + h, py + size - faceInset + h * 0.1);
    ctx.lineTo(px + size - faceInset, py + size - faceInset);
    ctx.closePath();
    ctx.fill();

    const eastShade = ctx.createLinearGradient(px + size - faceInset, py, px + size + h, py);
    eastShade.addColorStop(0, 'rgba(0,0,0,0)');
    eastShade.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = eastShade;
    ctx.fill();

    // Top face
    const baseColor = wallTop;
    roundedRectPath(ctx, px + 2, py + 2, size - 4, size - 4, radius);
    const fillGradient = ctx.createLinearGradient(px, py, px + size, py + size);
    fillGradient.addColorStop(0, `${baseColor}`);
    fillGradient.addColorStop(1, `${baseColor}dd`);
    ctx.fillStyle = fillGradient;
    ctx.fill();

    const bevel = ctx.createLinearGradient(px, py, px + size, py + size);
    bevel.addColorStop(0, `rgba(255,255,255,${0.08 * lighting})`);
    bevel.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = bevel;
    ctx.fill();

    // Edge highlights and shade lines on top face
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 3);
    ctx.lineTo(px + size - 4, py + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 3, py + 4);
    ctx.lineTo(px + 3, py + size - 4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + size - 3, py + 4);
    ctx.lineTo(px + size - 3, py + size - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 4, py + size - 3);
    ctx.lineTo(px + size - 3, py + size - 3);
    ctx.stroke();

    ctx.restore();
  };

  const drawDoorFace = (
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    x: number,
    y: number,
    size: number
  ) => {
    const px = x * size;
    const py = y * size;
    const panelW = size * 0.62;
    const panelH = size * 0.58;
    const lighting = getLighting(tile);

    ctx.save();
    ctx.fillStyle = palette.door;
    ctx.strokeStyle = '#2b1f12';
    ctx.lineWidth = 2.5;
    roundedRectPath(ctx, px + size * 0.19, py + size * 0.2, panelW, panelH, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(px + size * 0.68, py + size * 0.5, size * 0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255,255,255,${0.25 * lighting})`;
    ctx.beginPath();
    ctx.moveTo(px + size * 0.26, py + size * 0.32);
    ctx.lineTo(px + size * 0.74, py + size * 0.32);
    ctx.stroke();

    if (tile.type === 'secretDoor' && tile.revealed) {
      ctx.strokeStyle = '#7dd3fc';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2.2;
      roundedRectPath(ctx, px + 6, py + 6, size - 12, size - 12, 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#67e8f9';
      ctx.beginPath();
      ctx.moveTo(px + size * 0.5, py + size * 0.24);
      ctx.lineTo(px + size * 0.5, py + size * 0.4);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawShadow = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.18, size * 0.22, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawWallShadow = (
    ctx: CanvasRenderingContext2D,
    tiles: Tile[][],
    wallTile: Tile,
    x: number,
    y: number,
    size: number
  ) => {
    if (!wallTile.visible && !wallTile.explored) return;
    const reach = RenderSettings.shadowReachTiles;
    const offsets = [
      { dx: 1, dy: 0, alpha: 0.5 },
      { dx: 1, dy: 1, alpha: 0.8 },
      { dx: 2, dy: 1, alpha: 0.4 }
    ];
    const shadowOffset = RenderSettings.wallHeightPx * 0.8;

    offsets.forEach(({ dx, dy, alpha }) => {
      if (dx > reach || dy > reach) return;
      const tx = x + dx;
      const ty = y + dy;
      const target = tiles[ty]?.[tx];
      if (!target) return;
      if (!target.visible && !target.explored) return;
      const displayType = getDisplayType(target);
      if (!isPassableDisplayType(displayType)) return;

      const px = tx * size;
      const py = ty * size;
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${RenderSettings.shadowStrength * alpha})`;
      ctx.shadowColor = `rgba(0,0,0,${RenderSettings.shadowStrength * alpha})`;
      ctx.shadowBlur = RenderSettings.shadowBlur;
      roundedRectPath(ctx, px + 4, py + 4 + shadowOffset, size - 8, size - 8, 8);
      ctx.fill();
      ctx.restore();
    });
  };

  const applyVisibilityMask = (ctx: CanvasRenderingContext2D, tiles: Tile[][], size: number) => {
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];
        const px = x * size;
        const py = y * size;
        const lighting = getLighting(tile);

        if (!tile.visible) {
          ctx.fillStyle = `rgba(4,6,15,${clamp(1 - lighting, 0.45, 0.85)})`;
          ctx.fillRect(px, py, size, size);
        } else {
          const glow = ctx.createRadialGradient(
            px + size / 2,
            py + size / 2,
            size * 0.08,
            px + size / 2,
            py + size / 2,
            size * 0.7
          );
          glow.addColorStop(0, 'rgba(255,255,255,0.1)');
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(px, py, size, size);
        }

        if (!tile.explored) {
          ctx.fillStyle = 'rgba(5,7,12,0.8)';
          ctx.fillRect(px, py, size, size);
        }
      }
    }
  };

  const drawPlayerToken = (ctx: CanvasRenderingContext2D, position: { x: number; y: number }, size: number) => {
    const cx = position.x * size;
    const cy = position.y * size;
    const cloakGradient = ctx.createLinearGradient(cx, cy - size * 0.2, cx, cy + size * 0.3);
    cloakGradient.addColorStop(0, '#34d399');
    cloakGradient.addColorStop(1, '#0f766e');

    drawShadow(ctx, cx, cy, size);

    ctx.save();
    ctx.fillStyle = cloakGradient;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.18, cy - size * 0.02);
    ctx.quadraticCurveTo(cx - size * 0.08, cy - size * 0.18, cx, cy - size * 0.18);
    ctx.quadraticCurveTo(cx + size * 0.08, cy - size * 0.18, cx + size * 0.18, cy - size * 0.02);
    ctx.lineTo(cx + size * 0.14, cy + size * 0.22);
    ctx.quadraticCurveTo(cx, cy + size * 0.3, cx - size * 0.14, cy + size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    roundedRectPath(ctx, cx - size * 0.1, cy - size * 0.02, size * 0.2, size * 0.18, 6);
    ctx.fill();

    ctx.fillStyle = '#f9d4b5';
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.2, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.22, size * 0.11, Math.PI * 1.1, Math.PI * 2.1);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    roundedRectPath(ctx, cx - size * 0.22, cy + size * 0.02, size * 0.09, size * 0.16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.15, cy - size * 0.02);
    ctx.lineTo(cx + size * 0.26, cy - size * 0.18);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };

  const drawMonsterToken = (
    ctx: CanvasRenderingContext2D,
    position: { x: number; y: number },
    size: number,
    isBoss: boolean
  ) => {
    const cx = position.x * size;
    const cy = position.y * size;
    const scale = isBoss ? 1.1 : 1;
    const bodyGradient = ctx.createLinearGradient(cx, cy - size * 0.2, cx, cy + size * 0.3);
    bodyGradient.addColorStop(0, isBoss ? '#fb7185' : '#fb923c');
    bodyGradient.addColorStop(1, isBoss ? '#be123c' : '#c2410c');

    drawShadow(ctx, cx, cy, size * scale);

    ctx.save();
    ctx.fillStyle = bodyGradient;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.2 * scale, cy - size * 0.02);
    ctx.quadraticCurveTo(cx - size * 0.26 * scale, cy + size * 0.16, cx - size * 0.08 * scale, cy + size * 0.24);
    ctx.quadraticCurveTo(cx, cy + size * 0.32, cx + size * 0.08 * scale, cy + size * 0.24);
    ctx.quadraticCurveTo(cx + size * 0.26 * scale, cy + size * 0.16, cx + size * 0.2 * scale, cy - size * 0.02);
    ctx.quadraticCurveTo(cx + size * 0.1 * scale, cy - size * 0.22, cx, cy - size * 0.22);
    ctx.quadraticCurveTo(cx - size * 0.1 * scale, cy - size * 0.22, cx - size * 0.2 * scale, cy - size * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isBoss ? '#fecdd3' : '#fde68a';
    ctx.beginPath();
    ctx.arc(cx - size * 0.06 * scale, cy - size * 0.12, size * 0.04, 0, Math.PI * 2);
    ctx.arc(cx + size * 0.06 * scale, cy - size * 0.12, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.08 * scale, cy - size * 0.02);
    ctx.lineTo(cx + size * 0.08 * scale, cy - size * 0.02);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.2 * scale, cy - size * 0.2);
    ctx.lineTo(cx - size * 0.3 * scale, cy - size * 0.32);
    ctx.lineTo(cx - size * 0.12 * scale, cy - size * 0.26);
    ctx.closePath();
    ctx.moveTo(cx + size * 0.2 * scale, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.3 * scale, cy - size * 0.32);
    ctx.lineTo(cx + size * 0.12 * scale, cy - size * 0.26);
    ctx.closePath();
    ctx.fill();

    if (isBoss) {
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.14, cy - size * 0.28);
      ctx.lineTo(cx - size * 0.06, cy - size * 0.38);
      ctx.lineTo(cx, cy - size * 0.3);
      ctx.lineTo(cx + size * 0.06, cy - size * 0.38);
      ctx.lineTo(cx + size * 0.14, cy - size * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#a16207';
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.3 * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
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

      // Floor pass: rooms/corridors/treasure/traps as flat tiles.
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          drawFloorTile(ctx, currentTiles[y][x], x, y, size);
        }
      }

      // Wall shadows: cast down-right before we draw walls so fog/light darkens shadows too.
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = currentTiles[y][x];
          const displayType = getDisplayType(tile);
          if (displayType === 'wall' || tile.type === 'door' || tile.type === 'secretDoor') {
            drawWallShadow(ctx, currentTiles, tile, x, y, size);
          }
        }
      }

      // Extruded walls and doors (drawn after shadows for crisp edges).
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = currentTiles[y][x];
          const displayType = getDisplayType(tile);
          if (displayType === 'wall' || tile.type === 'door' || tile.type === 'secretDoor') {
            drawWallExtrusion(ctx, tile, x, y, size);
            if (tile.type === 'door' || (tile.type === 'secretDoor' && tile.revealed)) {
              drawDoorFace(ctx, tile, x, y, size);
            }
          }
        }
      }

      // Tokens
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = currentTiles[y][x];
          if (tile.visible && tile.monsterId) {
            drawMonsterToken(ctx, { x: x + 0.5, y: y + 0.5 }, size, tile.type === 'boss');
          }
        }
      }

      const targetPos = { x: playerRef.current.x + 0.5, y: playerRef.current.y + 0.5 };
      const lerpSpeed = 1 - Math.pow(1 - 0.18, dt / 16.67);
      renderPlayerRef.current = {
        x: lerp(renderPlayerRef.current.x, targetPos.x, lerpSpeed),
        y: lerp(renderPlayerRef.current.y, targetPos.y, lerpSpeed)
      };
      drawPlayerToken(ctx, renderPlayerRef.current, size);

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

      // Fog of war and light mask applied after geometry and effects so shadows inherit darkness.
      applyVisibilityMask(ctx, currentTiles, size);

      const vignette = ctx.createRadialGradient(
        canvasWidth / 2,
        canvasHeight / 2,
        Math.max(canvasWidth, canvasHeight) * 0.2,
        canvasWidth / 2,
        canvasHeight / 2,
        Math.max(canvasWidth, canvasHeight) * 0.8
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

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
