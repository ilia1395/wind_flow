import * as THREE from 'three';
import type { FieldSampler, FieldSample } from '@/entities/FieldSampler';
import { DEFAULT_SPEED_BINS, WIND_SPEED_PALETTE } from '@/shared/constants/windPalette';

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
  seekToTime(timeSeconds: number): void;
  getHistoryInfo(): { count: number; capacity: number; minTime: number; maxTime: number };
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

  // --- History ring buffer (to support scrubbing/rewind) -------------------------------------
  const historyCapacity = Math.max(1, trailLength);
  const historyPositions = new Float32Array(historyCapacity * numParticles * 3);
  const historyColors = new Float32Array(historyCapacity * numParticles * 3);
  const historyAngles = new Float32Array(historyCapacity * numParticles);
  const historyOpacities = new Float32Array(historyCapacity * numParticles);
  const historySpeeds = new Float32Array(historyCapacity * numParticles);
  const historyTimes = new Float64Array(historyCapacity);
  let historyHead = 0;   // next write index
  let historyCount = 0;  // how many valid frames stored (<= capacity)

  // --- Shared wind speed palette (CSS vars -> RGB) ------------------------------------------
  let paletteRgb: Array<[number, number, number]> | null = null;
  function hexToRgb01(hex: string): [number, number, number] {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return [1, 1, 1];
    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;
    return [r, g, b];
  }
  function resolveCssVarValue(varRef: string): string | null {
    try {
      const varNameMatch = /var\((--[^)]+)\)/.exec(varRef);
      const varName = varNameMatch ? varNameMatch[1] : null;
      if (!varName || typeof window === 'undefined') return null;
      const val = getComputedStyle(document.documentElement).getPropertyValue(varName);
      return val ? val.trim() : null;
    } catch {
      return null;
    }
  }
  function getPaletteRgb(): Array<[number, number, number]> {
    if (paletteRgb) return paletteRgb;
    paletteRgb = WIND_SPEED_PALETTE.map((ref) => {
      const resolved = resolveCssVarValue(ref) || '#ffffff';
      return hexToRgb01(resolved);
    });
    return paletteRgb;
  }
  function speedToBin(v: number, bins: number[] = DEFAULT_SPEED_BINS): number {
    if (!Number.isFinite(v)) return 0;
    let b = bins.length - 1; // last bin is open-ended
    for (let i = 0; i < bins.length - 1; i += 1) {
      if (v >= bins[i] && v < bins[i + 1]) { b = i; break; }
    }
    return b;
  }

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

    // clear history
    historyHead = 0;
    historyCount = 0;
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
        const pal = getPaletteRgb();
        const bin = speedToBin(s.speed, DEFAULT_SPEED_BINS);
        const [r, g, b] = pal[Math.min(bin, pal.length - 1)];
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

    // Record snapshot into history (after particle state is updated for this frame)
    {
      const basePos = historyHead * numParticles * 3;
      const baseSca = historyHead * numParticles;
      historyPositions.set(positions, basePos);
      historyColors.set(colors, basePos);
      historyAngles.set(angles, baseSca);
      historyOpacities.set(opacities, baseSca);
      historySpeeds.set(curSpeed, baseSca);
      historyTimes[historyHead] = currentTime;
      historyHead = (historyHead + 1) % historyCapacity;
      if (historyCount < historyCapacity) historyCount += 1;
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
        // Color trail by shared wind speed palette
        const pal = getPaletteRgb();
        const bin = speedToBin(sNow, DEFAULT_SPEED_BINS);
        const [r, g, b] = pal[Math.min(bin, pal.length - 1)];
        trailColors[hi + 0] = r;
        trailColors[hi + 1] = g;
        trailColors[hi + 2] = b;
        // Use normalized speed to scale dot size/opacity boost
        const t = Math.max(0.1, Math.min(1, sNow / 20));
        intensity = t;
      }

      const vertexIndex = trailHead * numParticles + i;
      const boost = 0.8 * intensity;
      trailDotSizes[vertexIndex] = config.trailDotBaseSize + boost;
      trailOpacities[vertexIndex] = opacities[i];
    }
    trailHead = (trailHead + 1) % trailLength;
  }

  // Utility: rebuild current particle and trail buffers from a chosen history index
  function applyFromHistoryIndex(historyIndex: number) {
    if (historyCount === 0) return;
    const safeIndex = ((historyIndex % historyCapacity) + historyCapacity) % historyCapacity;
    const basePos = safeIndex * numParticles * 3;
    const baseSca = safeIndex * numParticles;
    // restore current particle buffers
    positions.set(historyPositions.subarray(basePos, basePos + numParticles * 3));
    colors.set(historyColors.subarray(basePos, basePos + numParticles * 3));
    angles.set(historyAngles.subarray(baseSca, baseSca + numParticles));
    opacities.set(historyOpacities.subarray(baseSca, baseSca + numParticles));

    // rebuild trails from up to trailLength historical frames ending at safeIndex
    // j goes from oldest to newest across trail buffer rows
    for (let j = 0; j < trailLength; j += 1) {
      const framesBack = (trailLength - 1 - j);
      // compute the history index for this trail row
      let idx = safeIndex - framesBack;
      // check if within available history window
      let valid = true;
      if (historyCount < trailLength && framesBack >= historyCount) valid = false;
      if (idx < 0) idx += historyCapacity;
      const rowBasePos = (j * numParticles) * 3;
      const rowBaseSca = j * numParticles;
      if (!valid) {
        // zero out if we do not have data that far back
        trailPositions.fill(0, rowBasePos, rowBasePos + numParticles * 3);
        trailColors.fill(0, rowBasePos, rowBasePos + numParticles * 3);
        trailOpacities.fill(0, rowBaseSca, rowBaseSca + numParticles);
        trailDotSizes.fill(0, rowBaseSca, rowBaseSca + numParticles);
        continue;
      }
      const hBasePos = idx * numParticles * 3;
      const hBaseSca = idx * numParticles;
      // copy positions and colors directly
      trailPositions.set(historyPositions.subarray(hBasePos, hBasePos + numParticles * 3), rowBasePos);
      trailColors.set(historyColors.subarray(hBasePos, hBasePos + numParticles * 3), rowBasePos);
      // copy opacities
      trailOpacities.set(historyOpacities.subarray(hBaseSca, hBaseSca + numParticles), rowBaseSca);
      // compute dot sizes from recorded speed/opacities
      for (let p = 0; p < numParticles; p += 1) {
        const o = historyOpacities[hBaseSca + p];
        const sp = historySpeeds[hBaseSca + p];
        const isInterpolatedTrail = o < 1.0;
        let intensity = 0.4;
        if (!isInterpolatedTrail) {
          const t = Math.max(0.1, Math.min(1, sp / 20));
          intensity = t;
        }
        const vertexIndex = rowBaseSca + p;
        const boost = 0.8 * intensity;
        trailDotSizes[vertexIndex] = config.trailDotBaseSize + boost;
      }
    }
    // set trailHead to next write position (newest was at last row)
    trailHead = 0;
  }

  function seekToTime(timeSeconds: number) {
    if (historyCount === 0) return;
    // Find the history frame closest to timeSeconds (search backward from newest)
    const newestIndex = (historyHead - 1 + historyCapacity) % historyCapacity;
    let bestIndex = newestIndex;
    let bestScore = Math.abs(historyTimes[newestIndex] - timeSeconds);
    let stepsChecked = 1;
    for (let n = 1; n < historyCount; n += 1) {
      const idx = (newestIndex - n + historyCapacity) % historyCapacity;
      const score = Math.abs(historyTimes[idx] - timeSeconds);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = idx;
      }
      stepsChecked += 1;
    }
    applyFromHistoryIndex(bestIndex);
  }

  function getHistoryInfo() {
    const count = historyCount;
    const capacity = historyCapacity;
    const newestIndex = count > 0 ? (historyHead - 1 + historyCapacity) % historyCapacity : 0;
    const oldestIndex = count > 0 ? ((historyHead - count + historyCapacity) % historyCapacity) : 0;
    const maxTime = count > 0 ? historyTimes[newestIndex] : 0;
    const minTime = count > 0 ? historyTimes[oldestIndex] : 0;
    return { count, capacity, minTime, maxTime };
  }

  return { positions, colors, angles, sizes, opacities, trailPositions, trailColors, trailOpacities, trailDotSizes, reset, step, seekToTime, getHistoryInfo };
}


