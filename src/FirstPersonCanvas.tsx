import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { CombatState, PlayerState, Tile } from './types';
import {
  castAllRays,
  getVisibleEntities,
  facingToAngle,
  RaycastResult,
  VisibleEntity,
} from './RaycastEngine';

interface FirstPersonCanvasProps {
  tiles: Tile[][];
  player: PlayerState;
  combat: CombatState;
  width?: number;
  height?: number;
}

export interface FirstPersonCanvasHandle {
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

// Color palette
const palette = {
  wall: '#1a1a2e',
  wallLight: '#252540',
  wallDark: '#0f0f1a',
  ceiling: '#0a0a14',
  floor: '#1e1e30',
  floorLight: '#282840',
  room: '#2a3a50',
  corridor: '#1e2a3a',
  door: '#8b6914',
  doorFrame: '#5c4a12',
  treasure: '#ffd700',
  trap: '#ff4500',
  monster: '#ff6b35',
  boss: '#ff1744',
  fog: '#0a0a14',
};

const FOV = Math.PI / 3; // 60 degrees

const FirstPersonCanvas = forwardRef<FirstPersonCanvasHandle, FirstPersonCanvasProps>(
  ({ tiles, player, combat, width = 640, height = 400 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const tilesRef = useRef<Tile[][]>(tiles);
    const playerRef = useRef<PlayerState>(player);
    const combatRef = useRef<CombatState>(combat);
    const flashRef = useRef({ player: 0, monster: 0 });
    const shakeRef = useRef<{ until: number; intensity: number }>({ until: 0, intensity: 0 });
    const animationRef = useRef<{ angle: number; targetAngle: number; bobPhase: number }>({
      angle: facingToAngle(player.facing),
      targetAngle: facingToAngle(player.facing),
      bobPhase: 0,
    });

    useImperativeHandle(ref, () => ({
      spawnParticles: (x, y, kind = 'treasure') => {
        const color = kind === 'treasure' ? '#ffd700' : '#ff1744';
        const burst: Particle[] = Array.from({ length: 20 }, () => ({
          x: width / 2 + (Math.random() - 0.5) * 100,
          y: height / 2 + (Math.random() - 0.5) * 50,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 6 - 2,
          life: 0,
          ttl: 400 + Math.random() * 400,
          color,
          size: 3 + Math.random() * 4,
        }));
        particlesRef.current = [...particlesRef.current, ...burst];
      },
      hitFlash: (target) => {
        flashRef.current = { ...flashRef.current, [target]: 1 };
      },
      screenShake: (duration = 200, intensity = 8) => {
        shakeRef.current = { until: performance.now() + duration, intensity };
      },
    }));

    useEffect(() => {
      tilesRef.current = tiles;
    }, [tiles]);

    useEffect(() => {
      playerRef.current = player;
      animationRef.current.targetAngle = facingToAngle(player.facing);
    }, [player]);

    useEffect(() => {
      combatRef.current = combat;
    }, [combat]);

    // Draw a vertical wall strip with shading
    const drawWallStrip = (
      ctx: CanvasRenderingContext2D,
      x: number,
      ray: RaycastResult,
      screenHeight: number
    ) => {
      const lineHeight = screenHeight / ray.distance;
      const drawStart = Math.max(0, (screenHeight - lineHeight) / 2);
      const drawEnd = Math.min(screenHeight, (screenHeight + lineHeight) / 2);

      // Calculate color based on distance and side
      const shade = Math.max(0.2, 1 - ray.distance / 12);
      const sideShade = ray.side === 'ew' ? 0.7 : 1;

      let baseColor: string;
      switch (ray.tileType) {
        case 'door':
          baseColor = palette.door;
          break;
        case 'secretDoor':
          baseColor = palette.door;
          break;
        default:
          baseColor = ray.side === 'ew' ? palette.wallLight : palette.wall;
      }

      // Apply shading
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);

      const finalR = Math.floor(r * shade * sideShade);
      const finalG = Math.floor(g * shade * sideShade);
      const finalB = Math.floor(b * shade * sideShade);

      ctx.fillStyle = `rgb(${finalR}, ${finalG}, ${finalB})`;
      ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);

      // Add texture lines for walls
      if (ray.tileType === 'wall' && lineHeight > 20) {
        const brickHeight = lineHeight / 4;
        ctx.strokeStyle = `rgba(0,0,0,${0.3 * shade})`;
        ctx.lineWidth = 1;

        for (let i = 0; i < 4; i++) {
          const y = drawStart + i * brickHeight;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 1, y);
          ctx.stroke();
        }
      }

      // Add door details
      if (ray.tileType === 'door' && lineHeight > 30) {
        ctx.strokeStyle = palette.doorFrame;
        ctx.lineWidth = 2;
        const doorY = drawStart + lineHeight * 0.1;
        const doorH = lineHeight * 0.8;

        // Door frame lines
        if (ray.wallX > 0.1 && ray.wallX < 0.9) {
          ctx.beginPath();
          ctx.moveTo(x, doorY);
          ctx.lineTo(x, doorY + doorH);
          ctx.stroke();
        }
      }
    };

    // Draw floor and ceiling
    const drawFloorAndCeiling = (
      ctx: CanvasRenderingContext2D,
      screenWidth: number,
      screenHeight: number
    ) => {
      // Ceiling gradient
      const ceilGradient = ctx.createLinearGradient(0, 0, 0, screenHeight / 2);
      ceilGradient.addColorStop(0, palette.ceiling);
      ceilGradient.addColorStop(1, '#151525');
      ctx.fillStyle = ceilGradient;
      ctx.fillRect(0, 0, screenWidth, screenHeight / 2);

      // Floor gradient
      const floorGradient = ctx.createLinearGradient(0, screenHeight / 2, 0, screenHeight);
      floorGradient.addColorStop(0, '#1a1a2a');
      floorGradient.addColorStop(1, palette.floor);
      ctx.fillStyle = floorGradient;
      ctx.fillRect(0, screenHeight / 2, screenWidth, screenHeight / 2);
    };

    // Draw a sprite/entity
    const drawEntity = (
      ctx: CanvasRenderingContext2D,
      entity: VisibleEntity,
      screenWidth: number,
      screenHeight: number,
      rays: RaycastResult[]
    ) => {
      // Check if entity is behind a wall
      const screenX = entity.screenX * screenWidth;
      const rayIndex = Math.floor(screenX);
      if (rayIndex >= 0 && rayIndex < rays.length) {
        if (rays[rayIndex].distance < entity.distance - 0.1) {
          return; // Entity is behind wall
        }
      }

      const spriteHeight = screenHeight / entity.distance;
      const spriteWidth = spriteHeight * 0.8;
      const drawX = screenX - spriteWidth / 2;
      const drawY = (screenHeight - spriteHeight) / 2;

      // Shade based on distance
      const shade = Math.max(0.3, 1 - entity.distance / 10);

      ctx.save();

      if (entity.type === 'monster') {
        // Draw monster sprite
        const baseColor = entity.isBoss ? palette.boss : palette.monster;
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);

        // Body
        ctx.fillStyle = `rgb(${Math.floor(r * shade)}, ${Math.floor(g * shade)}, ${Math.floor(b * shade)})`;
        ctx.beginPath();
        ctx.ellipse(
          drawX + spriteWidth / 2,
          drawY + spriteHeight * 0.6,
          spriteWidth * 0.4,
          spriteHeight * 0.35,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(
          drawX + spriteWidth / 2,
          drawY + spriteHeight * 0.3,
          spriteWidth * 0.25,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Eyes
        ctx.fillStyle = `rgba(255, 255, 200, ${shade})`;
        ctx.beginPath();
        ctx.arc(drawX + spriteWidth * 0.4, drawY + spriteHeight * 0.28, spriteWidth * 0.06, 0, Math.PI * 2);
        ctx.arc(drawX + spriteWidth * 0.6, drawY + spriteHeight * 0.28, spriteWidth * 0.06, 0, Math.PI * 2);
        ctx.fill();

        // Horns for boss
        if (entity.isBoss) {
          ctx.fillStyle = `rgb(${Math.floor(r * shade * 0.8)}, ${Math.floor(g * shade * 0.8)}, ${Math.floor(b * shade * 0.8)})`;
          ctx.beginPath();
          ctx.moveTo(drawX + spriteWidth * 0.3, drawY + spriteHeight * 0.2);
          ctx.lineTo(drawX + spriteWidth * 0.2, drawY + spriteHeight * 0.05);
          ctx.lineTo(drawX + spriteWidth * 0.35, drawY + spriteHeight * 0.15);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(drawX + spriteWidth * 0.7, drawY + spriteHeight * 0.2);
          ctx.lineTo(drawX + spriteWidth * 0.8, drawY + spriteHeight * 0.05);
          ctx.lineTo(drawX + spriteWidth * 0.65, drawY + spriteHeight * 0.15);
          ctx.fill();
        }
      } else if (entity.type === 'treasure') {
        // Draw treasure chest
        const chestWidth = spriteWidth * 0.6;
        const chestHeight = spriteHeight * 0.4;
        const chestX = drawX + (spriteWidth - chestWidth) / 2;
        const chestY = drawY + spriteHeight * 0.5;

        // Chest body
        ctx.fillStyle = `rgb(${Math.floor(139 * shade)}, ${Math.floor(90 * shade)}, ${Math.floor(43 * shade)})`;
        ctx.fillRect(chestX, chestY, chestWidth, chestHeight);

        // Gold glow
        ctx.fillStyle = `rgba(255, 215, 0, ${0.5 * shade})`;
        ctx.fillRect(chestX + 2, chestY + 2, chestWidth - 4, chestHeight * 0.3);

        // Chest lid line
        ctx.strokeStyle = '#3d2817';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(chestX, chestY + chestHeight * 0.3);
        ctx.lineTo(chestX + chestWidth, chestY + chestHeight * 0.3);
        ctx.stroke();
      } else if (entity.type === 'trap') {
        // Draw trap warning
        const trapSize = Math.min(spriteWidth, spriteHeight) * 0.5;
        const trapX = drawX + spriteWidth / 2;
        const trapY = drawY + spriteHeight * 0.7;

        ctx.fillStyle = `rgba(255, 69, 0, ${shade})`;
        ctx.beginPath();
        ctx.moveTo(trapX, trapY - trapSize * 0.5);
        ctx.lineTo(trapX + trapSize * 0.4, trapY + trapSize * 0.3);
        ctx.lineTo(trapX - trapSize * 0.4, trapY + trapSize * 0.3);
        ctx.closePath();
        ctx.fill();

        // Exclamation mark
        ctx.fillStyle = `rgba(0, 0, 0, ${shade})`;
        ctx.font = `bold ${trapSize * 0.4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', trapX, trapY + trapSize * 0.1);
      } else if (entity.type === 'door') {
        // Doors are rendered as part of walls, skip here
      }

      ctx.restore();
    };

    // Draw particles
    const drawParticles = (ctx: CanvasRenderingContext2D, dt: number) => {
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life += dt;
        if (p.life >= p.ttl) return false;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity

        const alpha = 1 - p.life / p.ttl;
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });
    };

    // Main render loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let frame: number;
      let lastTime = performance.now();

      const render = (time: number) => {
        const dt = time - lastTime;
        lastTime = time;

        const currentTiles = tilesRef.current;
        const currentPlayer = playerRef.current;

        // Smooth angle interpolation for turning
        const anim = animationRef.current;
        const angleDiff = anim.targetAngle - anim.angle;
        let normalizedDiff = angleDiff;
        while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
        while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;
        anim.angle += normalizedDiff * 0.15;

        // View bobbing
        anim.bobPhase += dt * 0.008;
        const bobOffset = Math.sin(anim.bobPhase) * 3;

        ctx.save();

        // Screen shake
        const now = performance.now();
        if (shakeRef.current.until > now) {
          const intensity = shakeRef.current.intensity * ((shakeRef.current.until - now) / 200);
          ctx.translate(
            (Math.random() - 0.5) * intensity,
            (Math.random() - 0.5) * intensity
          );
        }

        // Draw floor and ceiling
        drawFloorAndCeiling(ctx, width, height);

        // Cast rays and draw walls
        const rays = castAllRays(
          currentTiles,
          currentPlayer.x + 0.5,
          currentPlayer.y + 0.5,
          currentPlayer.facing,
          width,
          { fov: FOV, maxDistance: 16 }
        );

        // Apply view bob to wall rendering
        ctx.save();
        ctx.translate(0, bobOffset);

        for (let x = 0; x < rays.length; x++) {
          drawWallStrip(ctx, x, rays[x], height);
        }

        // Draw entities (monsters, treasures, traps)
        const entities = getVisibleEntities(
          currentTiles,
          currentPlayer.x + 0.5,
          currentPlayer.y + 0.5,
          currentPlayer.facing,
          { fov: FOV, maxDistance: 12 }
        );

        for (const entity of entities) {
          drawEntity(ctx, entity, width, height, rays);
        }

        ctx.restore();

        // Draw particles
        drawParticles(ctx, dt);

        // Draw flash effects
        if (flashRef.current.player > 0) {
          ctx.fillStyle = `rgba(255, 50, 50, ${flashRef.current.player * 0.3})`;
          ctx.fillRect(0, 0, width, height);
          flashRef.current.player = Math.max(0, flashRef.current.player - dt / 200);
        }
        if (flashRef.current.monster > 0) {
          ctx.fillStyle = `rgba(50, 255, 50, ${flashRef.current.monster * 0.2})`;
          ctx.fillRect(0, 0, width, height);
          flashRef.current.monster = Math.max(0, flashRef.current.monster - dt / 200);
        }

        // Vignette effect
        const vignette = ctx.createRadialGradient(
          width / 2, height / 2, height * 0.3,
          width / 2, height / 2, height * 0.9
        );
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        // Torch flicker overlay
        const flicker = 0.95 + Math.sin(time * 0.01) * 0.03 + Math.sin(time * 0.023) * 0.02;
        ctx.fillStyle = `rgba(255, 200, 100, ${(1 - flicker) * 0.1})`;
        ctx.fillRect(0, 0, width, height);

        ctx.restore();

        frame = requestAnimationFrame(render);
      };

      frame = requestAnimationFrame(render);
      return () => cancelAnimationFrame(frame);
    }, [width, height]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg border-2 border-slate-700 bg-black"
        style={{ imageRendering: 'pixelated' }}
      />
    );
  }
);

FirstPersonCanvas.displayName = 'FirstPersonCanvas';

export default FirstPersonCanvas;
