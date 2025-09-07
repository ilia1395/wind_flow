
import React, { useEffect, useMemo } from 'react';
import { PlaybackControlsView } from '../ui/PlaybackControlsView';
import { usePlaybackStore } from './playbackStore';
import { useWindStore, type WindFrame } from '@/entities/WindData';

export const PlaybackControls: React.FC = () => {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const toggleIsPlaying = usePlaybackStore((s) => s.toggleIsPlaying);
  const setPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);
  const stopPlayback = usePlaybackStore((s) => s.stop);
  const startLoop = usePlaybackStore((s) => s.startLoop);
  const stopLoop = usePlaybackStore((s) => s.stopLoop);
  const seekToIndex = usePlaybackStore((s) => s.seekToIndex);
  const stepPrev = usePlaybackStore((s) => s.stepPrev);
  const stepNext = usePlaybackStore((s) => s.stepNext);

  const frameIndex = useWindStore((s) => s.frameIndex);
  const storeIntensities = useWindStore((s) => s.timelineIntensities);
  const storeSpeeds = useWindStore((s) => s.timelineSpeeds);
  const timelineLength = useWindStore((s) => s.getTimelineInfo().length);
  const currentFrame = useWindStore((s) => s.getCurrentFrame());
  const intensities = useMemo(() => storeIntensities, [storeIntensities]);

  const displayTimeLabel = useMemo(() => {
    const raw = (currentFrame as WindFrame)?.timeString as string | undefined;
    if (raw && raw.trim()) return raw;
    const sec = (currentFrame as WindFrame)?.time;
    return new Date(sec * 1000).toLocaleString();
  }, [currentFrame]);

  useEffect(() => {
    startLoop();
    return () => { stopLoop(); };
  }, [startLoop, stopLoop]);

  // keyboard shortcuts: Left/Right, Shift modifies sensitivity (fine steps)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          stepPrev({ fine: e.shiftKey });
          e.preventDefault();
          break;
        case 'ArrowRight':
          stepNext({ fine: e.shiftKey });
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepPrev, stepNext, toggleIsPlaying]);

  return (
    <PlaybackControlsView
      isPlaying={isPlaying}
      onTogglePlay={toggleIsPlaying}
      onStop={() => { stopPlayback(); }}
      playbackRate={playbackRate}
      onPlaybackRateChange={setPlaybackRate}
      frameIndex={frameIndex}
      onFrameIndexChange={seekToIndex}
      timelineLength={timelineLength}
      displayTimeLabel={displayTimeLabel}
      intensities={intensities}
      speeds={storeSpeeds}
    />
  );
};
