// windData.ts
import * as THREE from 'three';

export type WindFrame = {
  // timestamp or frame index
  time: number;
  // original timestamp string if available (to avoid tz shifts in display)
  timeString?: string;
  // degrees (meteorological): 0/360 from North, clockwise. We'll convert to radians in XZ plane.
  directionDeg: number;
  // horizontal wind speed mean (m/s)
  horizSpeedMean: number;
  // horizontal wind speed std dev (m/s)
  horizSpeedStd: number;
  // horizontal wind speed max (m/s)
  horizSpeedMax?: number;
  // vertical wind speed mean (m/s)
  vertSpeedMean: number;
  // vertical wind speed std dev (m/s)
  vertSpeedStd: number;
  // horizontal variance (m^2/s^2)
  horizVariance?: number;
  // horizontal min (m/s)
  horizMin?: number;
  // turbulence intensity (0..1 typically; can be >1 in extreme cases)
  turbulenceIntensity?: number;
};

export type FieldSample = {
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  turbulence?: number;
  gust?: number; // m/s above mean
  gustRatio?: number; // (max-mean)/mean
};

export type FieldSampler = (x: number, y: number, z: number, time: number) => FieldSample;

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

// Robust timestamp parser for mast CSV (e.g. "07/08/2014 08:10")
// Tries day-first dd/MM/yyyy, then month-first MM/dd/yyyy when unambiguous
function parseMastTimestampSeconds(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  // dd/MM/yyyy HH:mm[:ss]
  let m = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] ? Number(m[6]) : 0;
    // Heuristic: if day > 12, it's surely day-first; if day <= 12 but month > 12, it's month-first
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      // Interpret as LOCAL time to avoid UTC shift in display
      const ms = new Date(year, month - 1, day, hh, mm, ss).getTime();
      return Math.floor(ms / 1000);
    }
  }
  // MM/dd/yyyy HH:mm[:ss]
  m = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] ? Number(m[6]) : 0;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const ms = new Date(year, month - 1, day, hh, mm, ss).getTime();
      return Math.floor(ms / 1000);
    }
  }
  // Fallback: Date.parse if supported by runtime
  const t = Date.parse(s);
  if (Number.isFinite(t)) return Math.floor(t / 1000);
  return undefined;
}

// --- Sanitization helpers for CSV values ---
const isFiniteNumber = (n: number) => Number.isFinite(n);
const isSentinel = (n: number) => !Number.isFinite(n) || Math.abs(n) >= 9000;

function sanitizeNumber(n: number | undefined, min: number, max: number, fallback = 0): number {
  if (n == null || !isFiniteNumber(n) || isSentinel(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function sanitizeAngleDeg(n: number | undefined): number {
  if (n == null || !isFiniteNumber(n) || isSentinel(n)) return 0;
  let d = n % 360;
  if (d < 0) d += 360;
  return d;
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

  return (x: number, y: number, z: number, time: number): FieldSample => {
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

// Minimal CSV ingestion (expects header with columns matching WindFrame keys, case-insensitive)
export async function parseWindCsv(text: string): Promise<WindFrame[]> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const idx = {
    time: col('time'),
    directionDeg: col('directionDeg'),
    horizSpeedMean: col('horizSpeedMean'),
    horizSpeedStd: col('horizSpeedStd'),
    vertSpeedMean: col('vertSpeedMean'),
    vertSpeedStd: col('vertSpeedStd'),
    horizVariance: col('horizVariance'),
    horizMin: col('horizMin'),
    turbulenceIntensity: col('turbulenceIntensity'),
  };

  const frames: WindFrame[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(',');
    const rawDir = Number(parts[idx.directionDeg] ?? '');
    const rawHS = Number(parts[idx.horizSpeedMean] ?? '');
    const rawHSstd = Number(parts[idx.horizSpeedStd] ?? '');
    const rawVS = Number(parts[idx.vertSpeedMean] ?? '');
    const rawVSstd = Number(parts[idx.vertSpeedStd] ?? '');
    const rawTI = parts[idx.turbulenceIntensity] != null ? Number(parts[idx.turbulenceIntensity]) : undefined;

    const f: WindFrame = {
      time: Number(parts[idx.time] ?? i - 1) || i - 1,
      directionDeg: sanitizeAngleDeg(rawDir),
      horizSpeedMean: sanitizeNumber(rawHS, 0, 75, 0),
      horizSpeedStd: sanitizeNumber(rawHSstd, 0, 30, 0),
      vertSpeedMean: sanitizeNumber(rawVS, -30, 30, 0),
      vertSpeedStd: sanitizeNumber(rawVSstd, 0, 30, 0),
      horizVariance: idx.horizVariance >= 0 ? sanitizeNumber(Number(parts[idx.horizVariance]), 0, 120, 0) : undefined,
      horizMin: idx.horizMin >= 0 ? sanitizeNumber(Number(parts[idx.horizMin]), 0, 75, 0) : undefined,
      turbulenceIntensity: sanitizeNumber(rawTI, 0, 3, 0),
    };
    frames.push(f);
  }
  return frames;
}

// Parse the provided mast CSV with columns repeated per height.
// Extracts per-height arrays for the requested heights (default 148, 90, 50, 35, 15).
export type FramesByHeight = Record<number, WindFrame[]>;

export function parseMastCsvByHeights(
  text: string,
  heights: number[] = [],
): { framesByHeight: FramesByHeight; heights: number[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return { framesByHeight: {}, heights };

  // The first line is metadata in sample; actual header is the second line.
  const headerLineIndex = lines[0].toLowerCase().includes('csv converter') ? 1 : 0;
  const header = lines[headerLineIndex].split(',').map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());

  const idxTime = lower.findIndex((h) => h.startsWith('time and date'));
  if (idxTime === -1) throw new Error('Time and Date column not found');

  // Detect heights automatically if not provided by caller
  let detectedHeights: number[] = heights ?? [];
  if (!heights || heights.length === 0) {
    const heightSet = new Set<number>();
    for (const h of lower) {
      const m = h.match(/\bat\s*(\d+)m\s*$/);
      if (m) {
        const val = Number(m[1]);
        if (Number.isFinite(val)) heightSet.add(val);
      }
    }
    detectedHeights = Array.from(heightSet).sort((a, b) => a - b);
  }

  const colFor = (height: number, label: string) =>
    lower.findIndex((h) => h === `${label.toLowerCase()} at ${height}m`);

  const colMap: Record<number, { dir: number; hs: number; vs: number; ti: number; hsStd: number; vsStd?: number; hMax?: number }> = {} as any;
  detectedHeights.forEach((h) => {
    colMap[h] = {
      dir: colFor(h, 'Wind Direction (deg)'),
      hs: colFor(h, 'Horizontal Wind Speed (m/s)'),
      vs: colFor(h, 'Vertical Wind Speed (m/s)'),
      ti: colFor(h, 'TI'),
      hsStd: colFor(h, 'Horizontal Std.Dev. (m/s)'),
      hMax: colFor(h, 'Horizontal Max (m/s)'),
      vsStd: -1, // not available in provided columns
    };
  });

  const framesByHeight: FramesByHeight = {};
  detectedHeights.forEach((h) => (framesByHeight[h] = []));

  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const parts = raw.split(',');
    const timeStr = parts[idxTime]?.trim();
    const timeSec = parseMastTimestampSeconds(timeStr);
    const time = timeSec ?? i - (headerLineIndex + 1);

    for (const h of detectedHeights) {
      const map = colMap[h];
      if (map.dir < 0 || map.hs < 0 || map.vs < 0 || map.ti < 0) continue;
      const directionDeg = sanitizeAngleDeg(Number(parts[map.dir] ?? ''));
      const horizSpeedMean = sanitizeNumber(Number(parts[map.hs] ?? ''), 0, 75, 0);
      const vertSpeedMean = sanitizeNumber(Number(parts[map.vs] ?? ''), -30, 30, 0);
      const turbulenceIntensity = sanitizeNumber(Number(parts[map.ti] ?? ''), 0, 3, 0);
      const horizSpeedStd = map.hsStd >= 0 ? sanitizeNumber(Number(parts[map.hsStd] ?? ''), 0, 30, 0) : 0;
      const horizSpeedMax = map.hMax != null && map.hMax >= 0 ? sanitizeNumber(Number(parts[map.hMax] ?? ''), 0, 100, 0) : undefined;

      const wf: WindFrame = {
        time,
        timeString: timeStr,
        directionDeg,
        horizSpeedMean,
        horizSpeedStd,
        horizSpeedMax,
        vertSpeedMean,
        vertSpeedStd: 0,
        turbulenceIntensity,
      };
      framesByHeight[h].push(wf);
    }
  }

  return { framesByHeight, heights: detectedHeights };
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

  return (x: number, yWorld: number, z: number, time: number): FieldSample => {
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


