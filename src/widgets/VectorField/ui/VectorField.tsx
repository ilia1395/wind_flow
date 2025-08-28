
// VectorField.tsx
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { DirectionLabels } from '@features/DirectionLabels';
import { HeightLabels } from '@features/HeightLabels';
import { StatusBillboard } from '@features/StatusBillboard';


import type { FieldSampler } from '@entities/FieldSampler';
// import { buildSpatialGrid } from '@entities/FieldSampler';
import type { WindVector } from '../types/types';
import { usePlaybackStore } from '@features/Playback/model/playbackStore';
import { useVectorFieldModel } from '../model/vectorFieldModel';
import { useVectorFieldAppearance } from '../lib/VectorFieldAppearance';

type Props = {
  vectors?: WindVector[];
  numParticles?: number;
  // fieldSampler, heightSlices and statusText are provided by the internal model hook
  interpolatedVerticalBoost?: number; // multiply vy for interpolated samples
  lifespanRangeSeconds?: [number, number];
};

const ParticleField: React.FC<{
  vectors?: WindVector[];
  numParticles: number;
  bounds: [number, number, number];
  fieldSampler?: FieldSampler;
  currentTime: number;
  isPlaying: boolean;
  heightSlices?: number[];
  lifespanRangeSeconds?: [number, number];
  interpolatedVerticalBoost?: number;
}> = ({ vectors, numParticles, bounds, fieldSampler, currentTime, isPlaying, heightSlices, lifespanRangeSeconds, interpolatedVerticalBoost }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const trailDotsRef = useRef<THREE.Points>(null);

  const appearance = useVectorFieldAppearance({
    vectors,
    numParticles,
    bounds,
    heightSlices,
    lifespanRangeSeconds,
    interpolatedVerticalBoost,
    pointsRef,
    trailDotsRef,
  });

  // keep for potential layout offsets if needed later
  // const halfY = bounds[1];

  const {
    positions,
    colors,
    // velocities,
    angles,
    sizes,
    opacities,
    trailPositions,
    trailColors,
    trailOpacities,
    trailDotSizes,
    particleVertex,
    particleFragment,
    particleUniforms,
    trailPointVertex,
    trailPointFragment,
    trailPointUniforms,
    updateFrame,
  } = appearance;

  useFrame((state, delta) => {
    const vh = state.size.height * (state.viewport.dpr || 1);
    const fov = ((state.camera as THREE.PerspectiveCamera)?.fov ?? 45) * Math.PI / 180.0;
    updateFrame({
      fieldSampler: fieldSampler as FieldSampler | undefined,
      currentTime,
      isPlaying,
      delta,
      viewportHeightPx: vh,
      fovRadians: fov,
    });
  });

  return (
    <>
      {/* Trails */}
      <points ref={trailDotsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color"    args={[trailColors,    3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize"    args={[trailDotSizes,  1]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aOpacity" args={[trailOpacities, 1]} usage={THREE.DynamicDrawUsage} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          vertexShader={trailPointVertex}
          fragmentShader={trailPointFragment}
          uniforms={trailPointUniforms}
        />
      </points>

      {/* Particles */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color"    args={[colors,    3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize"    args={[sizes,     1]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aAngle"   args={[angles,    1]} usage={THREE.DynamicDrawUsage} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          depthTest={false}
          vertexShader={particleVertex}
          fragmentShader={particleFragment}
          uniforms={particleUniforms}
      />
    </points>
    </>
  );
};

export const VectorField: React.FC<Props> = ({
  vectors,
  numParticles = 2000,
  // provided via model hook
  interpolatedVerticalBoost,
  lifespanRangeSeconds,
}) => {
  const { fieldSampler, heightSlices, statusText } = useVectorFieldModel();
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
  const particleCount = useMemo(() => {
    if (numParticles && numParticles > 0) return numParticles;
    const base = (vectors?.length ?? 0) > 0 ? (vectors!.length * 10) : 1500;
    return Math.min(6000, Math.max(1000, base));
  }, [numParticles, vectors?.length]);

  const boxSize: [number, number, number] = [bounds[0] * 2, bounds[1] * 2, bounds[2] * 2];
  const floorY = -bounds[1] + 0.02;
  const labelMargin = 6;
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

      {/* 2D overlay status text */}
      <StatusBillboard text={statusText} y={bounds[1] + 40} />

      {/* Direction labels */}
      <DirectionLabels bounds={bounds} floorY={floorY} labelMargin={labelMargin} />

      <ParticleField
        vectors={vectors}
        numParticles={particleCount}
        bounds={bounds}
        fieldSampler={fieldSampler}
        currentTime={currentTime}
        isPlaying={isPlaying}
        heightSlices={heightSlices}
        interpolatedVerticalBoost={interpolatedVerticalBoost}
        lifespanRangeSeconds={lifespanRangeSeconds}
      />
    </>
  );
};
