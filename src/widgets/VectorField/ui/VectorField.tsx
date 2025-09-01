
// VectorField.tsx
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { DirectionLabels } from '@/features/DirectionLabels';
import { HeightLabels } from '@/features/HeightLabels';
import { StatusBillboard } from '@/features/StatusBillboard';


import type { FieldSampler } from '@/entities/FieldSampler';
import type { WindVector } from '../types/types';
import { usePlaybackStore } from '@/features/Playback/model/playbackStore';
import { useVectorFieldModel } from '../model/vectorFieldModel';
import { computeSliceYs } from '../lib/VectorFieldAppearance';
import { createParticleSimulation, type ParticleSimulation } from '../model/particleSimulation';
import { useVectorFieldStore, selectTrailLength, selectLifespan, selectVyBoost, selectTrailDecay, selectParticleSize, selectTrailDotBaseSize, selectFavorMeasured, selectColorBySpeed, selectInterpolatedColor, selectInterpolatedOpacity, selectNumParticles } from '../model/vectorFieldStore';

type Props = {
  vectors?: WindVector[];
};

const ParticleField: React.FC<{
  bounds: [number, number, number];
  fieldSampler?: FieldSampler;
  currentTime: number;
  isPlaying: boolean;
  heightSlices?: number[];
}> = ({ bounds, fieldSampler, currentTime, isPlaying, heightSlices }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const trailDotsRef = useRef<THREE.Points>(null);

  // config from store (single source of truth)
  const numParticles = useVectorFieldStore(selectNumParticles);
  const trailLength = useVectorFieldStore(selectTrailLength);
  const [lifeMin, lifeMax] = useVectorFieldStore(selectLifespan);
  const interpolatedVyBoost = useVectorFieldStore(selectVyBoost);
  const trailDecayPerSecond = useVectorFieldStore(selectTrailDecay);
  const particleSize = useVectorFieldStore(selectParticleSize);
  const trailDotBaseSize = useVectorFieldStore(selectTrailDotBaseSize);
  const favorMeasured = useVectorFieldStore(selectFavorMeasured);
  const colorBySpeed = useVectorFieldStore(selectColorBySpeed);
  const interpolatedColor = useVectorFieldStore(selectInterpolatedColor);
  const interpolatedOpacity = useVectorFieldStore(selectInterpolatedOpacity);

  // precompute slice Y coordinates for respawn bias
  const sliceYs = useMemo(() => computeSliceYs(heightSlices, bounds[1]), [heightSlices, bounds[1]]);

  // particle simulation instance
  const simRef = useRef<ParticleSimulation | null>(null);
  const sim = useMemo(() => {
    const cfg = {
      bounds: bounds as [number, number, number],
      trailLength,
      lifespan: { min: lifeMin, max: lifeMax },
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
  }, [numParticles, bounds[0], bounds[1], bounds[2], trailLength, lifeMin, lifeMax, interpolatedVyBoost, trailDecayPerSecond, particleSize, trailDotBaseSize, favorMeasured, colorBySpeed, interpolatedColor[0], interpolatedColor[1], interpolatedColor[2], interpolatedOpacity, sliceYs?.length]);

  // Minimal custom shaders and uniforms (kept local to component)
  const particleVertex = `
    attribute float aSize;
    attribute float aOpacity;
    attribute float aAngle;
    attribute vec3 color;
    varying vec3 vColor;
    varying float vAngle;
    varying float vOpacity;
    uniform float uSize;
    uniform float uViewportHeight;
    uniform float uFov;
    void main() {
      vColor = color;
      vAngle = aAngle;
      vOpacity = aOpacity;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float projScale = uViewportHeight / (2.0 * tan(uFov * 0.5));
      float scaleFactor = length(modelMatrix[0].xyz);
      float sizePx = max(1.0, aSize * uSize * projScale / max(scaleFactor, -mvPosition.z));
      gl_PointSize = sizePx;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  const particleFragment = `
    varying vec3 vColor;
    varying float vAngle;
    varying float vOpacity;
    uniform float uOpacity;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      float s = sin(-vAngle);
      float c = cos(-vAngle);
      vec2 pr = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      float h = 0.2;
      if (pr.y < -h || pr.y > h) discard;
      float halfWidth = (h - pr.y);
      if (abs(pr.x) > halfWidth) discard;
      gl_FragColor = vec4(vColor, uOpacity * vOpacity);
    }
  `;
  const particleUniforms = useMemo(() => ({
    uSize: { value: particleSize },
    uViewportHeight: { value: 400.0 },
    uFov: { value: 45 * Math.PI / 180 },
    uOpacity: { value: 1.0 },
  }), [particleSize]);

  const trailPointVertex = `
    attribute float aSize;
    attribute float aOpacity;
    attribute vec3 color;
    varying vec3 vColor;
    varying float vOpacity;
    uniform float uSize;
    uniform float uViewportHeight;
    uniform float uFov;
    void main() {
      vColor = color;
      vOpacity = aOpacity;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float projScale = uViewportHeight / (2.0 * tan(uFov * 0.5));
      float scaleFactor = length(modelMatrix[0].xyz);
      float sizePx = max(1.0, aSize * uSize * projScale / max(scaleFactor, -mvPosition.z));
      gl_PointSize = sizePx;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  const trailPointFragment = `
    varying vec3 vColor;
    varying float vOpacity;
    uniform float uOpacity;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float r = dot(c, c);
      if (r > 0.25) discard;
      gl_FragColor = vec4(vColor, uOpacity * vOpacity);
    }
  `;
  const trailPointUniforms = useMemo(() => ({
    uSize: { value: trailDotBaseSize },
    uViewportHeight: { value: 400.0 },
    uFov: { value: 45 * Math.PI / 180 },
    uOpacity: { value: 1.0 },
  }), [trailDotBaseSize]);

  

  useFrame((state, delta) => {
    const vh = state.size.height * (state.viewport.dpr || 1);
    const fov = ((state.camera as THREE.PerspectiveCamera)?.fov ?? 45) * Math.PI / 180.0;
    particleUniforms.uViewportHeight.value = vh;
    particleUniforms.uFov.value = fov;
    trailPointUniforms.uViewportHeight.value = vh;
    trailPointUniforms.uFov.value = fov;

    if (!isPlaying) return;
    sim.step(fieldSampler as FieldSampler | undefined, currentTime, delta, sliceYs);

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

export const VectorField: React.FC<Props> = () => {
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
        bounds={bounds}
        fieldSampler={fieldSampler}
        currentTime={currentTime}
        isPlaying={isPlaying}
        heightSlices={heightSlices}
      />
    </>
  );
};
