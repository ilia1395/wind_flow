import { create } from "zustand";

import mastCsvUrl from '../../../data/05092013-11112013_23s_res.csv?url';
import type { FramesByHeight, WindFrame } from '../lib/types';
import { parseMastCsvByHeights } from '../lib/parsing';
import { fetchCsvText } from '../api/fetchCsv';

interface WindState {
  framesByHeight: FramesByHeight;
  heightOrder: number[];
  frameIndex: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  
  // precomputed timeline data
  representativeHeight?: number;
  timelineIntensities: number[];
  timelineBars: number; // how many bars to quantize the timeline into
  timelineSpeeds: number[]; // avg speed per bucket for coloring
  
  setFrameIndex: (i: number) => void;
  loadByUrl: (url?: string) => Promise<void>;
  loadFromText: (text: string) => void;
  setFramesByHeight: (framesByHeight: FramesByHeight) => void;
  setTimelineBars: (bars: number) => void;

  getCurrentFrame: () => WindFrame | undefined;
  getTimelineInfo: () => { length: number; representativeHeight: number};

  // derived selectors
  getCurrentUnixTime: () => number;
  getFramesForHeight: (h: number | 'combined') => WindFrame[];
}

export const useWindStore = create<WindState>((set, get) => ({
  framesByHeight: {},
  heightOrder: [],
  frameIndex: 0,

  // Data Loading
  status: "idle",
  error: null,

  representativeHeight: undefined,
  timelineIntensities: [],
  timelineBars: 256,
  timelineSpeeds: [],

  setFrameIndex: (i) => set({ frameIndex: i }),

  loadByUrl: async (url = mastCsvUrl) => {
    try {
      set({ status: "loading", error: null });
      const text = await fetchCsvText(url);
      const { framesByHeight, heights } = parseMastCsvByHeights(text);
      const { timelineBars } = get();
      const { representativeHeight, intensities, speeds } = computeTimelineDerived(framesByHeight, heights, timelineBars);
      set({ framesByHeight, heightOrder: heights, frameIndex: 0, representativeHeight, timelineIntensities: intensities, timelineSpeeds: speeds, status: "ready" });
    } catch (e: any) {
      set({ status: "error", error: e?.message ?? String(e) });
    }
  },

  loadFromText: (text: string) => {
    try {
      set({ status: "loading", error: null });
      const { framesByHeight, heights } = parseMastCsvByHeights(text);
      const { timelineBars } = get();
      const { representativeHeight, intensities, speeds } = computeTimelineDerived(framesByHeight, heights, timelineBars);
      set({ framesByHeight, heightOrder: heights, frameIndex: 0, representativeHeight, timelineIntensities: intensities, timelineSpeeds: speeds, status: "ready" });
    } catch (e: any) {
      set({ status: "error", error: e?.message ?? String(e) });
    }
  },

  setFramesByHeight: (framesByHeight: FramesByHeight) => {
    const { heightOrder } = get();
    const { timelineBars } = get();
    const { representativeHeight, intensities, speeds } = computeTimelineDerived(framesByHeight, heightOrder, timelineBars);
    set({ framesByHeight, representativeHeight, timelineIntensities: intensities, timelineSpeeds: speeds });
  },

  setTimelineBars: (bars: number) => {
    const safe = Math.max(8, Math.min(2048, Math.floor(bars)));
    const { framesByHeight, heightOrder } = get();
    const { representativeHeight, intensities, speeds } = computeTimelineDerived(framesByHeight, heightOrder, safe);
    set({ timelineBars: safe, representativeHeight, timelineIntensities: intensities, timelineSpeeds: speeds });
  },

  getCurrentFrame: () => {
    const { framesByHeight, frameIndex, heightOrder } = get();
    const { representativeHeight } = get().getTimelineInfo();
    const effectiveHeight = typeof representativeHeight === 'number' ? representativeHeight : heightOrder[0];
    const frameSet = effectiveHeight != null ? framesByHeight[effectiveHeight] : undefined;
    if (!frameSet || frameSet.length === 0) return undefined;
    const idx = Math.min(Math.floor(frameIndex), Math.max(0, frameSet.length - 1));
    return frameSet[idx];  
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
    return { length: maxLen, representativeHeight: repH };
  },

  getCurrentUnixTime: () => {
    const { getCurrentFrame } = get();
    const f = getCurrentFrame();
    const t = typeof f?.time === 'number' ? (f!.time as number) : 0;
    return t;
  },

  getFramesForHeight: (h: number | 'combined') => {
    const { framesByHeight, heightOrder } = get();
    if (h === 'combined') {
      const combined: WindFrame[] = [];
      for (const height of heightOrder) {
        const arr = framesByHeight[height] || [];
        if (arr.length) combined.push(...arr);
      }
      combined.sort((a, b) => (Number(a.time ?? 0) - Number(b.time ?? 0)));
      return combined;
    }
    return framesByHeight[h] || [];
  },
}));

function computeTimelineDerived(
  framesByHeight: FramesByHeight,
  heightOrder: number[],
  quantBars = 128
): { representativeHeight: number | undefined; intensities: number[]; speeds: number[] } {
  if (!heightOrder || heightOrder.length === 0) return { representativeHeight: undefined, intensities: [], speeds: [] };
  let maxLen = 0;
  let rep = heightOrder[0];
  for (const h of heightOrder) {
    const len = (framesByHeight[h] || []).length;
    if (len > maxLen) { maxLen = len; rep = h; }
  }
  const arr = framesByHeight[rep] || [];
  if (!arr.length) return { representativeHeight: rep, intensities: [], speeds: [] };
  const speeds = arr.map((f) => {
    const v = Number(f?.horizSpeedMean ?? 0);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  });
  let minPos = Infinity;
  let maxVal = 0;
  for (const v of speeds) {
    if (v > 0 && v < minPos) minPos = v;
    if (v > maxVal) maxVal = v;
  }
  if (!Number.isFinite(minPos)) minPos = 0.1;
  if (maxVal <= 0) return { representativeHeight: rep, intensities: speeds.map(() => 0), speeds };
  const logMin = Math.log(minPos);
  const logMax = Math.log(Math.max(maxVal, minPos + 1e-6));
  const denom = Math.max(1e-6, logMax - logMin);
  const base = speeds.map((v) => {
    if (v <= 0) return 0;
    const t = (Math.log(v) - logMin) / denom;
    return Math.min(1, Math.max(0, t));
  });
  const bars = Math.max(1, Math.floor(quantBars));
  if (bars >= base.length) {
    const sp = speeds.slice(0);
    return { representativeHeight: rep, intensities: base, speeds: sp };
  }
  const bucketSize = base.length / bars;
  const quantized: number[] = new Array(bars).fill(0);
  const speedBuckets: number[] = new Array(bars).fill(0);
  for (let i = 0; i < bars; i += 1) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let sumIntensity = 0;
    let sumSpeed = 0;
    let count = 0;
    for (let j = start; j < end && j < base.length; j += 1) {
      const bi = base[j];
      sumIntensity += bi;
      const sj = speeds[j] ?? 0;
      sumSpeed += sj;
      count += 1;
    }
    quantized[i] = count > 0 ? (sumIntensity / count) : 0;
    speedBuckets[i] = count > 0 ? (sumSpeed / count) : 0;
  }
  return { representativeHeight: rep, intensities: quantized, speeds: speedBuckets };
}