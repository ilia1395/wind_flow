
import React, { useEffect, useState } from 'react';

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

const PlaybackControlsView: React.FC<PlaybackControlsViewProps> = ({
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
    <div
      style={{
        background: 'rgba(0,0,0,0.35)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        color: 'white',
        gap: '8px',
        pointerEvents: 'auto',
        padding: '8px',
      }}
    >
      <button onClick={onTogglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={onStop}>Stop</button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Playback
        <select value={playbackRate} onChange={(e) => onPlaybackRateChange(Number(e.target.value))}>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={16}>16x</option>
          <option value={256}>256x</option>
        </select>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4} }>
        <span style={{ minWidth: '130px', textAlign: 'right' }}>{displayTimeLabel}</span>
        <input
            type="range"
            min={0}
            max={Math.max(0, timelineLength - 1)}
            step={1}
            value={clampedIndex}
            onChange={(e) => onFrameIndexChange(Number(e.target.value))}
            style={{ minWidth: '230px'}}
        />
      </div>
      
    </div>
  );
};

type PlaybackControlsProps = {
  timelineLength: number;
  displayTimeLabel?: string;
  initialPlaybackRate?: number;
  // Notify parent about state changes
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
