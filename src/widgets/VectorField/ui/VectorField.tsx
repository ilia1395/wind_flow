
// VectorField.tsx
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { DirectionLabels } from '@features/DirectionLabels';
import { HeightLabels } from '@features/HeightLabels';
import { StatusBillboard } from '@features/StatusBillboard';


import type { FieldSampler } from '@entities/FieldSampler';
// import { buildSpatialGrid } from '@entities/FieldSampler';
import type { WindVector, PreparedVector } from '../model/types';

type Props = {
  vectors?: WindVector[];
  numParticles?: number;
  fieldSampler?: FieldSampler; // optional procedural sampler
  currentTime?: number; // seconds
  isPlaying?: boolean; // control simulation integration
  heightSlices?: number[]; // meters
  statusText?: string; // overlay text
};

const ParticleField: React.FC<{
  vectors?: WindVector[];
  numParticles: number;
  bounds: [number, number, number];
  fieldSampler?: FieldSampler;
  currentTime: number;
  isPlaying: boolean;
}> = ({ vectors, numParticles, bounds, fieldSampler, currentTime, isPlaying }) => {
  const { positions, colors, velocities } = useMemo(() => {
    // Precompute components from input vectors if provided
    const preparedVectors: PreparedVector[] = (vectors ?? []).map((v) => {
      const angle = v.direction; // radians around Y axis
      const vx = Math.cos(angle) * v.speed;
      const vz = Math.sin(angle) * v.speed;
      const vy = 0;
      return { px: v.position[0], py: v.position[1], pz: v.position[2], vx, vy, vz, speed: v.speed };
    });

    const gridCellSize = 1.5; // reserved for potential spatial grid usage
    // Spatial grid available if needed for neighbor queries
    // const spatialGrid = preparedVectors.length ? buildSpatialGrid(preparedVectors, gridCellSize) : new Map<string, number[]>();

    const pos = new Float32Array(numParticles * 3);
    const col = new Float32Array(numParticles * 3);
    const vel = new Float32Array(numParticles * 3);

    for (let i = 0; i < numParticles; i += 1) {
      const x = THREE.MathUtils.randFloatSpread(bounds[0] * 2);
      const y = THREE.MathUtils.randFloatSpread(bounds[1] * 2);
      const z = THREE.MathUtils.randFloatSpread(bounds[2] * 2);
      pos[i * 3 + 0] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      // start color near white
      col[i * 3 + 0] = 1;
      col[i * 3 + 1] = 1;
      col[i * 3 + 2] = 1;
      if (preparedVectors[i]) {
        vel[i * 3 + 0] = preparedVectors[i].vx;
        vel[i * 3 + 1] = preparedVectors[i].vy;
        vel[i * 3 + 2] = preparedVectors[i].vz;
      } else {
        vel[i * 3 + 0] = 0;
        vel[i * 3 + 1] = 0;
        vel[i * 3 + 2] = 0;
      }
    }

    return { positions: pos, colors: col, velocities: vel };
  }, [vectors, numParticles, bounds]);

  const halfX = bounds[0];
  const halfY = bounds[1];
  const halfZ = bounds[2];

  // Trails and speed-change tracking
  const pointsRef = useRef<THREE.Points>(null);
  const trailDotsRef = useRef<THREE.Points>(null);
  const trailHeadRef   = useRef(0);

  const TRAIL_LENGTH = 128;
  const trailPositions = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH * 3), [numParticles]);
  const trailColors    = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH * 3), [numParticles]);
  const prevSpeed      = useMemo(() => new Float32Array(numParticles), [numParticles]);
  const curSpeed       = useMemo(() => new Float32Array(numParticles), [numParticles]);
  const deltaSpeed     = useMemo(() => new Float32Array(numParticles), [numParticles]);
  const sizes          = useMemo(() => new Float32Array(numParticles).fill(1), [numParticles]);
  const trailDotSizes  = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH).fill(0), [numParticles]);

  // Minimal custom shader to support per-particle size and oriented triangle sprites
  const particleVertex = `
    attribute float aSize;
    attribute float aAngle;
    attribute vec3 color;
    varying vec3 vColor;
    varying float vAngle;
    uniform float uSize;             // global px scale
    uniform float uViewportHeight;   // pixels
    uniform float uFov;              // radians
    void main() {
      vColor = color;
      vAngle = aAngle;
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
    uniform float uOpacity;
    void main() {
      // oriented isosceles triangle sprite
      vec2 p = gl_PointCoord - vec2(0.5);
      float s = sin(-vAngle);
      float c = cos(-vAngle);
      vec2 pr = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      // Triangle pointing up: base at y=-h, apex at y=+h
      float h = 0.2; // inset to avoid clipping in the point quad
      if (pr.y < -h || pr.y > h) discard;
      float halfWidth = (h - pr.y); // width shrinks toward apex (y=+h)
      if (abs(pr.x) > halfWidth) discard;
      gl_FragColor = vec4(vColor, uOpacity);
    }
  `;
  const particleUniforms = useMemo(() => ({
    uSize: { value: 1.2 },
    uViewportHeight: { value: 400.0 },
    uFov: { value: 45 * Math.PI / 180 },
    uOpacity: { value: 1.0 },
  }), []);

  const trailPointVertex = `
    attribute float aSize;
    attribute vec3 color;
    varying vec3 vColor;
    uniform float uSize;
    uniform float uViewportHeight;
    uniform float uFov;
    void main() {
      vColor = color;
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
    uniform float uOpacity;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float r = dot(c, c);
      if (r > 0.25) discard;
      gl_FragColor = vec4(vColor, uOpacity);
    }
  `;
  const trailPointUniforms = useMemo(() => ({
    uSize: { value: 0.5 },
    uViewportHeight: { value: 400.0 },
    uFov: { value: 45 * Math.PI / 180 },
    uOpacity: { value: 1.0 },
  }), []);

  // Per-particle orientation angle in XZ-plane
  const angles = useMemo(() => new Float32Array(numParticles), [numParticles]);

  useFrame((state, delta) => {
    const vh = state.size.height * (state.viewport.dpr || 1);
    const fov = ((state.camera as THREE.PerspectiveCamera)?.fov ?? 45) * Math.PI / 180.0;
    
    particleUniforms.uViewportHeight.value = vh;
    particleUniforms.uFov.value = fov;

    trailPointUniforms.uViewportHeight.value = vh;
    trailPointUniforms.uFov.value = fov;

    if (!isPlaying) {
      velocities.fill(0);
      return;
    }
    const pos = positions;
    const col = colors;
    const vel = velocities;

    for (let i = 0; i < pos.length; i += 3) {
      let x = pos[i + 0];
      let y = pos[i + 1];
      let z = pos[i + 2];

      const s = fieldSampler ? fieldSampler(x, y, z, currentTime) : { vx: 0, vy: 0, vz: 0, speed: 0 };

      const particleIndex = i / 3;
      curSpeed[particleIndex] = s.speed;
      const ds = s.speed - prevSpeed[particleIndex];
      deltaSpeed[particleIndex] = ds;
      prevSpeed[particleIndex] = s.speed;

      const tau = 0.8;
      const k   = 1 / tau; 
      vel[i+0] += (s.vx - vel[i+0]) * k * delta;
      vel[i+1] += (s.vy - vel[i+1]) * k * delta;
      vel[i+2] += (s.vz - vel[i+2]) * k * delta;

      // integrate positions
      x += vel[i + 0] * delta;
      y += vel[i + 1] * delta;
      z += vel[i + 2] * delta;

      // bounds + respawn
      const out = x < -halfX || x > halfX || y < -halfY || y > halfY || z < -halfZ || z > halfZ;
      if (out) {
        x = THREE.MathUtils.randFloatSpread(halfX * 2);
        y = THREE.MathUtils.randFloatSpread(halfY * 2);
        z = THREE.MathUtils.randFloatSpread(halfZ * 2);
        vel[i + 0] = 0;
        vel[i + 1] = 0;
        vel[i + 2] = 0;
      }

      pos[i + 0] = x;
      pos[i + 1] = y;
      pos[i + 2] = z;

      // base color from speed
      const tSpeed = Math.max(0, Math.min(1, s.speed / 20));
      const r = 0.4 + 0.6 * tSpeed;
      const g = 0.9 - 0.7 * tSpeed;
      const b = 1 - 0.8 * tSpeed;
      col[i + 0] = r;
      col[i + 1] = g;
      col[i + 2] = b;

      // orientation angle from velocity in XZ plane
      const ax = vel[i + 0];
      const az = vel[i + 2];
      const angle = (Math.abs(ax) + Math.abs(az)) > 1e-6 ? Math.atan2(az, ax) : 0.0;
      angles[particleIndex] = angle;
    }

    // Update trails: global decay then write current snapshot at head
    const decayPerSecond = 1.0;
    const decay = Math.pow(decayPerSecond, delta * 1);

    for (let c = 0; c < trailColors.length; c += 1) {
      trailColors[c] *= decay;
    }

    const head = trailHeadRef.current;
    const headBaseFloat = head * numParticles * 3;

    for (let i = 0; i < numParticles; i += 1) {
      const pi = i * 3;
      const hi = headBaseFloat + pi;

      trailPositions[hi + 0] = pos[pi + 0];
      trailPositions[hi + 1] = pos[pi + 1];
      trailPositions[hi + 2] = pos[pi + 2];

      const sNow = curSpeed[i];
      const intensity = 0.5 * Math.max(0.1, Math.min(1, sNow / 20)) + 0.5 * Math.max(0.1, Math.min(1, sNow / 20));
      trailColors[hi + 0] = intensity;
      trailColors[hi + 1] = 0.6 * (1 - intensity * 0.5);
      trailColors[hi + 2] = 0.8 * (1 - intensity);

      const vertexIndex = head * numParticles + i;
      const baseSize = 0.075;         
      const boost    = 0.8 * intensity;
      trailDotSizes[vertexIndex] = baseSize + boost;
    }
    trailHeadRef.current = (head + 1) % TRAIL_LENGTH;

    if (pointsRef.current) {
      const geometry = pointsRef.current.geometry as THREE.BufferGeometry;
      (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('color')    as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aSize')    as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aAngle')   as THREE.BufferAttribute).needsUpdate = true;
    }

    if (trailDotsRef.current) {
      const geometry = trailDotsRef.current.geometry as THREE.BufferGeometry;
      (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('color')    as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aSize')    as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <>
      {/* Trails */}
      <points ref={trailDotsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color"    args={[trailColors,    3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize"    args={[trailDotSizes,  1]} usage={THREE.DynamicDrawUsage} />
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
  fieldSampler,
  currentTime = 0,
  isPlaying = true,
  heightSlices,
  statusText,
}) => {
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
      <StatusBillboard text={statusText} y={bounds[1] + 8} />

      {/* Direction labels */}
      <DirectionLabels bounds={bounds} floorY={floorY} labelMargin={labelMargin} />

      <ParticleField
        vectors={vectors}
        numParticles={particleCount}
        bounds={bounds}
        fieldSampler={fieldSampler}
        currentTime={currentTime}
        isPlaying={isPlaying}
      />
    </>
  );
};
