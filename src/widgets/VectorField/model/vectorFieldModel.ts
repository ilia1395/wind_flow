import { useMemo } from 'react';
import { useWindStore } from '@entities/WindData';
import { createLayeredFieldSampler } from '@entities/FieldSampler';

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
  const statusText = status === 'ready' ? undefined : status;

  return { fieldSampler, heightSlices, statusText };
}


