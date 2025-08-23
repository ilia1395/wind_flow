import React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { TextPlane } from '@shared/ui/TextPlane';

type Props = {
  heightSlices: number[];
  bounds: [number, number, number];
  edgeLabelMargin?: number;
};

export const HeightLabels: React.FC<Props> = ({ heightSlices, bounds, edgeLabelMargin = 0.6 }) => {
  const { camera } = useThree();
  const minH = Math.min(...heightSlices);
  const maxH = Math.max(...heightSlices);

  const candidates: Array<[number, number]> = [
    [bounds[0], bounds[2]],
    [bounds[0], -bounds[2]],
    [-bounds[0], bounds[2]],
    [-bounds[0], -bounds[2]],
  ];
  let best: [number, number] = candidates[0];
  let bestD2 = Infinity;
  for (const [ex, ez] of candidates) {
    const dx = camera.position.x - ex;
    const dz = camera.position.z - ez;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = [ex, ez];
    }
  }
  const [edgeX, edgeZ] = best;
  const offX = edgeLabelMargin * Math.sign(edgeX || 1);
  const offZ = edgeLabelMargin * Math.sign(edgeZ || 1);

  return (
    <group>
      {heightSlices.map((h) => {
        const t = (h - minH) / Math.max(1e-6, maxH - minH);
        const y = THREE.MathUtils.lerp(-bounds[1], bounds[1], t);
        return (
          <TextPlane
            key={`hlabel-${h}`}
            text={`${h} m`}
            position={[edgeX + offX, y, edgeZ + offZ]}
            billboard
            size={[1.2, 0.5]}
          />
        );
      })}
    </group>
  );
};


