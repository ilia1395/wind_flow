import { useEffect, useMemo, useState } from 'react';
import { VectorFieldRenderer } from './Features/VectorField/VectorFieldRenderer';
import { VectorFieldControls } from './Features/VectorField/VectorFieldControls';
import { PlaybackControls } from './Features/Playback Controls/PlaybackControls';
import {
  createFieldSamplerForFrame,
  parseWindCsv,
  parseMastCsvByHeights,
  createLayeredFieldSampler,
  type WindFrame,
} from './windData';
// Import CSV via Vite as URL; user can replace this path or load via input
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import mastCsvUrl from './data/05092013-11112013_23s_res.csv?url';

function App() {
  const [frames, setFrames] = useState<WindFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [time, setTime] = useState(0);
  const [bounds] = useState<[number, number, number]>([6, 4, 6]);
  const [numParticles, setNumParticles] = useState(1000);
  const [turbulenceStrength, setTurbulenceStrength] = useState(0.05);
  const [damping, setDamping] = useState(0.9);
  // playbackRate is managed inside PlaybackControls; we mirror it here only if needed
  const [_playbackRate, setPlaybackRate] = useState(1);

  // Demo fallback if no data loaded
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

  const activeFrames = frames.length ? frames : demoFrames;
  const currentFrame = activeFrames[Math.min(frameIndex, activeFrames.length - 1)];

  const [framesByHeight, setFramesByHeight] = useState<Record<number, WindFrame[]>>({});
  const [heightOrder, setHeightOrder] = useState<number[]>([]);
  const layeredSampler = useMemo(() => {
    if (heightOrder.length && Object.keys(framesByHeight).length) {
      return createLayeredFieldSampler(framesByHeight, heightOrder, frameIndex, { bounds });
    }
    return createFieldSamplerForFrame(currentFrame, { bounds });
  }, [framesByHeight, heightOrder, frameIndex, currentFrame, bounds]);

  // Timeline length and representative frame for display
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
    return { length: activeFrames.length, repHeight: undefined as number | undefined };
  }, [heightOrder, framesByHeight, activeFrames.length]);

  const displayFrame = useMemo(() => {
    const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineInfo.length - 1));
    if (timelineInfo.repHeight != null) {
      const arr = framesByHeight[timelineInfo.repHeight] || [];
      return arr[idx];
    }
    return activeFrames[idx];
  }, [frameIndex, timelineInfo, framesByHeight, activeFrames]);

  const displayTimeLabel = useMemo(() => {
    // Prefer original string to avoid TZ shifts if present
    const raw = (displayFrame as any)?.timeString as string | undefined;
    if (raw && raw.trim()) return raw;
    const sec = displayFrame?.time;
    if (typeof sec === 'number') {
      try {
        return new Date(sec * 1000).toLocaleString();
      } catch {
        /* noop */
      }
    }
    return `Frame ${Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineInfo.length - 1)) + 1}`;
  }, [displayFrame, frameIndex, timelineInfo.length]);

  // Derive status for overlay: mean horizontal speed and gust state
  const statusText = useMemo(() => {
    let meanHS = 0;
    let count = 0;
    let meanGustRatio = 0;
    if (heightOrder.length && Object.keys(framesByHeight).length) {
      // use same index policy as timeline (floor of frameIndex)
      const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineInfo.length - 1));
      for (const h of heightOrder) {
        const arr = framesByHeight[h] || [];
        if (!arr.length) continue;
        const f = arr[Math.min(idx, arr.length - 1)];
        if (!f) continue;
        const hs = f.horizSpeedMean ?? 0;
        const max = (f as any).horizSpeedMax ?? hs;
        const gr = hs > 0 ? Math.max(0, (max - hs) / hs) : 0;
        meanHS += hs;
        meanGustRatio += gr;
        count += 1;
      }
    } else {
      const f = currentFrame;
      if (f) {
        const hs = f.horizSpeedMean ?? 0;
        const max = (f as any).horizSpeedMax ?? hs;
        const gr = hs > 0 ? Math.max(0, (max - hs) / hs) : 0;
        meanHS += hs;
        meanGustRatio += gr;
        count += 1;
      }
    }
    if (count === 0) return undefined;
    meanHS /= count;
    meanGustRatio /= count;
    // Gust gradations
    let gustLabel = 'NO GUSTS';
    if (meanGustRatio >= 0.35) gustLabel = 'HIGH GUSTS';
    else if (meanGustRatio >= 0.1) gustLabel = 'MEDIUM GUSTS';
    const danger = meanHS > 10; // lifting equipment risk threshold
    const dangerLabel = danger ? ' — DANGEROUS WIND (>10 m/s)' : '';
    return `Wind speed: ${meanHS.toFixed(1)} (m/s) — ${gustLabel}${dangerLabel}`;
  }, [heightOrder, framesByHeight, frameIndex, timelineInfo.length, currentFrame]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (isPlaying) {
        setTime((t) => t + dt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  function onCsvSelected(file: File) {
    file.text().then(async (txt) => {
      // Try mast by heights; if fails, fallback to flat CSV format
      try {
        const { framesByHeight, heights } = parseMastCsvByHeights(txt);
        setFramesByHeight(framesByHeight);
        setHeightOrder(heights);
        setFrames([]);
        setFrameIndex(0);
      } catch (_e) {
        const parsed = await parseWindCsv(txt);
        setFrames(parsed);
        setFramesByHeight({});
        setHeightOrder([]);
        setFrameIndex(0);
      }
    });
  }

  // Auto-load embedded CSV if present (optional)
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', height: '100vh', width: '100vw' }}>
      
      <div style={{ position: 'relative', height: '600px', gridColumn: '1 / -1' }}>
        <VectorFieldRenderer
          bounds={bounds}
          speedMultiplier={speedMultiplier}
          numParticles={numParticles}
          fieldSampler={layeredSampler}
          currentTime={time}
          damping={damping}
          turbulenceStrength={turbulenceStrength}
          heightSlices={heightOrder.length ? heightOrder : undefined}
          statusText={statusText}
        />
      </div>
      {/* Bottom-centered controls */}
      <div
        style={{
          display: 'grid',
          gridColumn: '2 / -2',
          pointerEvents: 'none',
          gap: '8px',
          height: 'auto',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <PlaybackControls
            timelineLength={timelineInfo.length}
            displayTimeLabel={displayTimeLabel}
            initialPlaybackRate={_playbackRate}
            onFrameIndexChange={setFrameIndex}
            onIsPlayingChange={setIsPlaying}
            onPlaybackRateChange={setPlaybackRate}
          />
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <VectorFieldControls
            speedMultiplier={speedMultiplier}
            onSpeedMultiplierChange={setSpeedMultiplier}
            numParticles={numParticles}
            onNumParticlesChange={setNumParticles}
            damping={damping}
            onDampingChange={setDamping}
            turbulenceStrength={turbulenceStrength}
            onTurbulenceStrengthChange={setTurbulenceStrength}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
