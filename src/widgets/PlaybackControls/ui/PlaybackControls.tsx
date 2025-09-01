
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

  const timelineLength = useMemo(() => {
    let maxLen = 0;
    for (const h of heightOrder) {
      const len = (framesByHeight[h] || []).length;
      if (len > maxLen) maxLen = len;
    }
    return maxLen;
  }, [framesByHeight, heightOrder]);

  const currentFrame = useMemo(() => {
    if (!heightOrder.length) return undefined;
    const repHeight = (() => {
      let maxLen = 0;
      let rep = heightOrder[0];
      for (const h of heightOrder) {
        const len = (framesByHeight[h] || []).length;
        if (len > maxLen) { maxLen = len; rep = h; }
      }
      return rep;
    })();
    const arr = framesByHeight[repHeight] || [];
    const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, arr.length - 1));
    return arr[idx];
  }, [framesByHeight, heightOrder, frameIndex]);

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

  useEffect(() => {
    const loop = () => {
      const now = performance.now();
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (isPlaying && timelineLength > 0) {
        const framesPerSecond = 2 * playbackRate;
        setFrameIndex((frameIndex + dt * framesPerSecond) % timelineLength);
        advanceTimeBy(dt * playbackRate);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, playbackRate, frameIndex, setFrameIndex, timelineLength, advanceTimeBy]);

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
    />
  );
};
