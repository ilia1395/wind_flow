
// VectorField.tsx
import React, { useMemo } from 'react';
import * as THREE from 'three';

import { DirectionLabels } from '@/widgets/VectorField/ui/DirectionLabels';
import { HeightLabels } from '@/widgets/VectorField/ui/HeightLabels';

import { usePlaybackStore } from '@/widgets/PlaybackControls/model/playbackStore';
import { configureFieldSampler } from '../model/fieldSamplerConfig';
import { ParticleField } from './ParticleField';

export const VectorField: React.FC = () => {
  const { fieldSampler, heightSlices } = configureFieldSampler();
  const currentTime = usePlaybackStore((s) => s.timeSeconds);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  // Derive world bounds from lidar heights: set Y span to data span (meters), X/Z proportional
  const derivedBounds: [number, number, number] = useMemo(() => {
    if (heightSlices && heightSlices.length > 0) {
      const minH = Math.min(...heightSlices);
      const maxH = Math.max(...heightSlices);
      const span = Math.max(1, maxH - minH);
      const halfY = span * 0.5; // 1 unit = 1 meter
      const halfXZ = halfY; // proportional aspect (square footprint)
      return [halfXZ, halfY, halfXZ];
    }
    return [5, 5, 5];
  }, [heightSlices]);

  const bounds = derivedBounds;

  const boxSize: [number, number, number] = [bounds[0] * 2, bounds[1] * 2, bounds[2] * 2];
  const floorY = -bounds[1] + 0.02;
  const labelMargin = 12;
  const edgeLabelMargin = 2;

  return (
    <>
      {/* bounds */}
      <mesh>
        <boxGeometry args={boxSize} />
        <meshBasicMaterial color="gray" wireframe transparent opacity={0.12} />
      </mesh>

      {/* Height slices lines */}
      {heightSlices && heightSlices.length > 0 && (
        <group>
          {heightSlices.map((h) => {
            const minH = Math.min(...heightSlices);
            const maxH = Math.max(...heightSlices);
            const t = (h - minH) / Math.max(1e-6, maxH - minH);
            const y = THREE.MathUtils.lerp(-bounds[1], bounds[1], t);
            return (
              <group key={`slice-${h}`}>
                <lineSegments position={[0, y, 0]}>
                  <edgesGeometry args={[new THREE.BoxGeometry(boxSize[0], 0.01, boxSize[2])]} />
                  <lineBasicMaterial color={new THREE.Color('white')} linewidth={1} />
                </lineSegments>
              </group>
            );
          })}
        </group>
      )}

      {/* Camera-facing height labels at closest vertical edge */}
      {heightSlices && heightSlices.length > 0 && (
        <HeightLabels heightSlices={heightSlices} bounds={bounds} edgeLabelMargin={edgeLabelMargin} />
      )}

      {/* Direction labels */}
      <DirectionLabels bounds={bounds} floorY={floorY} labelMargin={labelMargin} />

      <ParticleField
        bounds={bounds}
        fieldSampler={fieldSampler}
        currentTime={currentTime}
        isPlaying={isPlaying}
        heightSlices={heightSlices}
      />
    </>
  );
};
