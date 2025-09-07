import { useMemo } from 'react';
import { useWindStore } from '@/entities/WindData';
import type { WindFrame } from '@/entities/WindData';
import { computeWindRose, periodToSeconds, type WindRoseData, type WindRosePeriod } from '../lib/windRose';

export function useWindRoseModel(period: WindRosePeriod, selectedHeight?: number | 'combined'): WindRoseData {
  const framesByHeight = useWindStore((s) => s.framesByHeight);
  const heights = useWindStore((s) => s.heightOrder);
  const frameIndex = useWindStore((s) => s.frameIndex);

  const representativeHeight = useMemo(() => {
    let maxLen = 0;
    let rep = heights[0];
    for (const h of heights) {
      const len = (framesByHeight[h] || []).length;
      if (len > maxLen) {
        maxLen = len;
        rep = h;
      }
    }
    return rep;
  }, [framesByHeight, heights]);

  const currentTime = useMemo(() => {
    const arr = framesByHeight[representativeHeight] || [];
    const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, arr.length - 1));
    return arr[idx]?.time ?? 0;
  }, [framesByHeight, representativeHeight, frameIndex]);

  return useMemo(() => {
    const periodSec = periodToSeconds(period);
    let arr: WindFrame[] | undefined;
    if (selectedHeight === 'combined') {
      const tMin = currentTime - periodSec;
      const acc = new Map<number, { sumV: number; sumCos: number; sumSin: number; n: number }>();
      for (const h of heights) {
        const frames = framesByHeight[h] || [];
        if (!frames.length) continue;
        // frames are chronological; walk backward within window for efficiency
        for (let i = frames.length - 1; i >= 0; i -= 1) {
          const f = frames[i];
          const t = typeof f.time === 'number' ? f.time : 0;
          if (t < tMin) break;
          if (t > currentTime) continue;
          const v = Number(f.horizSpeedMean ?? 0);
          const dir = Number(f.directionDeg ?? 0);
          const rad = (dir * Math.PI) / 180;
          const item = acc.get(t) || { sumV: 0, sumCos: 0, sumSin: 0, n: 0 };
          item.sumV += v;
          item.sumCos += Math.cos(rad);
          item.sumSin += Math.sin(rad);
          item.n += 1;
          acc.set(t, item);
        }
      }
      const aggregated: WindFrame[] = [];
      acc.forEach((val, t) => {
        if (val.n <= 0) return;
        const meanV = val.sumV / val.n;
        const meanRad = Math.atan2(val.sumSin / val.n, val.sumCos / val.n);
        const meanDeg = ((meanRad * 180) / Math.PI + 360) % 360;
        aggregated.push({
          time: t,
          directionDeg: meanDeg,
          horizSpeedMean: meanV,
          horizSpeedStd: 0,
          vertSpeedMean: 0,
          vertSpeedStd: 0,
        });
      });
      aggregated.sort((a, b) => a.time - b.time);
      arr = aggregated;
    } else {
      const height = selectedHeight ?? representativeHeight;
      arr = framesByHeight[height] || [];
    }
    return computeWindRose(arr, currentTime, {
      periodSec,
      sectorCount: 16,
      angleOffsetDeg: 90,
    });
  }, [framesByHeight, heights, selectedHeight, representativeHeight, currentTime, period]);
}


