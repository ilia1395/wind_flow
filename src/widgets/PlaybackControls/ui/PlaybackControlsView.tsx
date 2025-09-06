
import React, { useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { getBarColor } from '../lib/getBinsColor';

type PlaybackControlsViewProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  frameIndex: number;
  onFrameIndexChange: (index: number) => void;
  timelineLength: number;
  displayTimeLabel?: string;
  intensities?: number[];
  speeds?: number[];
};

export const PlaybackControlsView: React.FC<PlaybackControlsViewProps> = ({
  isPlaying,
  onTogglePlay,
  onStop,
  playbackRate,
  onPlaybackRateChange,
  frameIndex,
  onFrameIndexChange,
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


