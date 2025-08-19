
// VectorField.tsx
import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PointMaterial, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { FieldSampler } from '@shared/lib/types';

export type WindVector = {
  id: string;
  position: [number, number, number];
  speed: number;
  direction: number; // assumed radians around Y (XZ plane)
  timestamp: number;
};

type Props = {
  vectors?: WindVector[];
  speedMultiplier?: number;
  numParticles?: number;
  bounds?: [number, number, number]; // half-extents (x,y,z)
  fieldSampler?: FieldSampler; // optional procedural sampler
  currentTime?: number; // seconds
  damping?: number; // 0..1 per second
  turbulenceStrength?: number; // 0..1 additional jitter
  isPlaying?: boolean; // control simulation integration
  heightSlices?: number[]; // meters
  statusText?: string; // overlay text
};

type PreparedVector = {
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
};

function buildSpatialGrid(vectors: PreparedVector[], cellSize: number) {
  const grid = new Map<string, number[]>();
  for (let i = 0; i < vectors.length; i += 1) {
    const v = vectors[i];
    const cx = Math.floor(v.px / cellSize);
    const cy = Math.floor(v.py / cellSize);
    const cz = Math.floor(v.pz / cellSize);
    const key = `${cx}|${cy}|${cz}`;
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }
  return grid;
}

function sampleField(
  x: number,
  y: number,
  z: number,
  grid: Map<string, number[]>,
  data: PreparedVector[],
  cellSize: number,
  radius: number,
  maxNeighbors: number,
): { vx: number; vy: number; vz: number; speed: number; turbulence?: number } {
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  const cz = Math.floor(z / cellSize);
  const radiusCells = Math.max(1, Math.ceil(radius / cellSize));

  let sumVX = 0;
  let sumVY = 0;
  let sumVZ = 0;
  let weightSum = 0;
  let neighborsCount = 0;

  for (let ix = -radiusCells; ix <= radiusCells; ix += 1) {
    for (let iy = -radiusCells; iy <= radiusCells; iy += 1) {
      for (let iz = -radiusCells; iz <= radiusCells; iz += 1) {
        const key = `${cx + ix}|${cy + iy}|${cz + iz}`;
        const bucket = grid.get(key);
        if (!bucket) continue;
        for (let bi = 0; bi < bucket.length; bi += 1) {
          const idx = bucket[bi];
          const v = data[idx];
          const dx = x - v.px;
          const dy = y - v.py;
          const dz = z - v.pz;
          const distSq = dx * dx + dy * dy + dz * dz;
          const dist = Math.sqrt(distSq);
          if (dist > radius) continue;
          const w = 1 / (1 + dist); // inverse distance weighting
          sumVX += v.vx * w;
          sumVY += v.vy * w;
          sumVZ += v.vz * w;
          weightSum += w;
          neighborsCount += 1;
          if (neighborsCount >= maxNeighbors) break;
        }
      }
    }
  }

  if (weightSum === 0) return { vx: 0, vy: 0, vz: 0, speed: 0, turbulence: 0 };
  const vx = sumVX / weightSum;
  const vy = sumVY / weightSum;
  const vz = sumVZ / weightSum;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  return { vx, vy, vz, speed, turbulence: 0 };
}

function useTextTexture(label: string): THREE.Texture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const width = 512;
    const height = 256;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    // transparent background
    ctx.clearRect(0, 0, width, height);
    // outline
    ctx.font = 'bold 120px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(label, width / 2, height / 2);
    // fill
    ctx.fillStyle = 'white';
    ctx.fillText(label, width / 2, height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [label]);
  return texture;
}

const TextPlane: React.FC<{
  text: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
  billboard?: boolean;
}> = ({ text, position, rotation = [0, 0, 0], size = [1.8, 0.9], billboard = false }) => {
  const tex = useTextTexture(text);
  if (billboard) {
    return (
      <Billboard position={position} follow>
        <mesh renderOrder={1}>
          <planeGeometry args={size} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} />
        </mesh>
      </Billboard>
    );
  }
  return (
    <mesh position={position} rotation={rotation} renderOrder={1}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
};

const HeightLabels: React.FC<{
  heightSlices: number[];
  bounds: [number, number, number];
  edgeLabelMargin: number;
}> = ({ heightSlices, bounds, edgeLabelMargin }) => {
  const { camera } = useThree();
  const minH = Math.min(...heightSlices);
  const maxH = Math.max(...heightSlices);

  // Determine closest vertical edge (x,z) to camera on XZ plane
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

const ParticleField: React.FC<{
  vectors?: WindVector[];
  speedMultiplier: number;
  numParticles: number;
  bounds: [number, number, number];
  fieldSampler?: FieldSampler;
  currentTime: number;
  damping: number;
  turbulenceStrength: number;
  isPlaying: boolean;
}> = ({ vectors, speedMultiplier, numParticles, bounds, fieldSampler, currentTime, damping, turbulenceStrength, isPlaying }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors, velocities, prepared, grid, cellSize } = useMemo(() => {
    const preparedVectors: PreparedVector[] = (vectors ?? []).map((v) => {
      const angle = v.direction; // radians around Y axis
      const vx = Math.cos(angle) * v.speed;
      const vz = Math.sin(angle) * v.speed;
      const vy = 0;
      return { px: v.position[0], py: v.position[1], pz: v.position[2], vx, vy, vz, speed: v.speed };
    });

    const gridCellSize = 1.5;
    const spatialGrid = preparedVectors.length ? buildSpatialGrid(preparedVectors, gridCellSize) : new Map<string, number[]>();

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
      vel[i * 3 + 0] = 0;
      vel[i * 3 + 1] = 0;
      vel[i * 3 + 2] = 0;
    }

    return { positions: pos, colors: col, velocities: vel, prepared: preparedVectors, grid: spatialGrid, cellSize: gridCellSize };
  }, [vectors, numParticles, bounds]);

  const halfX = bounds[0];
  const halfY = bounds[1];
  const halfZ = bounds[2];

  // Trails and speed-change tracking
  const TRAIL_LENGTH = 24;
  const trailPositions = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH * 3), [numParticles]);
  const trailColors = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH * 3), [numParticles]);
  const trailHeadRef = useRef(0);
  const prevSpeed = useMemo(() => new Float32Array(numParticles), [numParticles]);
  const curSpeed = useMemo(() => new Float32Array(numParticles), [numParticles]);
  const deltaSpeed = useMemo(() => new Float32Array(numParticles), [numParticles]);
  const trailPointsRef = useRef<THREE.Points>(null);
  const sizes = useMemo(() => new Float32Array(numParticles).fill(1), [numParticles]);
  const gustRatios = useMemo(() => new Float32Array(numParticles).fill(0), [numParticles]);

  // Minimal custom shader to support per-particle size and circular points
  const particleVertex = `
    attribute float aSize;
    attribute vec3 color;
    varying vec3 vColor;
    uniform float uSize;             // global px scale
    uniform float uViewportHeight;   // pixels
    uniform float uFov;              // radians
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float projScale = uViewportHeight / (2.0 * tan(uFov * 0.5));
      float sizePx = max(1.0, aSize * uSize * projScale / max(1.0, -mvPosition.z));
      gl_PointSize = sizePx;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  const particleFragment = `
    varying vec3 vColor;
    uniform float uOpacity;
    void main() {
      // circular sprite
      vec2 c = gl_PointCoord - vec2(0.5);
      float r = dot(c, c);
      if (r > 0.25) discard;
      gl_FragColor = vec4(vColor, uOpacity);
    }
  `;
  const particleUniforms = useMemo(() => ({
    uSize: { value: 0.25 },
    uViewportHeight: { value: 400.0 },
    uFov: { value: 45 * Math.PI / 180 },
    uOpacity: { value: 1.0 },
  }), []);

  useFrame((state, delta) => {
    particleUniforms.uViewportHeight.value = state.size.height * (state.viewport.dpr || 1);
    // @ts-expect-error assuming perspective camera
    particleUniforms.uFov.value = (state.camera?.fov ?? 45) * Math.PI / 180.0;
    if (!isPlaying) {
      velocities.fill(0);
      return;
    }
    const pos = positions;
    const col = colors;
    const vel = velocities;
    const velocityScale = 1.0 * speedMultiplier; // tune flow speed (acts as acceleration scale)
    const radius = 2.5;
    const maxNeighbors = 12;
    const accelScale = delta * velocityScale;
    const damp = Math.max(0, Math.min(1, damping));
    const jitter = Math.max(0, Math.min(1, turbulenceStrength));

    for (let i = 0; i < pos.length; i += 3) {
      let x = pos[i + 0];
      let y = pos[i + 1];
      let z = pos[i + 2];

      const s = fieldSampler
        ? fieldSampler(x, y, z, currentTime)
        : sampleField(x, y, z, grid, prepared, cellSize, radius, maxNeighbors);

      const particleIndex = i / 3;
      curSpeed[particleIndex] = s.speed;
      const ds = s.speed - prevSpeed[particleIndex];
      deltaSpeed[particleIndex] = ds;
      prevSpeed[particleIndex] = s.speed;
      const gRatio = (s as any).gustRatio ?? 0;
      gustRatios[particleIndex] = gRatio;

      // simple forces: accelerate towards field direction, then dampen velocity
      // base advection strength from horiz speed mean (s.speed already includes vy)
      const advectionScale = 0.5 + Math.min(3, s.speed);
      vel[i + 0] += s.vx * accelScale * advectionScale;
      vel[i + 1] += s.vy * accelScale * advectionScale;
      vel[i + 2] += s.vz * accelScale * advectionScale;

      // turbulence jitter
      if (jitter > 0) {
        const n1 = Math.sin((x + currentTime * 0.7 + i) * 0.37);
        const n2 = Math.sin((y + currentTime * 0.5 + i * 0.5) * 0.53);
        const n3 = Math.sin((z + currentTime * 0.9 + i * 0.23) * 0.41);
        const turbFactor = 0.5 + (s.turbulence ?? 0);
        // Scale jitter by turbulence intensity
        vel[i + 0] += n1 * 0.25 * jitter * turbFactor;
        vel[i + 1] += n2 * 0.2 * jitter * turbFactor;
        vel[i + 2] += n3 * 0.25 * jitter * turbFactor;
      }

      // damping (per-second)
      const dampFactor = Math.exp(-damp * delta);
      vel[i + 0] *= dampFactor;
      vel[i + 1] *= dampFactor;
      vel[i + 2] *= dampFactor;

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

      // map gusts to particle size and color: stronger gusts -> larger and warmer color
      const gustClamped = Math.max(0, Math.min(1, gRatio));
      // base color from speed; warm with gust
      const tSpeed = Math.max(0, Math.min(1, s.speed / 20));
      const r = 0.4 + 0.6 * Math.max(tSpeed, gustClamped);
      const g = 0.9 - 0.7 * Math.max(tSpeed * 0.6, 0);
      const b = 1 - 0.8 * tSpeed * (1 - gustClamped * 0.5);
      col[i + 0] = r;
      col[i + 1] = g;
      col[i + 2] = b;

      // per-particle size from gust ratio (smaller range)
      sizes[particleIndex] = 0.2 + gustClamped * 0.6; // 0.2..0.8
    }

    if (pointsRef.current) {
      const geometry = pointsRef.current.geometry as THREE.BufferGeometry;
      const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    }

    // Update trails: global decay then write current snapshot at head
    const decayPerSecond = 0.92;
    const decay = Math.pow(decayPerSecond, delta);
    for (let c = 0; c < trailColors.length; c += 1) {
      trailColors[c] *= decay;
    }
    const head = trailHeadRef.current;
    const headBase = head * numParticles * 3;
    for (let i = 0; i < numParticles; i += 1) {
      const pi = i * 3;
      const hi = headBase + pi;
      trailPositions[hi + 0] = pos[pi + 0];
      trailPositions[hi + 1] = pos[pi + 1];
      trailPositions[hi + 2] = pos[pi + 2];

      const sNow = curSpeed[i];
      const gRatio = Math.max(0, Math.min(1, gustRatios[i]));
      const intensity = 0.5 + 0.5 * Math.max(gRatio, Math.min(1, sNow / 20));
      trailColors[hi + 0] = intensity;
      trailColors[hi + 1] = 0.6 * (1 - intensity * 0.5);
      trailColors[hi + 2] = 0.8 * (1 - intensity);
    }
    trailHeadRef.current = (head + 1) % TRAIL_LENGTH;

    if (trailPointsRef.current) {
      const geo = trailPointsRef.current.geometry as THREE.BufferGeometry;
      const pAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const cAttr = geo.getAttribute('color') as THREE.BufferAttribute;
      pAttr.needsUpdate = true;
      cAttr.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Trails */}
      <points ref={trailPointsRef} frustumCulled={false}>
      <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} usage={THREE.DynamicDrawUsage} />
      </bufferGeometry>
      <PointMaterial
        transparent
        vertexColors
          size={0.02}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Particles */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} usage={THREE.DynamicDrawUsage} />
        </bufferGeometry>
        <shaderMaterial
          transparent
        depthWrite={false}
          vertexShader={particleVertex}
          fragmentShader={particleFragment}
          uniforms={particleUniforms as any}
      />
    </points>
    </>
  );
};

export const VectorField: React.FC<Props> = ({
  vectors,
  speedMultiplier = 1,
  numParticles = 5,
  bounds = [5, 5, 5],
  fieldSampler,
  currentTime = 0,
  damping = 0.8,
  turbulenceStrength = 0.2,
  isPlaying = true,
  heightSlices,
  statusText,
}) => {
  const particleCount = useMemo(() => {
    if (numParticles && numParticles > 0) return numParticles;
    const base = (vectors?.length ?? 0) > 0 ? (vectors!.length * 10) : 1500;
    return Math.min(6000, Math.max(1000, base));
  }, [numParticles, vectors?.length]);

  const boxSize: [number, number, number] = [bounds[0] * 2, bounds[1] * 2, bounds[2] * 2];
  const floorY = -bounds[1] + 0.02;
  const labelMargin = 0.8;
  const edgeLabelMargin = 0.6;

  return (
    <>
      {/* bounds */}
      <mesh>
        <boxGeometry args={boxSize} />
        <meshBasicMaterial color="gray" wireframe transparent opacity={0.12} />
      </mesh>

      {/* Height slices */}
      {heightSlices && heightSlices.length > 0 && (
        <group>
          {heightSlices.map((h) => {
            // map meters to world Y
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

      {/* 2D overlay status text (camera-facing), auto-wrapped via drei Text */}
      {statusText && (
        <Billboard position={[0, bounds[1] + 0.8, 0]} follow>
          <mesh renderOrder={2}>
            <planeGeometry args={[5.2, 0.8]} />
            <meshBasicMaterial color={new THREE.Color('black')} transparent opacity={0.15} />
          </mesh>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.25}
            color="white"
            outlineWidth={0.02}
            outlineColor="black"
            maxWidth={5.0}
            lineHeight={1.15}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            {statusText}
          </Text>
        </Billboard>
      )}

      {/* Direction labels as 2D planes pointing along +Z normal */}
      <TextPlane text="NORTH" position={[0, floorY, -bounds[2] - labelMargin]} rotation={[-Math.PI / 2, 0, 0]} />
      <TextPlane text="SOUTH" position={[0, floorY, bounds[2] + labelMargin]} rotation={[-Math.PI / 2, 0, 0]} />
      <TextPlane text="EAST" position={[bounds[0] + labelMargin, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <TextPlane text="WEST" position={[-bounds[0] - labelMargin, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} />

      <ParticleField
        vectors={vectors}
        speedMultiplier={speedMultiplier}
        numParticles={particleCount}
        bounds={bounds}
        fieldSampler={fieldSampler}
        currentTime={currentTime}
        damping={damping}
        turbulenceStrength={turbulenceStrength}
        isPlaying={isPlaying}
      />
    </>
  );
};
