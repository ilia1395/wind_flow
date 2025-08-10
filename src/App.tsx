import { useEffect, useMemo, useState } from 'react';
import { VectorFieldRenderer } from './VectorFieldRenderer';
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
  const [playbackRate, setPlaybackRate] = useState(1); // 1x, 2x, 4x...

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
        // advance frame roughly every 0.5s over the available timeline (base 2 fps)
        const len = timelineInfo.length;
        if (dt > 0 && len > 0) {
          const framesPerSecond = 2 * playbackRate;
          setFrameIndex((i) => (i + dt * framesPerSecond) % len);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, timelineInfo.length, playbackRate]);

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
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)', height: '100dvh' }}>
      <div style={{ padding: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Speed x
          <input type="range" min={0.2} max={3} step={0.1} value={speedMultiplier} onChange={(e) => setSpeedMultiplier(Number(e.target.value))} />
          {speedMultiplier.toFixed(1)}
        </label>
        <label>
          Particles
          <input type="range" min={50} max={1000} step={50} value={numParticles} onChange={(e) => setNumParticles(Number(e.target.value))} />
          {numParticles}
        </label>
        <label>
          Damping
          <input type="range" min={0} max={1} step={0.05} value={damping} onChange={(e) => setDamping(Number(e.target.value))} />
          {damping.toFixed(2)}
        </label>
        <label>
          Turbulence
          <input type="range" min={0} max={1} step={0.05} value={turbulenceStrength} onChange={(e) => setTurbulenceStrength(Number(e.target.value))} />
          {turbulenceStrength.toFixed(2)}
        </label>
        <label>
          Load CSV
          <input type="file" accept=".csv" onChange={(e) => e.target.files && e.target.files[0] && onCsvSelected(e.target.files[0])} />
        </label>
        <span>Frame: {Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineInfo.length - 1)) + 1}/{timelineInfo.length}</span>
        {heightOrder.length > 0 && (
          <span style={{ marginLeft: 12 }}>
            Loaded layered CSV: heights [{heightOrder.join(', ')}] — per-height frames: {
              heightOrder
                .map((h) => `${h}m:${(framesByHeight[h] || []).length}`)
                .join(' | ')
            }
          </span>
        )}
      </div>
      <div style={{ position: 'relative' }}>
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
        {/* Bottom-centered playback slider */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 8,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.35)',
              color: 'white',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'auto',
            }}
          >
            <button onClick={() => setIsPlaying((p) => !p)}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button onClick={() => { setIsPlaying(false); setFrameIndex(0); }}>Stop</button>
            <label>
              Playback
              <select value={playbackRate} onChange={(e) => setPlaybackRate(Number(e.target.value))}>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
                <option value={16}>16x</option>
                <option value={256}>256x</option>
              </select>
            </label>
            <span style={{ minWidth: 160, textAlign: 'right' }}>{displayTimeLabel}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, timelineInfo.length - 1)}
              step={1}
              value={Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineInfo.length - 1))}
              onChange={(e) => setFrameIndex(Number(e.target.value))}
              style={{ width: 420 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
