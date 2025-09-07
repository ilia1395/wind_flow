import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { createParticleSimulation, type ParticleSimulation } from '../model/particleSimulation';
import {  useVectorFieldStore, 
          selectTrailLength, 
          selectLifespan, 
          selectVyBoost, 
          selectTrailDecay, 
          selectParticleSize, 
          selectTrailDotBaseSize, 
          selectFavorMeasured, 
          selectColorBySpeed, 
          selectInterpolatedColor, 
          selectInterpolatedOpacity, 
          selectNumParticles } from '../model/vectorFieldStore';
import { useShaders } from './Shaders/shaders';
import { computeSliceYs } from '../lib/helpers';
import type { FieldSampler } from '@/entities/FieldSampler';

export const ParticleField: React.FC<{
  bounds: [number, number, number];
  fieldSampler?: FieldSampler;
  currentTime: number;
  isPlaying: boolean;
  heightSlices?: number[];
}> = ({ bounds, fieldSampler, currentTime, isPlaying, heightSlices }) => {

  // point and trail refs
  const pointsRef = useRef<THREE.Points>(null);
  const trailDotsRef = useRef<THREE.Points>(null);

  // config from store
  const numParticles = useVectorFieldStore(selectNumParticles);
  const trailLength = useVectorFieldStore(selectTrailLength);
  const lifeSpan = useVectorFieldStore(selectLifespan);
  const interpolatedVyBoost = useVectorFieldStore(selectVyBoost);
  const trailDecayPerSecond = useVectorFieldStore(selectTrailDecay);
  const particleSize = useVectorFieldStore(selectParticleSize);
  const trailDotBaseSize = useVectorFieldStore(selectTrailDotBaseSize);
  const favorMeasured = useVectorFieldStore(selectFavorMeasured);
  const colorBySpeed = useVectorFieldStore(selectColorBySpeed);
  const interpolatedColor = useVectorFieldStore(selectInterpolatedColor);
  const interpolatedOpacity = useVectorFieldStore(selectInterpolatedOpacity);

  // Shaders configuration
  const { particleVertex, particleFragment, particleUniforms, trailPointVertex, trailPointFragment, trailPointUniforms } = useShaders( particleSize, trailDotBaseSize );

  // precompute slice Y coordinates for respawn bias on each Height
  const sliceYs = useMemo(() => computeSliceYs(heightSlices, bounds[1]), [heightSlices, bounds[1]]);

  // particle simulation instance
  const simRef = useRef<ParticleSimulation | null>(null);
  const sim = useMemo(() => {
    const cfg = {
      bounds: bounds as [number, number, number],
      trailLength,
      lifespan: { min: lifeSpan.lifeMin, max: lifeSpan.lifeMax },
      interpolatedVyBoost,
      trailDecayPerSecond,
      particleSize,
      trailDotBaseSize,
      favorMeasured,
      colorBySpeed,
      interpolatedColor,
      interpolatedOpacity,
    };
    const s = createParticleSimulation(numParticles, cfg);
    simRef.current = s;
    // initial distribution biased using measured heights
    s.reset(numParticles, sliceYs);
    return s;
    // recreate when core config changes
  }, [numParticles, bounds[0], bounds[1], bounds[2], trailLength, lifeSpan.lifeMin, lifeSpan.lifeMax, interpolatedVyBoost, trailDecayPerSecond, particleSize, trailDotBaseSize, favorMeasured, colorBySpeed, interpolatedColor[0], interpolatedColor[1], interpolatedColor[2], interpolatedOpacity, sliceYs?.length]);

  // Update loop
  useFrame((state, delta) => {
    const vh = state.size.height * (state.viewport.dpr || 1);
    const fov = ((state.camera as THREE.PerspectiveCamera)?.fov ?? 45) * Math.PI / 180.0;
    particleUniforms.uViewportHeight.value = vh;
    particleUniforms.uFov.value = fov;
    trailPointUniforms.uViewportHeight.value = vh;
    trailPointUniforms.uFov.value = fov;

    // Update simulation when playing
    if (!isPlaying) return;
    sim.step(fieldSampler as FieldSampler | undefined, currentTime, delta, sliceYs);

    // Update geometry attributes after step/seek
    if (pointsRef.current) {
      const geometry = pointsRef.current.geometry as THREE.BufferGeometry;
      (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aAngle') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aOpacity') as THREE.BufferAttribute).needsUpdate = true;
    }
    if (trailDotsRef.current) {
      const geometry = trailDotsRef.current.geometry as THREE.BufferGeometry;
      (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
      const aOpacityAttr = geometry.getAttribute('aOpacity') as THREE.BufferAttribute | undefined;
      if (aOpacityAttr) aOpacityAttr.needsUpdate = true;
    }

  });

  return (
    <>
      {/* Trails */}
      <points ref={trailDotsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sim.trailPositions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color"    args={[sim.trailColors,    3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize"    args={[sim.trailDotSizes,  1]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aOpacity" args={[sim.trailOpacities, 1]} usage={THREE.DynamicDrawUsage} />
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
          <bufferAttribute attach="attributes-position" args={[sim.positions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color"    args={[sim.colors,    3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize"    args={[sim.sizes,     1]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aOpacity" args={[sim.opacities, 1]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aAngle"   args={[sim.angles,    1]} usage={THREE.DynamicDrawUsage} />
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