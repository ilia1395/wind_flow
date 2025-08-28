
import React from 'react';

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
          <option value={16}>16x</option>
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
            style={{ minWidth: '1200px'}}
        />
      </div>
      
    </div>
  );
};


