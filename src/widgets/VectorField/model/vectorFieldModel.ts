import { useMemo } from 'react';
import { useWindStore, type WindFrame } from '@/entities/WindData';
import { createLayeredFieldSampler } from '@/entities/FieldSampler';

export function useVectorFieldModel() {
  const framesByHeight = useWindStore((s) => s.framesByHeight);
  const heights = useWindStore((s) => s.heightOrder);
  const frameIndex = useWindStore((s) => s.frameIndex);
  const status = useWindStore((s) => s.status);

  const fieldSampler = useMemo(() => {
    if (!heights || heights.length === 0) return undefined;
    return createLayeredFieldSampler(framesByHeight, heights, frameIndex);
  }, [framesByHeight, heights, frameIndex]);

  const heightSlices = heights;

  const statusText = useMemo(() => {
    if (status !== 'ready') return status;
    if (!heights?.length) return undefined;

    let timelineLength = 0;
    for (const h of heights) {
      const len = (framesByHeight[h] || []).length;
      if (len > timelineLength) timelineLength = len;
    }
    const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineLength - 1));

    let meanHS = 0;
    let meanGustRatio = 0;
    let count = 0;
    for (const h of heights) {
      const arr = framesByHeight[h] || [];
      if (!arr.length) continue;
      const f = arr[Math.min(idx, arr.length - 1)] as WindFrame | undefined;
      if (!f) continue;
      const hs = f.horizSpeedMean ?? 0;
      const max = f.horizSpeedMax ?? hs;
      const gr = hs > 0 ? Math.max(0, (max - hs) / hs) : 0;
      meanHS += hs;
      meanGustRatio += gr;
      count += 1;
    }
    if (count === 0) return undefined;
    meanHS /= count;
    meanGustRatio /= count;
    let gustLabel = 'NO GUSTS';
    if (meanGustRatio >= 0.35) gustLabel = 'HIGH GUSTS';
    else if (meanGustRatio >= 0.1) gustLabel = 'MEDIUM GUSTS';
    const danger = meanHS > 10;
    const dangerLabel = danger ? ' — DANGEROUS WIND (>10 m/s)' : '';
    return `Wind speed: ${meanHS.toFixed(1)} (m/s) — ${gustLabel}${dangerLabel}`;
  }, [status, heights, framesByHeight, frameIndex]);

  return { fieldSampler, heightSlices, statusText };
}


