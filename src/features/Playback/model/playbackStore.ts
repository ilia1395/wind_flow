import { create } from 'zustand';

interface PlaybackState {
  isPlaying: boolean;
  playbackRate: number; // 1 = normal speed
  timeSeconds: number;  // accumulated time for simulation

  setIsPlaying: (isPlaying: boolean) => void;
  toggleIsPlaying: () => void;
  setPlaybackRate: (rate: number) => void;
  resetTime: () => void;
  advanceTimeBy: (dt: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: true,
  playbackRate: 1,
  timeSeconds: 0,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleIsPlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaybackRate: (rate) => set({ playbackRate: Math.max(0.0001, rate) }),
  resetTime: () => set({ timeSeconds: 0 }),
  advanceTimeBy: (dt) => set((s) => ({ timeSeconds: s.timeSeconds + Math.max(0, dt) })),
}));


