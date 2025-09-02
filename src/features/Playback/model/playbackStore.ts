import { create } from 'zustand';
import { useWindStore } from '@/entities/WindData';

interface PlaybackState {
  isPlaying: boolean;
  playbackRate: number; // 1 = normal speed
  timeSeconds: number;  // accumulated time for simulation
  frameStepCoarse: number; // frames per step when skipping
  frameStepFine: number;   // frames per step with Shift
  isFineMouseScrub: boolean; // shift + left mouse held
  scrubFineFactor: number;   // scale delta when fine scrubbing (0..1)

  setIsPlaying: (isPlaying: boolean) => void;
  toggleIsPlaying: () => void;
  setPlaybackRate: (rate: number) => void;
  resetTime: () => void;
  advanceTimeBy: (dt: number) => void;
  setFineMouseScrub: (isFine: boolean) => void;

  // Timeline control delegated to this store
  stop: () => void; // pause and reset timeline/time
  seekToIndex: (idx: number) => void;
  seekByFrames: (delta: number) => void;
  scrubToIndex: (idx: number) => void;
  stepPrev: (opts?: { fine?: boolean }) => void;
  stepNext: (opts?: { fine?: boolean }) => void;

  // Internal RAF loop controller
  startLoop: () => void;
  stopLoop: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: true,
  playbackRate: 1,
  timeSeconds: 0,
  frameStepCoarse: 5,
  frameStepFine: 1,
  isFineMouseScrub: false,
  scrubFineFactor: 0.25,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleIsPlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaybackRate: (rate) => set({ playbackRate: Math.max(0.0001, rate) }),
  resetTime: () => set({ timeSeconds: 0 }),
  advanceTimeBy: (dt) => set((s) => ({ timeSeconds: s.timeSeconds + Math.max(0, dt) })),
  setFineMouseScrub: (isFine) => set({ isFineMouseScrub: !!isFine }),

  stop: () => {
    const { setIsPlaying, resetTime } = get();
    setIsPlaying(false);
    const { setFrameIndex } = useWindStore.getState();
    setFrameIndex(0);
    resetTime();
  },

  seekToIndex: (idx: number) => {
    const { getTimelineInfo, setFrameIndex } = useWindStore.getState();
    const { length } = getTimelineInfo();
    const clamped = Math.min(Math.max(Math.floor(idx), 0), Math.max(0, length - 1));
    setFrameIndex(clamped);
  },

  seekByFrames: (delta: number) => {
    const { frameIndex, getTimelineInfo, setFrameIndex } = useWindStore.getState();
    const { length } = getTimelineInfo();
    if (length <= 0) return;
    let next = frameIndex + delta;
    // wrap-around like playback
    while (next < 0) next += length;
    while (next >= length) next -= length;
    setFrameIndex(next);
  },

  scrubToIndex: (idx: number) => {
    const { getTimelineInfo, frameIndex, setFrameIndex } = useWindStore.getState();
    const { isFineMouseScrub, scrubFineFactor } = get();
    const { length } = getTimelineInfo();
    if (length <= 0) return;
    const target = Math.min(Math.max(Math.floor(idx), 0), Math.max(0, length - 1));
    if (!isFineMouseScrub) {
      setFrameIndex(target);
      return;
    }
    // Fine mode: move fractionally toward the target by scaled delta
    const current = Math.floor(frameIndex);
    let delta = target - current;
    if (delta === 0) return;
    // Choose shortest direction without wrap for predictability while scrubbing
    const step = Math.sign(delta) * Math.max(1, Math.floor(Math.abs(delta) * scrubFineFactor));
    let next = current + step;
    next = Math.min(Math.max(next, 0), Math.max(0, length - 1));
    setFrameIndex(next);
  },

  stepPrev: (opts) => {
    const { frameStepCoarse, frameStepFine, seekByFrames } = get();
    const step = opts?.fine ? frameStepFine : frameStepCoarse;
    seekByFrames(-step);
  },

  stepNext: (opts) => {
    const { frameStepCoarse, frameStepFine, seekByFrames } = get();
    const step = opts?.fine ? frameStepFine : frameStepCoarse;
    seekByFrames(step);
  },

  startLoop: () => {
    const state = get() as any;
    if (state._rafId) return;
    state._lastNow = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - (state._lastNow || now)) / 1000;
      state._lastNow = now;
      const { isPlaying, playbackRate, advanceTimeBy } = get();
      const { getTimelineInfo, frameIndex, setFrameIndex } = useWindStore.getState();
      const { length } = getTimelineInfo();
      if (isPlaying && length > 0) {
        const framesPerSecond = 2 * playbackRate;
        const nextIdx = (frameIndex + dt * framesPerSecond) % length;
        setFrameIndex(nextIdx);
        advanceTimeBy(dt * playbackRate);
      }
      state._rafId = requestAnimationFrame(loop);
    };
    state._rafId = requestAnimationFrame(loop);
    set({});
  },

  stopLoop: () => {
    const state = get() as any;
    if (state._rafId) cancelAnimationFrame(state._rafId);
    state._rafId = 0;
    set({});
  },
}));


