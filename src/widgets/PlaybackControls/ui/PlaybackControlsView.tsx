
import React from 'react';
import { Button } from '@/shared/components/ui/button';

const WINDROSE_PALETTE = [
  '#3b0a9e','#2843d8','#2aa5f9','#2ad4f9','#2af9d2','#2df97a','#6bf92a','#a4f92a','#d6f92a',
  '#f5e62a','#f9c02a','#f9982a','#f96d2a','#f93f2a','#ed2323','#c4161a','#7a0f0f','#4d0b0b'
];
const DEFAULT_SPEED_BINS = [0,5,10,15,20,25];

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0 };
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function speedToBin(speed: number, binEdges: number[] = DEFAULT_SPEED_BINS): number {
  if (!Number.isFinite(speed)) return 0;
  let b = binEdges.length - 1;
  for (let i = 0; i < binEdges.length - 1; i += 1) {
    if (speed >= binEdges[i] && speed < binEdges[i + 1]) { b = i; break; }
  }
  return b;
}

function getBarColor(speed: number, isSelected: boolean, isFuture: boolean): string {
  const bin = speedToBin(speed, DEFAULT_SPEED_BINS);
  const hex = WINDROSE_PALETTE[Math.min(bin, WINDROSE_PALETTE.length - 1)];
  const { h, s, l } = hexToHsl(hex);
  const sat = isFuture ? 0 : s; // future bars desaturated; current keeps original saturation
  return `hsl(${h} ${sat}% ${l}%)`;
}

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
          {intensities.map((t, i) => {
            const h = Math.max(2, t * CHART_HEIGHT);
            const y = CHART_HEIGHT - h;
            const x = i * barWidth;
            const isSelected = i === selectedBarIndex;
            const isFuture = i > selectedBarIndex;
            const color = getBarColor(speeds[i] ?? 0, isSelected, isFuture);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={Math.max(1, barWidth - 0.5)}
                height={h}
                fill={color}
              />
            );
          })}
          <line
            x1={selectedBarIndex * barWidth + barWidth / 2}
            x2={selectedBarIndex * barWidth + barWidth / 2}
            y1={0}
            y2={CHART_HEIGHT}
            stroke={'hsl(var(--primary))'}
            strokeWidth={2}
            opacity={0.9}
          />
        </svg>
        <input
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


