import React from 'react';

type VectorFieldControlsProps = {
  // VectorFieldRenderer settings only
  speedMultiplier: number;
  onSpeedMultiplierChange: (value: number) => void;
  numParticles: number;
  onNumParticlesChange: (value: number) => void;
  damping: number; // 0..1
  onDampingChange: (value: number) => void;
  turbulenceStrength: number; // 0..1
  onTurbulenceStrengthChange: (value: number) => void;
};

export const VectorFieldControls: React.FC<VectorFieldControlsProps> = ({
  speedMultiplier,
  onSpeedMultiplierChange,
  numParticles,
  onNumParticlesChange,
  damping,
  onDampingChange,
  turbulenceStrength,
  onTurbulenceStrengthChange,
}) => {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.35)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        color: 'white',
        gap: '8px',
        pointerEvents: 'auto',
        padding: '8px',
      }}
    >
      {/* Vector field settings */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Speed
        <input
          type="number"
          min={0}
          step={0.1}
          value={speedMultiplier}
          onChange={(e) => onSpeedMultiplierChange(Number(e.target.value))}
          style={{ width: 70 }}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Particles
        <input
          type="number"
          min={100}
          step={100}
          value={numParticles}
          onChange={(e) => onNumParticlesChange(Math.max(0, Number(e.target.value)))}
          style={{ width: 90 }}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Damping
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={damping}
          onChange={(e) => onDampingChange(Number(e.target.value))}
        />
        <span style={{ width: 40, textAlign: 'right' }}>{damping.toFixed(2)}</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Turbulence
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={turbulenceStrength}
          onChange={(e) => onTurbulenceStrengthChange(Number(e.target.value))}
        />
        <span style={{ width: 40, textAlign: 'right' }}>{turbulenceStrength.toFixed(2)}</span>
      </label>
    </div>
  );
};


