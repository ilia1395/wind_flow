import React, { useMemo, useState } from 'react';
import { useWindStore } from '@entities/WindData';

type Mode = 'realtime' | 'avg10min';

type DirStats = {
  meanSpeed: number;
  meanDirDeg: number;
};

function circularMeanDeg(values: number[]): number {
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

function computeDirStats(speeds: number[], dirs: number[]): DirStats {
  const meanSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const meanDirDeg = circularMeanDeg(dirs);
  return { meanSpeed, meanDirDeg };
}

function formatDeg(deg: number): string {
  const d = Math.round(((deg % 360) + 360) % 360);
  return `${d}°`;
}

export const WindDataPanel: React.FC = () => {
  const framesByHeight = useWindStore((s) => s.framesByHeight);
  const heights = useWindStore((s) => s.heightOrder);
  const frameIndex = useWindStore((s) => s.frameIndex);

  const [mode, setMode] = useState<Mode>('realtime');

  const { realtime, avg10 } = useMemo(() => {
    // clamp index per representative length per height
    let maxLen = 0;
    for (const h of heights) {
      const len = (framesByHeight[h] || []).length;
      if (len > maxLen) maxLen = len;
    }
    const idxGlobal = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, maxLen - 1));

    // current snapshot across heights
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
    const shearSlope = lowest && highest ? (highest.v - lowest.v) / hSpan : 0; // m/s per m
    const shearPer100m = shearSlope * 100;
    const veerDeg = lowest && highest ? Math.abs(((highest.dir - lowest.dir + 540) % 360) - 180) : 0;

    // compute 10-minute window based on current time
    const currentUnix = times.length ? times[0] : 0;
    const windowSec = 600; // 10 minutes
    const minTime = currentUnix - windowSec;

    const avgSpeeds: number[] = [];
    const avgDirs: number[] = [];
    const avgTIs: number[] = [];
    let top: { h: number; v: number; dir: number } | null = null;
    let bot: { h: number; v: number; dir: number } | null = null;

    for (const h of heights) {
      const arr = framesByHeight[h] || [];
      if (!arr.length) continue;
      const inWindow = arr.filter((f) => typeof f.time === 'number' && (f.time as number) >= minTime && (f.time as number) <= currentUnix);
      if (!inWindow.length) continue;
      const sp = inWindow.map((f) => f.horizSpeedMean ?? 0);
      const dr = inWindow.map((f) => f.directionDeg ?? 0);
      const ti = inWindow.map((f) => f.turbulenceIntensity ?? 0);
      const vAvg = sp.reduce((a, b) => a + b, 0) / sp.length;
      const dAvg = circularMeanDeg(dr);
      avgSpeeds.push(vAvg);
      avgDirs.push(dAvg);
      if (ti.length) avgTIs.push(ti.reduce((a, b) => a + b, 0) / ti.length);
      // track top and bottom using averaged values
      if (bot === null || h < bot.h) bot = { h, v: vAvg, dir: dAvg };
      if (top === null || h > top.h) top = { h, v: vAvg, dir: dAvg };
    }

    const avgDirStats = computeDirStats(avgSpeeds, avgDirs);
    const tiAvg10 = avgTIs.length ? avgTIs.reduce((a, b) => a + b, 0) / avgTIs.length : 0;
    const hSpan10 = bot && top ? Math.max(1, top.h - bot.h) : 1;
    const shearPer100m10 = bot && top ? ((top.v - bot.v) / hSpan10) * 100 : 0;
    const veerDeg10 = bot && top ? Math.abs(((top.dir - bot.dir + 540) % 360) - 180) : 0;

    // WPD (Wind Power Density): 0.5 * rho * V^3
    const rho = 1.225;
    const v3Mean = avgSpeeds.length ? avgSpeeds.reduce((a, b) => a + Math.pow(b, 3), 0) / avgSpeeds.length : 0;
    const wpd = 0.5 * rho * v3Mean; // W/m^2

    // Simple stability heuristic
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
  }, [framesByHeight, heights, frameIndex]);

  const rt = realtime;
  const av = avg10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, color: 'white', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setMode('realtime')}
          style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: mode === 'realtime' ? '#3c2741' : '#222', color: 'white' }}
        >
          Real-Time
        </button>
        <button
          onClick={() => setMode('avg10min')}
          style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: mode === 'avg10min' ? '#3c2741' : '#222', color: 'white' }}
        >
          10-Min Avg
        </button>
      </div>

      {mode === 'realtime' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Metric label="Current Speed" value={`${rt.speed.toFixed(1)} m/s`} />
          <Metric label="Direction" value={formatDeg(rt.dir)} />
          <Metric label="Gusts" value={`${rt.gust.toFixed(1)} m/s`} />
          <Metric label="Shear" value={`${rt.shearPer100m.toFixed(2)} m/s per 100 m`} />
          <Metric label="Veer" value={`${rt.veerDeg.toFixed(0)}°`} />
          <Metric label="Turbulence (TI)" value={`${(rt.ti * 100).toFixed(1)}%`} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Metric label="Mean Speed" value={`${av.speed.toFixed(1)} m/s`} />
          <Metric label="Mean Direction" value={formatDeg(av.dir)} />
          <Metric label="Avg Shear" value={`${av.shearPer100m.toFixed(2)} m/s per 100 m`} />
          <Metric label="Avg Veer" value={`${av.veerDeg.toFixed(0)}°`} />
          <Metric label="Turbulence (TI)" value={`${(av.turbulence * 100).toFixed(1)}%`} />
          <Metric label="Wind Power Density" value={`${av.wpd.toFixed(0)} W/m²`} />
          <Metric label="Stability" value={av.stability} />
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 10px' }}>
    <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
  </div>
);


