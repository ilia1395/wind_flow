import type { WindFrame } from '@/entities/WindData/lib/types';

export type WindRoseSector = {
  centerDeg: number;
  binCounts: number[]; // counts per speed bin
  total: number; // sum of counts in this sector
};

export type WindRoseData = {
  sectors: WindRoseSector[];
  maxTotal: number;
  binEdges: number[]; // inclusive lower bounds, last edge is the lower bound for the open-ended bin
};

export type WindRosePeriod = '10min' | '1d' | '1month';

// Default bins similar to common wind-rose scales (m/s)
export const DEFAULT_SPEED_BINS: number[] = [
  0, 5, 10, 15, 20, 25,
];

export function periodToSeconds(period: WindRosePeriod): number {
  switch (period) {
    case '10min': return 600;
    case '1d': return 86400;
    case '1month': return 30 * 86400;
    default: return 60;
  }
}

export function computeWindRose(
  frames: WindFrame[] | undefined,
  currentUnixSec: number,
  options?: {
    periodSec?: number;
    sectorCount?: number; // number of direction sectors (e.g., 16)
    binEdges?: number[]; // ascending edges; last bin is open-ended (>= last)
    angleOffsetDeg?: number; // 0 means 0° points to East; 90° = North
  }
): WindRoseData {
  const periodSec = options?.periodSec ?? 600;
  const sectorCount = options?.sectorCount ?? 16;
  const binEdges = (options?.binEdges ?? DEFAULT_SPEED_BINS).slice().sort((a, b) => a - b);
  const angleOffsetDeg = options?.angleOffsetDeg ?? 0;

  // initialize sectors
  const sectors: WindRoseSector[] = new Array(sectorCount)
    .fill(0)
    .map((_, i) => ({ centerDeg: (i * 360) / sectorCount, binCounts: new Array(binEdges.length).fill(0), total: 0 }));

  const width = 360 / sectorCount;
  const startTime = currentUnixSec - periodSec;

  if (!frames || !frames.length) {
    return { sectors, maxTotal: 0, binEdges };
  }

  // process frames in reverse chronological order
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const f = frames[i];
    const t = typeof f.time === 'number' ? f.time : NaN;
    if (!Number.isFinite(t) || t < startTime) break; // frames are chronological in CSV

    const speed = Number(f.horizSpeedMean ?? 0);
    const dir = Number(f.directionDeg ?? 0);
    if (!Number.isFinite(speed) || !Number.isFinite(dir)) continue;

    // normalize direction to 0..360
    const shifted = ((dir - angleOffsetDeg) % 360 + 360) % 360;
    // find sector index based on center-based sectoring
    const idx = Math.floor((shifted + width / 2) / width) % sectorCount;

    // Determine speed bin index
    // last bin open-ended
    let b = binEdges.length - 1;
    // or find the first interval edge[k], edge[k+1] where speed is in the interval
    for (let k = 0; k < binEdges.length - 1; k += 1) {
      if (speed >= binEdges[k] && speed < binEdges[k + 1]) {
        b = k;
        break;
      }
    }

    // increment count for selected sector bin
    sectors[idx].binCounts[b] += 1;
    // increment total count for this sector
    sectors[idx].total += 1;
  }

  // find the maximum summarized count across all sectors
  const maxTotal = sectors.reduce((m, s) => Math.max(m, s.total), 0);
  return { sectors, maxTotal, binEdges };
}


