
import React, { useEffect, useMemo } from 'react';
import { PlaybackControlsView } from './PlaybackControlsView';
import { usePlaybackStore } from '@/features/Playback';
import { useWindStore } from '@/entities/WindData';

// Intentionally no props; this is a widget-level controller that connects stores to the presentational view.

export const PlaybackControls: React.FC = () => {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  // const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const toggleIsPlaying = usePlaybackStore((s) => s.toggleIsPlaying);
  const setPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);
  const stopPlayback = usePlaybackStore((s) => s.stop);
  const startLoop = usePlaybackStore((s) => s.startLoop);
  const stopLoop = usePlaybackStore((s) => s.stopLoop);
  const seekToIndex = usePlaybackStore((s) => s.seekToIndex);
  const stepPrev = usePlaybackStore((s) => s.stepPrev);
  const stepNext = usePlaybackStore((s) => s.stepNext);
  const setFineMouseScrub = usePlaybackStore((s) => s.setFineMouseScrub);
  const scrubToIndex = usePlaybackStore((s) => s.scrubToIndex);

  const frameIndex = useWindStore((s) => s.frameIndex);
  // const setFrameIndex = useWindStore((s) => s.setFrameIndex);
  const framesByHeight = useWindStore((s) => s.framesByHeight);
  const heightOrder = useWindStore((s) => s.heightOrder);
  const storeRepHeight = useWindStore((s) => s.repHeight);
  const storeIntensities = useWindStore((s) => s.timelineIntensities);
  const storeSpeeds = useWindStore((s) => s.timelineSpeeds);

  const timelineLength = useMemo(() => {
    let maxLen = 0;
    for (const h of heightOrder) {
      const len = (framesByHeight[h] || []).length;
      if (len > maxLen) maxLen = len;
    }
    return maxLen;
  }, [framesByHeight, heightOrder]);

  const representativeHeight = useMemo(() => storeRepHeight, [storeRepHeight]);
  const intensities = useMemo(() => storeIntensities, [storeIntensities]);

  const currentFrame = useMemo(() => {
    if (!representativeHeight) return undefined;
    const arr = framesByHeight[representativeHeight] || [];
    const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, arr.length - 1));
    return arr[idx];
  }, [framesByHeight, representativeHeight, frameIndex]);

  const displayTimeLabel = useMemo(() => {
    const raw = (currentFrame as any)?.timeString as string | undefined;
    if (raw && raw.trim()) return raw;
    const sec = (currentFrame as any)?.time as number | undefined;
    if (typeof sec === 'number') {
      try { return new Date(sec * 1000).toLocaleString(); } catch { /* noop */ }
    }
    return undefined;
  }, [currentFrame]);

  useEffect(() => {
    startLoop();
    return () => { stopLoop(); };
  }, [startLoop, stopLoop]);

  // keyboard shortcuts: Left/Right, Shift modifies sensitivity (fine steps)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        stepPrev({ fine: e.shiftKey });
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        stepNext({ fine: e.shiftKey });
        e.preventDefault();
      } else if (e.key === ' ') {
        toggleIsPlaying();
        e.preventDefault();
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
      onScrubStartFine={() => setFineMouseScrub(true)}
      onScrubEndFine={() => setFineMouseScrub(false)}
      onScrubIndex={(i) => scrubToIndex(i)}
      timelineLength={timelineLength}
      displayTimeLabel={displayTimeLabel}
      intensities={intensities}
      speeds={storeSpeeds}
    />
  );
};
