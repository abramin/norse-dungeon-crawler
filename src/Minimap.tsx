import React, { useEffect, useRef } from 'react';
import { Tile, PlayerState, FacingDirection } from './types';

interface MinimapProps {
  tiles: Tile[][];
  player: PlayerState;
  size?: number;
}

const palette: Record<string, string> = {
  wall: '#1a1a2e',
  room: '#3a4a6a',
  corridor: '#2a3a5a',
  door: '#c0a16d',
  secretDoor: '#7dd3fc',
  trap: '#f97316',
  treasure: '#facc15',
  start: '#22c55e',
  boss: '#ef4444',
  player: '#4ade80',
  unexplored: '#0a0a14',
  monster: '#ff6b35',
};

function getDisplayType(tile: Tile): string {
  if (tile.type === 'trap' && !tile.revealed && !tile.triggered) {
    return tile.regionType === 'room' ? 'room' : 'corridor';
  }
  if (tile.type === 'secretDoor' && !tile.revealed) {
    return 'wall';
  }
  return tile.type;
}

const Minimap: React.FC<MinimapProps> = ({ tiles, player, size = 140 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = tiles.length;
    const tileSize = size / gridSize;

    ctx.clearRect(0, 0, size, size);

    // Draw tiles
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = tiles[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        if (!tile.explored) {
          ctx.fillStyle = palette.unexplored;
          ctx.fillRect(px, py, tileSize, tileSize);
          continue;
        }

        const displayType = getDisplayType(tile);
        let color = palette[displayType] ?? palette.wall;

        // Darken if not visible
        if (!tile.visible) {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          color = `rgb(${Math.floor(r * 0.5)}, ${Math.floor(g * 0.5)}, ${Math.floor(b * 0.5)})`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(px, py, tileSize, tileSize);

        // Draw monster indicator
        if (tile.monsterId && tile.visible) {
          ctx.fillStyle = tile.type === 'boss' ? palette.boss : palette.monster;
          ctx.beginPath();
          ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw treasure indicator
        if (tile.type === 'treasure' && tile.visible) {
          ctx.fillStyle = palette.treasure;
          ctx.fillRect(px + tileSize * 0.25, py + tileSize * 0.25, tileSize * 0.5, tileSize * 0.5);
        }

        // Draw revealed trap
        if (tile.type === 'trap' && tile.revealed && !tile.triggered) {
          ctx.fillStyle = palette.trap;
          ctx.beginPath();
          ctx.moveTo(px + tileSize / 2, py + tileSize * 0.2);
          ctx.lineTo(px + tileSize * 0.8, py + tileSize * 0.8);
          ctx.lineTo(px + tileSize * 0.2, py + tileSize * 0.8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Draw player with direction indicator
    const playerPx = player.x * tileSize + tileSize / 2;
    const playerPy = player.y * tileSize + tileSize / 2;

    // Player dot
    ctx.fillStyle = palette.player;
    ctx.beginPath();
    ctx.arc(playerPx, playerPy, tileSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Direction arrow
    const arrowLength = tileSize * 0.6;
    let arrowAngle: number;
    switch (player.facing) {
      case 'north': arrowAngle = -Math.PI / 2; break;
      case 'south': arrowAngle = Math.PI / 2; break;
      case 'east': arrowAngle = 0; break;
      case 'west': arrowAngle = Math.PI; break;
    }

    const arrowTipX = playerPx + Math.cos(arrowAngle) * arrowLength;
    const arrowTipY = playerPy + Math.sin(arrowAngle) * arrowLength;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playerPx, playerPy);
    ctx.lineTo(arrowTipX, arrowTipY);
    ctx.stroke();

    // Arrow head
    const headAngle = Math.PI / 6;
    const headLength = tileSize * 0.3;
    ctx.beginPath();
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - Math.cos(arrowAngle - headAngle) * headLength,
      arrowTipY - Math.sin(arrowAngle - headAngle) * headLength
    );
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - Math.cos(arrowAngle + headAngle) * headLength,
      arrowTipY - Math.sin(arrowAngle + headAngle) * headLength
    );
    ctx.stroke();

    // Border
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  }, [tiles, player, size]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg bg-slate-900"
      />
      <div className="absolute top-1 left-1 text-xs text-slate-400 font-bold bg-slate-900/80 px-1 rounded">
        MAP
      </div>
    </div>
  );
};

export default Minimap;
