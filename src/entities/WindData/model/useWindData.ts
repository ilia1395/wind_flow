
import { useState, useEffect, useMemo } from 'react';
import { type WindFrame, type FramesByHeight } from './types';
import { parseMastCsvByHeights, parseWindCsv } from '../api/windDataAPI';

// @ts-ignore
import mastCsvUrl from '../../../data/05092013-11112013_23s_res.csv?url';

export function useWindData() {
  const [frames, setFrames] = useState<WindFrame[]>([]);
  const [framesByHeight, setFramesByHeight] = useState<FramesByHeight>({});
  const [heightOrder, setHeightOrder] = useState<number[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    fetch(mastCsvUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((txt) => {
        try {
          const { framesByHeight, heights } = parseMastCsvByHeights(txt);
          setFramesByHeight(framesByHeight);
          setHeightOrder(heights);
          setFrames([]);
          setFrameIndex(0);
        } catch {
          // ignore
        }
      })
      .catch(() => void 0);
  }, []);

  const timelineInfo = useMemo(() => {
    if (heightOrder.length && Object.keys(framesByHeight).length) {
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
    }
    return { length: frames.length, repHeight: undefined as number | undefined };
  }, [heightOrder, framesByHeight, frames.length]);

  const demoFrames = useMemo<WindFrame[]>(() => {
    const arr: WindFrame[] = [];
    for (let i = 0; i < 60; i += 1) {
      arr.push({
        time: i,
        directionDeg: (i * 6) % 360,
        horizSpeedMean: 5 + Math.sin(i * 0.2) * 2,
        horizSpeedStd: 0.8 + Math.abs(Math.cos(i * 0.15)) * 0.8,
        vertSpeedMean: Math.sin(i * 0.1) * 0.3,
        vertSpeedStd: 0.2,
        horizVariance: 1.5,
        horizMin: 1,
        turbulenceIntensity: 0.15 + Math.abs(Math.sin(i * 0.12)) * 0.35,
      });
    }
    return arr;
  }, []);

  const currentFrame = useMemo(() => {
    if (timelineInfo.repHeight !== undefined) {
      const frameSet = framesByHeight[timelineInfo.repHeight] || [];
      return frameSet[Math.min(Math.floor(frameIndex), Math.max(0, frameSet.length - 1))];
    }
    const activeFrames = frames.length ? frames : demoFrames;
    return activeFrames[Math.min(Math.floor(frameIndex), Math.max(0, activeFrames.length - 1))];
  }, [frameIndex, frames, demoFrames, framesByHeight, timelineInfo]);

  return {
    frames,
    framesByHeight,
    heightOrder,
    frameIndex,
    setFrameIndex,
    timelineInfo,
    currentFrame,
  };
}
