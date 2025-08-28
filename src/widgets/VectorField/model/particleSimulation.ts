import * as THREE from 'three';
import type { FieldSampler, FieldSample } from '@entities/FieldSampler';

export type VectorFieldBounds = [number, number, number];

export type ParticleSimConfig = {
  bounds: VectorFieldBounds;
  trailLength: number;
  lifespan: { min: number; max: number };
  interpolatedVyBoost: number;
  trailDecayPerSecond: number;
  particleSize: number;
  trailDotBaseSize: number;
  favorMeasured: number; // probability [0..1]
  interpolatedColor: [number, number, number];
  interpolatedOpacity: number;
  colorBySpeed: boolean;
};

export type ParticleSimulation = {
  positions: Float32Array;
  colors: Float32Array;
  angles: Float32Array;
  sizes: Float32Array;
  opacities: Float32Array;
  trailPositions: Float32Array;
  trailColors: Float32Array;
  trailOpacities: Float32Array;
  trailDotSizes: Float32Array;

  reset(numParticles: number, sliceYs?: number[]): void;
  step(fieldSampler: FieldSampler | undefined, timeSeconds: number, dt: number, sliceYs?: number[]): void;
};

export function createParticleSimulation(numParticles: number, config: ParticleSimConfig): ParticleSimulation {
  const { bounds, trailLength } = config;
  const halfX = bounds[0];
  const halfY = bounds[1];
  const halfZ = bounds[2];

  // particle data
  const positions = new Float32Array(numParticles * 3);
  const colors = new Float32Array(numParticles * 3);
  const angles = new Float32Array(numParticles);
  const sizes = new Float32Array(numParticles).fill(1);
  const opacities = new Float32Array(numParticles).fill(1);
  const velocities = new Float32Array(numParticles * 3);
  const lifeRemaining = new Float32Array(numParticles);
  const prevSpeed = new Float32Array(numParticles);
  const curSpeed = new Float32Array(numParticles);

  // trails
  const trailPositions = new Float32Array(numParticles * trailLength * 3);
  const trailColors = new Float32Array(numParticles * trailLength * 3);
  const trailOpacities = new Float32Array(numParticles * trailLength).fill(0);
  const trailDotSizes = new Float32Array(numParticles * trailLength).fill(0);
  let trailHead = 0;

  function reset(n: number, sliceYs?: number[]) {
    if (n !== numParticles) {
      throw new Error('Changing numParticles after creation is not supported yet.');
    }
    for (let i = 0; i < numParticles; i += 1) {
      positions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(halfX * 2);
      // Bias initial Y towards measured heights based on favorMeasured
      if (sliceYs && sliceYs.length > 0) {
        const favorMeasured = Math.random() < config.favorMeasured;
        if (favorMeasured) {
          const idx = Math.floor(Math.random() * sliceYs.length);
          const baseY = sliceYs[idx];
          const neighborY = sliceYs[Math.min(idx + 1, sliceYs.length - 1)];
          const gap = Math.abs(neighborY - baseY);
          const band = 0.2 * (sliceYs.length > 1 ? gap : halfY * 0.25);
          const jitter = THREE.MathUtils.randFloatSpread(Math.min(1.5, Math.max(0.2, band)) * 2);
          positions[i * 3 + 1] = THREE.MathUtils.clamp(baseY + jitter, -halfY, halfY);
        } else {
          positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(halfY * 2);
        }
      } else {
        positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(halfY * 2);
      }
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(halfZ * 2);
      colors[i * 3 + 0] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
      velocities[i * 3 + 0] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
      lifeRemaining[i] = THREE.MathUtils.lerp(config.lifespan.min, config.lifespan.max, Math.random());
      prevSpeed[i] = 0;
      curSpeed[i] = 0;
    }
    trailOpacities.fill(0);
    trailDotSizes.fill(0);
    trailColors.fill(0);
    trailHead = 0;
  }

  function step(fieldSampler: FieldSampler | undefined, currentTime: number, delta: number, sliceYs?: number[]) {
    const tau = 0.8;
    const k = 1 / tau;

    for (let i = 0; i < positions.length; i += 3) {
      let x = positions[i + 0];
      let y = positions[i + 1];
      let z = positions[i + 2];

      const s: FieldSample = fieldSampler ? fieldSampler(x, y, z, currentTime) : { vx: 0, vy: 0, vz: 0, speed: 0, isInterpolated: false };

      const particleIndex = i / 3;
      curSpeed[particleIndex] = s.speed;
      prevSpeed[particleIndex] = s.speed;

      const isInterpolated = Boolean(s.isInterpolated);
      const vyTarget = isInterpolated ? s.vy * config.interpolatedVyBoost : s.vy;
      velocities[i + 0] += (s.vx - velocities[i + 0]) * k * delta;
      velocities[i + 1] += (vyTarget - velocities[i + 1]) * k * delta;
      velocities[i + 2] += (s.vz - velocities[i + 2]) * k * delta;

      x += velocities[i + 0] * delta;
      y += velocities[i + 1] * delta;
      z += velocities[i + 2] * delta;

      if (x < -halfX) x += halfX * 2; else if (x > halfX) x -= halfX * 2;
      if (y < -halfY) y += halfY * 2; else if (y > halfY) y -= halfY * 2;
      if (z < -halfZ) z += halfZ * 2; else if (z > halfZ) z -= halfZ * 2;

      positions[i + 0] = x;
      positions[i + 1] = y;
      positions[i + 2] = z;

      if (isInterpolated) {
        const [r, g, b] = config.interpolatedColor;
        colors[i + 0] = r; colors[i + 1] = g; colors[i + 2] = b;
      } else if (config.colorBySpeed) {
        const tSpeed = Math.max(0, Math.min(1, s.speed / 20));
        const r = 0.4 + 0.6 * tSpeed;
        const g = 0.9 - 0.7 * tSpeed;
        const b = 1 - 0.8 * tSpeed;
        colors[i + 0] = r; colors[i + 1] = g; colors[i + 2] = b;
      }

      const ax = velocities[i + 0];
      const az = velocities[i + 2];
      const angle = (Math.abs(ax) + Math.abs(az)) > 1e-6 ? Math.atan2(az, ax) : 0.0;
      angles[particleIndex] = angle;

      opacities[particleIndex] = isInterpolated ? config.interpolatedOpacity : 1.0;

      lifeRemaining[particleIndex] -= delta;
      if (lifeRemaining[particleIndex] <= 0) {
        positions[particleIndex * 3 + 0] = THREE.MathUtils.randFloatSpread(halfX * 2);
        if (sliceYs && sliceYs.length > 0) {
          const favorMeasured = Math.random() < config.favorMeasured;
          if (favorMeasured) {
            const idx = Math.floor(Math.random() * sliceYs.length);
            const baseY = sliceYs[idx];
            const band = 0.2 * (sliceYs.length > 1 ? Math.abs(sliceYs[Math.min(idx + 1, sliceYs.length - 1)] - baseY) : halfY * 0.25);
            const jitter = THREE.MathUtils.randFloatSpread(Math.min(1.5, Math.max(0.2, band)) * 2);
            positions[particleIndex * 3 + 1] = THREE.MathUtils.clamp(baseY + jitter, -halfY, halfY);
          } else {
            positions[particleIndex * 3 + 1] = THREE.MathUtils.randFloatSpread(halfY * 2);
          }
        } else {
          positions[particleIndex * 3 + 1] = THREE.MathUtils.randFloatSpread(halfY * 2);
        }
        positions[particleIndex * 3 + 2] = THREE.MathUtils.randFloatSpread(halfZ * 2);
        velocities[i + 0] = 0; velocities[i + 1] = 0; velocities[i + 2] = 0;
        lifeRemaining[particleIndex] = THREE.MathUtils.lerp(config.lifespan.min, config.lifespan.max, Math.random());
      }
    }

    const decay = Math.pow(config.trailDecayPerSecond, delta);
    for (let c = 0; c < trailColors.length; c += 1) trailColors[c] *= decay;
    for (let a = 0; a < trailOpacities.length; a += 1) trailOpacities[a] *= decay;

    const headBase = trailHead * numParticles * 3;
    for (let i = 0; i < numParticles; i += 1) {
      const pi = i * 3;
      const hi = headBase + pi;
      trailPositions[hi + 0] = positions[pi + 0];
      trailPositions[hi + 1] = positions[pi + 1];
      trailPositions[hi + 2] = positions[pi + 2];

      const sNow = curSpeed[i];
      const isInterpolatedTrail = opacities[i] < 1.0;
      let intensity = 0.4;
      if (isInterpolatedTrail) {
        const [r, g, b] = config.interpolatedColor;
        trailColors[hi + 0] = r; trailColors[hi + 1] = g; trailColors[hi + 2] = b;
        intensity = 0.4;
      } else {
        const t = Math.max(0.1, Math.min(1, sNow / 20));
        intensity = 0.5 * t + 0.5 * t;
        trailColors[hi + 0] = intensity;
        trailColors[hi + 1] = 0.6 * (1 - intensity * 0.5);
        trailColors[hi + 2] = 0.8 * (1 - intensity);
      }

      const vertexIndex = trailHead * numParticles + i;
      const boost = 0.8 * intensity;
      trailDotSizes[vertexIndex] = config.trailDotBaseSize + boost;
      trailOpacities[vertexIndex] = opacities[i];
    }
    trailHead = (trailHead + 1) % trailLength;
  }

  return { positions, colors, angles, sizes, opacities, trailPositions, trailColors, trailOpacities, trailDotSizes, reset, step };
}


