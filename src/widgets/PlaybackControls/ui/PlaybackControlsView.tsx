
import React, { useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { WIND_SPEED_PALETTE, DEFAULT_SPEED_BINS } from '@/shared/constants/windPalette';

function speedToBin(speed: number, binEdges: number[] = DEFAULT_SPEED_BINS): number {
  if (!Number.isFinite(speed)) return 0;
  let b = binEdges.length - 1;
  for (let i = 0; i < binEdges.length - 1; i += 1) {
    if (speed >= binEdges[i] && speed < binEdges[i + 1]) { b = i; break; }
  }
  return b;
}

function getBarColor(speed: number): string {
  const bin = speedToBin(speed, DEFAULT_SPEED_BINS);
  return WIND_SPEED_PALETTE[Math.min(bin, WIND_SPEED_PALETTE.length - 1)];
}

type PlaybackControlsViewProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  frameIndex: number;
  onFrameIndexChange: (index: number) => void;
  onScrubStartFine?: () => void;
  onScrubEndFine?: () => void;
  onScrubIndex?: (index: number) => void;
  timelineLength: number;
  displayTimeLabel?: string;
  intensities?: number[];
  speeds?: number[];
  // removed min/max band rendering; keep props out
};

export const PlaybackControlsView: React.FC<PlaybackControlsViewProps> = ({
  isPlaying,
  onTogglePlay,
  onStop,
  playbackRate,
  onPlaybackRateChange,
  frameIndex,
  onFrameIndexChange,
  onScrubStartFine,
  onScrubEndFine,
  onScrubIndex,
  timelineLength,
  displayTimeLabel,
  intensities = [],
  speeds = [],
}) => {
  const clampedIndex = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineLength - 1));
  const CHART_WIDTH = 400;
  const CHART_HEIGHT = 80;
  const barCount = Math.max(1, intensities.length);
  const barWidth = CHART_WIDTH / barCount;
  const selectedBarIndex = Math.min(barCount - 1, Math.max(0, Math.floor((clampedIndex / Math.max(1, timelineLength - 1)) * barCount)));
  const rangeRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = rangeRef.current;
    if (!el) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 && e.shiftKey) {
        onScrubStartFine && onScrubStartFine();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 0) {
        onScrubEndFine && onScrubEndFine();
      }
    };
    const onInput = () => {
      const v = Number(el.value);
      if (onScrubIndex) onScrubIndex(v);
    };
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('input', onInput);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('input', onInput);
    };
  }, [onScrubStartFine, onScrubEndFine, onScrubIndex]);
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border bg-card/60 p-2 text-card-foreground backdrop-blur">
      <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
        <svg
          className="absolute inset-0"
          width="100%"
          height="100%"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
        >
          {/* Simplified: only average bars */}
          {intensities.map((t, i) => {
            const h = Math.max(2, t * CHART_HEIGHT);
            const y = CHART_HEIGHT - h;
            const x = i * barWidth;
            const isFuture = i > selectedBarIndex;
            const color = getBarColor(speeds[i] ?? 0);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={Math.max(1, barWidth - 0.5)}
                height={h}
                fill={color}
                fillOpacity={isFuture ? 0.25 : 1}
              />
            );
          })}
        </svg>
        <input
          ref={rangeRef}
          aria-label="Timeline"
          type="range"
          min={0}
          max={Math.max(0, timelineLength - 1)}
          step={1}
          value={clampedIndex}
          onChange={(e) => onFrameIndexChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{displayTimeLabel}</span>
        <div className="flex items-center gap-2">
          <Button variant={isPlaying ? 'secondary' : 'default'} size="sm" onClick={onTogglePlay}>
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button variant="outline" size="sm" onClick={onStop}>Stop</Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Rate
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={playbackRate}
              onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={16}>16x</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
};


