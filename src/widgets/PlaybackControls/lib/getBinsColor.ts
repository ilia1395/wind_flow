import { WIND_SPEED_PALETTE, DEFAULT_SPEED_BINS } from '@/shared/constants/windPalette';

function speedToBin(speed: number, binEdges: number[] = DEFAULT_SPEED_BINS): number {
  if (!Number.isFinite(speed)) return 0;
  let bin = binEdges.length - 1;
  for (let i = 0; i < binEdges.length - 1; i += 1) {
    if (speed >= binEdges[i] && speed < binEdges[i + 1]) { bin = i; break; }
  }
  return bin;
}

export function getBarColor(speed: number): string {
  const bin = speedToBin(speed, DEFAULT_SPEED_BINS);
  return WIND_SPEED_PALETTE[Math.min(bin, WIND_SPEED_PALETTE.length - 1)];
}