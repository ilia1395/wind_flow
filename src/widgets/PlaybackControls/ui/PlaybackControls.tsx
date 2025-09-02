
import React, { useEffect, useMemo, useRef } from 'react';
import { PlaybackControlsView } from './PlaybackControlsView';
import { usePlaybackStore } from '@/features/Playback';
import { useWindStore } from '@/entities/WindData';

// Intentionally no props; this is a widget-level controller that connects stores to the presentational view.

export const PlaybackControls: React.FC = () => {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const toggleIsPlaying = usePlaybackStore((s) => s.toggleIsPlaying);
  const setPlaybackRate = usePlaybackStore((s) => s.setPlaybackRate);
  const resetTime = usePlaybackStore((s) => s.resetTime);
  const advanceTimeBy = usePlaybackStore((s) => s.advanceTimeBy);

  const frameIndex = useWindStore((s) => s.frameIndex);
  const setFrameIndex = useWindStore((s) => s.setFrameIndex);
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

  const rafRef = useRef(0);
  const lastRef = useRef(performance.now());
  const isPlayingRef = useRef(isPlaying);
  const playbackRateRef = useRef(playbackRate);
  const timelineLengthRef = useRef(timelineLength);
  const frameIndexRef = useRef(frameIndex);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => { timelineLengthRef.current = timelineLength; }, [timelineLength]);
  useEffect(() => { frameIndexRef.current = frameIndex; }, [frameIndex]);

  useEffect(() => {
    const loop = () => {
      const now = performance.now();
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const playing = isPlayingRef.current;
      const len = timelineLengthRef.current;
      const rate = playbackRateRef.current;
      if (playing && len > 0) {
        const framesPerSecond = 2 * rate;
        const nextIdx = (frameIndexRef.current + dt * framesPerSecond) % len;
        frameIndexRef.current = nextIdx;
        setFrameIndex(nextIdx);
        advanceTimeBy(dt * rate);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [setFrameIndex, advanceTimeBy]);

  return (
    <PlaybackControlsView
      isPlaying={isPlaying}
      onTogglePlay={toggleIsPlaying}
      onStop={() => { setIsPlaying(false); setFrameIndex(0); resetTime(); }}
      playbackRate={playbackRate}
      onPlaybackRateChange={setPlaybackRate}
      frameIndex={frameIndex}
      onFrameIndexChange={setFrameIndex}
      timelineLength={timelineLength}
      displayTimeLabel={displayTimeLabel}
      intensities={intensities}
      speeds={storeSpeeds}
    />
  );
};
