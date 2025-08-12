import React, { useEffect, useState } from 'react';
import { PlaybackControlsView } from './PlaybackControlsView';

type PlaybackControlsProps = {
  timelineLength: number;
  displayTimeLabel?: string;
  initialPlaybackRate?: number;
  // Notify parent about state if needed
  onFrameIndexChange?: (index: number) => void;
  onIsPlayingChange?: (isPlaying: boolean) => void;
  onPlaybackRateChange?: (rate: number) => void;
};

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  timelineLength,
  displayTimeLabel,
  initialPlaybackRate = 1,
  onFrameIndexChange,
  onIsPlayingChange,
  onPlaybackRateChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (isPlaying && timelineLength > 0) {
        const framesPerSecond = 2 * playbackRate;
        setFrameIndex((i) => (i + dt * framesPerSecond) % timelineLength);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, timelineLength, playbackRate]);

  useEffect(() => {
    onFrameIndexChange?.(Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineLength - 1)));
  }, [frameIndex, timelineLength, onFrameIndexChange]);

  useEffect(() => {
    onIsPlayingChange?.(isPlaying);
  }, [isPlaying, onIsPlayingChange]);

  useEffect(() => {
    onPlaybackRateChange?.(playbackRate);
  }, [playbackRate, onPlaybackRateChange]);

  return (
    <PlaybackControlsView
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStop={() => { setIsPlaying(false); setFrameIndex(0); }}
      playbackRate={playbackRate}
      onPlaybackRateChange={setPlaybackRate}
      frameIndex={frameIndex}
      onFrameIndexChange={setFrameIndex}
      timelineLength={timelineLength}
      displayTimeLabel={displayTimeLabel}
    />
  );
};


