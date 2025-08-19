
import * as THREE from 'three';
import { type WindFrame, type FieldSampler, type FramesByHeight } from './types';

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function meteoDirDegToRadXZ(deg: number) {
  // Meteorological direction points FROM the direction (e.g., 0 = from North towards South).
  // Convert to a flow vector pointing TO the movement direction in XZ plane.
  const rad = degToRad(deg);
  const flowAngle = rad + Math.PI; // reverse
  return flowAngle;
}

// Lightweight pseudo-noise for turbulence (deterministic, cheap)
function hashNoise(x: number, y: number, z: number, t: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + t * 0.151) * 43758.5453;
  return s - Math.floor(s);
}

export function createFieldSamplerForFrame(frame?: WindFrame, _opts?: { bounds?: [number, number, number] }): FieldSampler {
  const angle = meteoDirDegToRadXZ(frame?.directionDeg ?? 0);
  const baseVY = frame?.vertSpeedMean ?? 0;
  const turb = frame?.turbulenceIntensity ?? 0;
  const horizStd = frame?.horizSpeedStd ?? 0;
  const vertStd = frame?.vertSpeedStd ?? 0;
  // const bounds = opts?.bounds ?? [5, 5, 5];

  // Precompute clamps for coloring/scaling
  const maxStd = Math.max(1, Math.max(horizStd, vertStd) * 2);
  const meanHS = frame?.horizSpeedMean ?? 0;
  const maxHS = frame?.horizSpeedMax ?? meanHS;
  const gust = Math.max(0, maxHS - meanHS);
  const gustRatio = meanHS > 0 ? gust / meanHS : 0;

  return (x: number, y: number, z: number, time: number) => {
    // Add small spatially-varying perturbations shaped by std dev and TI
    const n1 = hashNoise(x * 0.7, y * 0.7, z * 0.7, time * 0.3);
    const n2 = hashNoise(x * 1.3 + 10, y * 0.9 + 3, z * 1.1 + 7, time * 0.5);
    const n3 = hashNoise(x * 0.4 - 2, y * 1.5 + 4, z * 0.8 - 6, time * 0.2);

    const turbScale = THREE.MathUtils.clamp(turb, 0, 2);
    const jitterH = (n1 - 0.5) * 2 * horizStd * 0.6 * (0.5 + turbScale);
    const jitterV = (n2 - 0.5) * 2 * vertStd * 0.6 * (0.5 + turbScale);
    const angleJitter = (n3 - 0.5) * 0.35 * (0.3 + turbScale * 0.7);

    const baseHS = meanHS;
    const vx = Math.cos(angle + angleJitter) * (baseHS + jitterH) + 0;
    const vz = Math.sin(angle + angleJitter) * (baseHS + jitterH) + 0;
    const vy = baseVY + jitterV * 0.4;

    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const turbulence = THREE.MathUtils.clamp((horizStd + vertStd) / maxStd * (0.4 + turbScale * 0.6), 0, 1);
    return { vx, vy, vz, speed, turbulence, gust, gustRatio };
  };
}

// Create layered sampler that blends between heights based on Y.
export function createLayeredFieldSampler(
  framesByHeight: FramesByHeight,
  heights: number[],
  frameIndex: number, // integer or fractional index in the time sequence
  opts?: { bounds?: [number, number, number] },
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

  const bounds = opts?.bounds ?? [5, 5, 5];

  return (x: number, yWorld: number, z: number, time: number) => {
    // Map world Y to height meters range for blending
    const minH = sortedHeights[0];
    const maxH = sortedHeights[sortedHeights.length - 1];
    const yMin = -bounds[1];
    const yMax = bounds[1];
    const tNorm = THREE.MathUtils.clamp((yWorld - yMin) / (yMax - yMin), 0, 1);
    const yMeters = THREE.MathUtils.lerp(minH, maxH, tNorm);

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
    const ti0 = f0?.turbulenceIntensity ?? 0;
    const ti1 = f1?.turbulenceIntensity ?? ti0;

    const vx0 = Math.cos(angle0) * hs0;
    const vz0 = Math.sin(angle0) * hs0;
    const vy0 = vs0;
    const vx1 = Math.cos(angle1) * hs1;
    const vz1 = Math.sin(angle1) * hs1;
    const vy1 = vs1;

    const vx = THREE.MathUtils.lerp(vx0, vx1, tBlend);
    const vy = THREE.MathUtils.lerp(vy0, vy1, tBlend);
    const vz = THREE.MathUtils.lerp(vz0, vz1, tBlend);
    const turbulence = THREE.MathUtils.lerp(ti0, ti1, tBlend);

    // Add small pseudo-noise variability similar to single-frame sampler
    const n = hashNoise(x * 0.6, yWorld * 0.6, z * 0.6, time * 0.4);
    const jitter = (n - 0.5) * 0.6 * (0.5 + turbulence);
    const jAngle = jitter * 0.25;
    const speedScale = 1 + jitter * 0.15;
    const angleBase = Math.atan2(vz, vx) + jAngle;
    const baseSpeed = Math.sqrt(vx * vx + vz * vz) * speedScale;
    const vxJ = Math.cos(angleBase) * baseSpeed;
    const vzJ = Math.sin(angleBase) * baseSpeed;
    const vyJ = vy * (1 + jitter * 0.1);

    const speed = Math.sqrt(vxJ * vxJ + vyJ * vyJ + vzJ * vzJ);
    const meanHS = THREE.MathUtils.lerp(hs0, hs1, tBlend);
    const maxHS = THREE.MathUtils.lerp(f0?.horizSpeedMax ?? hs0, f1?.horizSpeedMax ?? hs1, tBlend);
    const g = Math.max(0, maxHS - meanHS);
    const gr = meanHS > 0 ? g / meanHS : 0;
    return { vx: vxJ, vy: vyJ, vz: vzJ, speed, turbulence, gust: g, gustRatio: gr };
  };
}
