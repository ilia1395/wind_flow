import { useWindStore } from '@/entities/WindData';
import { useMemo } from 'react';
import { computeWindMetrics, type WindMetrics } from '../lib/metrics';

export function useWindDataPanelMetrics(): WindMetrics {
  const framesByHeight = useWindStore((s) => s.framesByHeight);
  const heights = useWindStore((s) => s.heightOrder);
  const frameIndex = useWindStore((s) => s.frameIndex);

  return useMemo(() => computeWindMetrics(framesByHeight, heights, frameIndex), [framesByHeight, heights, frameIndex]);
}


