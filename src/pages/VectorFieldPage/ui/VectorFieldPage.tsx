
import { useWindData, type FieldSampler, type WindFrame } from '../../../entities/WindData';
import { VectorField } from '../../../widgets/VectorField';
import { PlaybackControls } from '../../../widgets/PlaybackControls';
import { VectorFieldControls } from '../../../features/VectorFieldControls';
import { useMemo, useState, useEffect } from 'react';
import { createLayeredFieldSampler, createFieldSamplerForFrame } from '../../../shared/lib/fieldSampler';

export function VectorFieldPage() {
  const {
    framesByHeight,
    heightOrder,
    frameIndex,
    setFrameIndex,
    timelineInfo,
    currentFrame,
  } = useWindData();

  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [numParticles, setNumParticles] = useState(1000);
  const [turbulenceStrength, setTurbulenceStrength] = useState(0.05);
  const [damping, setDamping] = useState(0.9);
  const [time, setTime] = useState(0);
  const [bounds] = useState<[number, number, number]>([6, 4, 6]);

  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000; // delta time in seconds
      lastTime = now;
      
      setTime(prevTime => prevTime + deltaTime);
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const layeredSampler = useMemo(() => {
    if (heightOrder.length && Object.keys(framesByHeight).length) {
      return createLayeredFieldSampler(framesByHeight, heightOrder, frameIndex, { bounds });
    }
    return createFieldSamplerForFrame(currentFrame, { bounds });
  }, [framesByHeight, heightOrder, frameIndex, currentFrame, bounds]);

  const displayTimeLabel = useMemo(() => {
    // Prefer original string to avoid TZ shifts if present
    const raw = (currentFrame as WindFrame)?.timeString as string | undefined;
    if (raw && raw.trim()) return raw;
    const sec = currentFrame?.time;
    if (typeof sec === 'number') {
      try {
        return new Date(sec * 1000).toLocaleString();
      } catch {
        /* noop */
      }
    }
    return `Frame ${Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineInfo.length - 1)) + 1}`;
  }, [currentFrame, frameIndex, timelineInfo.length]);

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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', height: '100vh', width: '100vw' }}>
      <div style={{ position: 'relative', height: '70vh', gridColumn: '1 / -1' }}>
        <VectorField
          bounds={bounds}
          speedMultiplier={speedMultiplier}
          numParticles={numParticles}
          fieldSampler={layeredSampler as FieldSampler}
          currentTime={time}
          damping={damping}
          turbulenceStrength={turbulenceStrength}
          heightSlices={heightOrder.length ? heightOrder : undefined}
          statusText={statusText}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            pointerEvents: 'none',
            gap: '8px',
            height: 'auto',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <PlaybackControls
              timelineLength={timelineInfo.length}
              displayTimeLabel={displayTimeLabel}
              frameIndex={frameIndex}
              onFrameIndexChange={setFrameIndex}
              onIsPlayingChange={setIsPlaying}
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
    </div>
  );
}
