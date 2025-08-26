
import * as THREE from 'three';
import { meteoDirDegToRadXZ } from '@shared/lib/math/meteoData';
import { hashNoise } from '@shared/lib/math/simulation';
import type { FieldSampler } from '../types/types';
import type { FramesByHeight, WindFrame } from '@entities/WindData/types/types';


// spatial grid
export function buildSpatialGrid(
  vectors: Array<{ px: number; py: number; pz: number; vx: number; vy: number; vz: number; speed: number }>,
  cellSize: number,
): Map<string, number[]>  {
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

// Create layered sampler that blends between heights based on Y.
export function createLayeredFieldSampler(
  framesByHeight: FramesByHeight,
  heights: number[],
  frameIndex: number,
): FieldSampler {
  const sortedHeights = [...heights].sort((a, b) => a - b);
  // Choose the same index across heights; clamp to available length per height
  const indexPerHeight = new Map<number, number>();
  for (const h of sortedHeights) {
    const arr = framesByHeight[h] ?? [];
    if (arr.length === 0) continue;
    const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(frameIndex) % arr.length));
    indexPerHeight.set(h, idx);
  }

  function frameAtHeight(h: number): WindFrame | undefined {
    const idx = indexPerHeight.get(h);
    if (idx == null) return undefined;
    const arr = framesByHeight[h] ?? [];
    return arr[idx];
  }

  // derive y-span from data heights so 1 unit = 1 meter
  const bounds = (() => {
    if (heights && heights.length > 0) {
      const minH = Math.min(...heights);
      const maxH = Math.max(...heights);
      const span = Math.max(1, maxH - minH);
      const halfY = span * 0.5;
      const halfXZ = halfY;
      return [halfXZ, halfY, halfXZ];
    }
    return [5, 5, 5];
  })();

  return (x: number, yWorld: number, z: number, time: number) => {
    // Map world Y to height meters range for blending
    const minH = sortedHeights[0];
    const maxH = sortedHeights[sortedHeights.length - 1];
    // World units calibrated: 1 unit ~ 1 meter by deriving bounds from heights
    const yMeters = THREE.MathUtils.clamp(yWorld + minH + bounds[1], minH, maxH);

    // Find surrounding heights
    let lower = sortedHeights[0];
    let upper = sortedHeights[sortedHeights.length - 1];
    for (let i = 0; i < sortedHeights.length - 1; i += 1) {
      const h0 = sortedHeights[i];
      const h1 = sortedHeights[i + 1];
      if (yMeters >= h0 && yMeters <= h1) {
        lower = h0;
        upper = h1;
        break;
      }
    }

    const f0 = frameAtHeight(lower) ?? frameAtHeight(sortedHeights[0]);
    const f1 = frameAtHeight(upper) ?? frameAtHeight(sortedHeights[sortedHeights.length - 1]);
    if (!f0 && !f1) return { vx: 0, vy: 0, vz: 0, speed: 0, turbulence: 0 };

    const tBlend = lower === upper || !f1 ? 0 : (yMeters - lower) / (upper - lower);
    const angle0 = meteoDirDegToRadXZ(f0?.directionDeg ?? 0);
    const angle1 = meteoDirDegToRadXZ(f1?.directionDeg ?? f0?.directionDeg ?? 0);

    const hs0 = f0?.horizSpeedMean ?? 0;
    const hs1 = f1?.horizSpeedMean ?? hs0;
    const vs0 = f0?.vertSpeedMean ?? 0;
    const vs1 = f1?.vertSpeedMean ?? vs0;
    const hsStd0 = f0?.horizSpeedStd ?? 0;
    const hsStd1 = f1?.horizSpeedStd ?? hsStd0;
    const vsStd0 = f0?.vertSpeedStd ?? 0;
    const vsStd1 = f1?.vertSpeedStd ?? vsStd0;
    const ti0 = f0?.turbulenceIntensity ?? 0;
    const ti1 = f1?.turbulenceIntensity ?? ti0;

    const vx0 = Math.cos(angle0) * hs0;
    const vz0 = Math.sin(angle0) * hs0;
    const vy0 = vs0;
    const vx1 = Math.cos(angle1) * hs1;
    const vz1 = Math.sin(angle1) * hs1;
    const vy1 = vs1;

    const vxBase = THREE.MathUtils.lerp(vx0, vx1, tBlend);
    const vyBase = THREE.MathUtils.lerp(vy0, vy1, tBlend);
    const vzBase = THREE.MathUtils.lerp(vz0, vz1, tBlend);
    const turbulence = THREE.MathUtils.lerp(ti0, ti1, tBlend);

    // Variance-aware interpolation of std (σ²)
    const hsVar = THREE.MathUtils.lerp(hsStd0 * hsStd0, hsStd1 * hsStd1, tBlend);
    const vsVar = THREE.MathUtils.lerp(vsStd0 * vsStd0, vsStd1 * vsStd1, tBlend);
    const sigmaH = Math.sqrt(Math.max(0, hsVar));
    const sigmaV = Math.sqrt(Math.max(0, vsVar));

    // Component-wise additive noise (approx Gaussian)
    const uVx = hashNoise(x * 0.91 + 1.7, yWorld * 0.63 + 5.4, z * 1.07 - 2.9, time * 0.43) - 0.5;
    const uVz = hashNoise(x * 1.27 - 8.1, yWorld * 1.11 - 3.3, z * 0.79 + 7.6, time * 0.31) - 0.5;
    const uVy = hashNoise(x * 0.58 + 4.5, yWorld * 1.36 + 2.2, z * 1.24 - 6.8, time * 0.27) - 0.5;
    const sqrt12 = Math.sqrt(12);
    const sigmaHComp = sigmaH / Math.SQRT2;
    const nVx = uVx * sqrt12 * sigmaHComp;
    const nVz = uVz * sqrt12 * sigmaHComp;
    const nVy = uVy * sqrt12 * sigmaV;

    const vx = vxBase + nVx;
    const vy = vyBase + nVy;
    const vz = vzBase + nVz;

    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const meanHS = THREE.MathUtils.lerp(hs0, hs1, tBlend);
    const maxHS = THREE.MathUtils.lerp(f0?.horizSpeedMax ?? hs0, f1?.horizSpeedMax ?? hs1, tBlend);
    const g = Math.max(0, maxHS - meanHS);
    const gr = meanHS > 0 ? g / meanHS : 0;
    return { vx, vy, vz, speed, turbulence, gust: g, gustRatio: gr };
  };
}
