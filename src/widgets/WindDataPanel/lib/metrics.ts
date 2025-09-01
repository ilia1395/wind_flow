import type { FramesByHeight } from '@/entities/WindData';

export type DirStats = {
  meanSpeed: number;
  meanDirDeg: number;
};

export type RealtimeMetrics = {
  speed: number;
  dir: number;
  gust: number;
  shearPer100m: number;
  veerDeg: number;
  ti: number;
};

export type Avg10Metrics = {
  speed: number;
  dir: number;
  shearPer100m: number;
  veerDeg: number;
  turbulence: number;
  wpd: number;
  stability: 'Stable' | 'Neutral' | 'Unstable';
};

export type WindMetrics = {
  realtime: RealtimeMetrics;
  avg10: Avg10Metrics;
};

export function circularMeanDeg(values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce(
    (acc, deg) => {
      const rad = (deg * Math.PI) / 180;
      acc.x += Math.cos(rad);
      acc.y += Math.sin(rad);
      return acc;
    },
    { x: 0, y: 0 }
  );
  const angle = Math.atan2(sum.y / values.length, sum.x / values.length);
  const deg = (angle * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function computeDirStats(speeds: number[], dirs: number[]): DirStats {
  const meanSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const meanDirDeg = circularMeanDeg(dirs);
  return { meanSpeed, meanDirDeg };
}

export function formatDeg(deg: number): string {
  const d = Math.round(((deg % 360) + 360) % 360);
  return `${d}°`;
}

export function computeWindMetrics(
  framesByHeight: FramesByHeight,
  heights: number[],
  frameIndex: number
): WindMetrics {
  let maxLen = 0;
  for (const h of heights) {
    const len = (framesByHeight[h] || []).length;
    if (len > maxLen) maxLen = len;
  }
  const idxGlobal = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, maxLen - 1));

  const rtSpeeds: number[] = [];
  const rtDirs: number[] = [];
  const rtGusts: number[] = [];
  const tiVals: number[] = [];
  let lowest: { h: number; v: number; dir: number } | null = null;
  let highest: { h: number; v: number; dir: number } | null = null;
  const times: number[] = [];

  for (const h of heights) {
    const arr = framesByHeight[h] || [];
    if (!arr.length) continue;
    const idx = Math.min(idxGlobal, arr.length - 1);
    const f = arr[idx];
    if (!f) continue;
    const v = f.horizSpeedMean ?? 0;
    const max = f.horizSpeedMax ?? v;
    const gust = Math.max(0, max - v);
    rtSpeeds.push(v);
    rtDirs.push(f.directionDeg ?? 0);
    rtGusts.push(gust);
    if (typeof f.turbulenceIntensity === 'number') tiVals.push(f.turbulenceIntensity);
    times.push(typeof f.time === 'number' ? f.time : 0);
    if (lowest === null || h < lowest.h) lowest = { h, v, dir: f.directionDeg ?? 0 };
    if (highest === null || h > highest.h) highest = { h, v, dir: f.directionDeg ?? 0 };
  }

  const rtDirStats = computeDirStats(rtSpeeds, rtDirs);
  const gustAvg = rtGusts.length ? rtGusts.reduce((a, b) => a + b, 0) / rtGusts.length : 0;
  const tiAvg = tiVals.length ? tiVals.reduce((a, b) => a + b, 0) / tiVals.length : 0;
  const hSpan = lowest && highest ? Math.max(1, highest.h - lowest.h) : 1;
  const shearSlope = lowest && highest ? (highest.v - lowest.v) / hSpan : 0;
  const shearPer100m = shearSlope * 100;
  const veerDeg = lowest && highest ? Math.abs(((highest.dir - lowest.dir + 540) % 360) - 180) : 0;

  const currentUnix = times.length ? times[0] : 0;
  const windowSec = 600;
  const minTime = currentUnix - windowSec;

  const avgSpeeds: number[] = [];
  const avgDirs: number[] = [];
  const avgTIs: number[] = [];
  let top: { h: number; v: number; dir: number } | null = null;
  let bot: { h: number; v: number; dir: number } | null = null;

  for (const h of heights) {
    const arr = framesByHeight[h] || [];
    if (!arr.length) continue;
    const inWindow = arr.filter(
      (f) => typeof f.time === 'number' && (f.time as number) >= minTime && (f.time as number) <= currentUnix
    );
    if (!inWindow.length) continue;
    const sp = inWindow.map((f) => f.horizSpeedMean ?? 0);
    const dr = inWindow.map((f) => f.directionDeg ?? 0);
    const ti = inWindow.map((f) => f.turbulenceIntensity ?? 0);
    const vAvg = sp.reduce((a, b) => a + b, 0) / sp.length;
    const dAvg = circularMeanDeg(dr);
    avgSpeeds.push(vAvg);
    avgDirs.push(dAvg);
    if (ti.length) avgTIs.push(ti.reduce((a, b) => a + b, 0) / ti.length);
    if (bot === null || h < bot.h) bot = { h, v: vAvg, dir: dAvg };
    if (top === null || h > top.h) top = { h, v: vAvg, dir: dAvg };
  }

  const avgDirStats = computeDirStats(avgSpeeds, avgDirs);
  const tiAvg10 = avgTIs.length ? avgTIs.reduce((a, b) => a + b, 0) / avgTIs.length : 0;
  const hSpan10 = bot && top ? Math.max(1, top.h - bot.h) : 1;
  const shearPer100m10 = bot && top ? ((top.v - bot.v) / hSpan10) * 100 : 0;
  const veerDeg10 = bot && top ? Math.abs(((top.dir - bot.dir + 540) % 360) - 180) : 0;

  const rho = 1.225;
  const v3Mean = avgSpeeds.length ? avgSpeeds.reduce((a, b) => a + Math.pow(b, 3), 0) / avgSpeeds.length : 0;
  const wpd = 0.5 * rho * v3Mean;

  const stability = ((): 'Stable' | 'Neutral' | 'Unstable' => {
    if (tiAvg10 > 0.15 && shearPer100m10 < 0.8) return 'Unstable';
    if (shearPer100m10 > 1.5 && tiAvg10 < 0.1) return 'Stable';
    return 'Neutral';
  })();

  return {
    realtime: {
      speed: rtDirStats.meanSpeed,
      dir: rtDirStats.meanDirDeg,
      gust: gustAvg,
      shearPer100m,
      veerDeg,
      ti: tiAvg,
    },
    avg10: {
      speed: avgDirStats.meanSpeed,
      dir: avgDirStats.meanDirDeg,
      shearPer100m: shearPer100m10,
      veerDeg: veerDeg10,
      turbulence: tiAvg10,
      wpd,
      stability,
    },
  };
}


