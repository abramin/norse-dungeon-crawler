import React from 'react';
import { FacingDirection } from './types';

interface CompassHUDProps {
  facing: FacingDirection;
  size?: number;
}

const CompassHUD: React.FC<CompassHUDProps> = ({ facing, size = 80 }) => {
  const directions: { dir: FacingDirection; label: string; angle: number }[] = [
    { dir: 'north', label: 'N', angle: 0 },
    { dir: 'east', label: 'E', angle: 90 },
    { dir: 'south', label: 'S', angle: 180 },
    { dir: 'west', label: 'W', angle: 270 },
  ];

  // Calculate rotation to put the facing direction at top
  const facingAngles: Record<FacingDirection, number> = {
    north: 0,
    east: -90,
    south: -180,
    west: -270,
  };
  const rotation = facingAngles[facing];

  return (
    <div
      className="relative rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Inner decorative ring */}
      <div
        className="absolute rounded-full border border-slate-600"
        style={{ width: size * 0.85, height: size * 0.85 }}
      />

      {/* Rotating compass rose */}
      <div
        className="absolute inset-0 transition-transform duration-200"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {directions.map(({ dir, label, angle }) => {
          const isActive = dir === facing;
          const radians = (angle - 90) * (Math.PI / 180);
          const radius = size * 0.35;
          const x = Math.cos(radians) * radius + size / 2;
          const y = Math.sin(radians) * radius + size / 2;

          return (
            <div
              key={dir}
              className={`absolute font-bold text-sm transition-all duration-200 ${
                isActive ? 'text-yellow-400 scale-125' : 'text-slate-400'
              }`}
              style={{
                left: x,
                top: y,
                transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
              }}
            >
              {label}
            </div>
          );
        })}

        {/* Direction pointer (arrow pointing up) */}
        <div
          className="absolute"
          style={{
            left: '50%',
            top: size * 0.15,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-yellow-400"
            style={{ transform: `rotate(${-rotation}deg)` }}
          />
        </div>
      </div>

      {/* Center dot */}
      <div className="absolute w-2 h-2 rounded-full bg-slate-500" />

      {/* Fixed "You are facing" indicator at top */}
      <div
        className="absolute w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-yellow-500"
        style={{
          top: 2,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  );
};

export default CompassHUD;
