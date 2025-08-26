import { create } from "zustand";

import mastCsvUrl from '../../../data/05092013-11112013_23s_res.csv?url';
import type { FramesByHeight, WindFrame } from '../types/types';
import { parseMastCsvByHeights } from '../lib/parsing';
import { fetchCsvText } from '../api/fetchCsv';

interface WindState {
  framesByHeight: FramesByHeight;
  heightOrder: number[];
  frameIndex: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  
  setFrameIndex: (i: number) => void;
  loadByUrl: (url?: string) => Promise<void>;
  loadFromText: (text: string) => void;
  setFramesByHeight: (framesByHeight: FramesByHeight) => void;

  getCurrentFrame: () => WindFrame;
  getTimelineInfo: () => { length: number; repHeight: number};
}

export const useWindStore = create<WindState>((set, get) => ({
  framesByHeight: {},
  heightOrder: [],
  frameIndex: 0,
  status: "idle",
  error: null,

  setFrameIndex: (i) => set({ frameIndex: i }),

  loadByUrl: async (url = mastCsvUrl) => {
    try {
      set({ status: "loading", error: null });
      const text = await fetchCsvText(url);
      const { framesByHeight, heights } = parseMastCsvByHeights(text);
      set({ framesByHeight, heightOrder: heights, frameIndex: 0, status: "ready" });
    } catch (e: any) {
      set({ status: "error", error: e?.message ?? String(e) });
    }
  },

  loadFromText: (text: string) => {
    try {
      set({ status: "loading", error: null });
      const { framesByHeight, heights } = parseMastCsvByHeights(text);
      set({ framesByHeight, heightOrder: heights, frameIndex: 0, status: "ready" });
    } catch (e: any) {
      set({ status: "error", error: e?.message ?? String(e) });
    }
  },

  setFramesByHeight: (framesByHeight: FramesByHeight) => {
    set({ framesByHeight });
  },

  getCurrentFrame: () => {
    const { framesByHeight, frameIndex } = get();
    const { repHeight } = get().getTimelineInfo();

    const frameSet = framesByHeight[repHeight];
    return frameSet[Math.min(Math.floor(frameIndex), Math.max(0, frameSet.length - 1))];  
  },

  getTimelineInfo: () => {
    const { framesByHeight, heightOrder } = get();

    let maxLen = 0;
    let repH = heightOrder[0];
    for (const h of heightOrder) {
      const len = (framesByHeight[h] || []).length;
      if (len > maxLen) {
        maxLen = len;
        repH = h;
      }
    }
    return { length: maxLen, repHeight: repH };
  },
}));