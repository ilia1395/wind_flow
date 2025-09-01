
import React from 'react';
import { Button } from '@/shared/components/ui/button';

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
}) => {
  const clampedIndex = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineLength - 1));

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border bg-card/60 p-2 text-card-foreground backdrop-blur">
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
      <div className="flex w-full items-center">
        <input
          type="range"
          min={0}
          max={Math.max(0, timelineLength - 1)}
          step={1}
          value={clampedIndex}
          onChange={(e) => onFrameIndexChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
    </div>
  );
};


