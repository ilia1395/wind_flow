
import { useMemo, useState, useEffect } from 'react';

import { useWindData, type FieldSampler, type WindFrame } from '@entities/WindData';
import { VectorField } from '@widgets/VectorField';
import { PlaybackControls } from '@widgets/PlaybackControls';
import { createLayeredFieldSampler, createFieldSamplerForFrame } from '@shared/lib/fieldSampler';
import { OrbitControls } from '@react-three/drei';

import { HitTest } from '@shared/lib/hitTest/HitTest'
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  createXRStore,
  DefaultXRController,
  DefaultXRHand,
  IfInSessionMode,
  useXRInputSourceEvent,
  useXRInputSourceStateContext,
  XR,
  XRDomOverlay,
  XRHitTest,
  XRSpace
} from '@react-three/xr';
import {hitTestMatrices, onResults} from '@shared/lib/hitTest/hitTestUtils'
import { Quaternion, Vector3 } from 'three';

const xr_store = createXRStore({
  domOverlay: true,
  hitTest: true,
  anchors: true,
  layers: false,
  meshDetection: false,

  hand: () => {
    const state = useXRInputSourceStateContext()

    return (
      <>
        <DefaultXRHand />
        <XRSpace space={state.inputSource.targetRaySpace}>
          <XRHitTest onResults={onResults.bind(null, state.inputSource.handedness)} />
        </XRSpace>
      </>
    )
  },

  controller: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const state = useXRInputSourceStateContext()

    return (
      <>
        <DefaultXRController />
        <XRSpace space={state.inputSource.targetRaySpace}>
          <XRHitTest onResults={onResults.bind(null, state.inputSource.handedness)} />
        </XRSpace>
      </>
    )
  },
})

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
  const [time, setTime] = useState(0);
  const [bounds] = useState<[number, number, number]>([6, 4, 6]);

  const [anchor, setAnchor] = useState<{ position: Vector3; quaternion: Quaternion }>();
  const [placed, setPlaced] = useState<boolean>(false);
  const ARAnchoredVectorField: React.FC = () => {
    useXRInputSourceEvent(
      'all',
      'select',
      (e) => {
        const matrix = hitTestMatrices[e.inputSource.handedness];
        if (matrix) {
          const position = new Vector3();
          const quaternion = new Quaternion();
          matrix.decompose(position, quaternion, new Vector3());
          setAnchor({ position, quaternion });
          setPlaced(true);
        };
      },
      []);
    
    if (!anchor) return
    return (
      <group position={anchor.position} quaternion={anchor.quaternion} scale={0.1}>
        <VectorField
          bounds={bounds}
          fieldSampler={layeredSampler as FieldSampler}
          currentTime={time}
          heightSlices={heightOrder.length ? heightOrder : undefined}
          statusText={statusText}
        />
      </group>
    );
  };
  
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
      <div style={{ position: 'relative', height: '80vh', gridColumn: '1 / -1' }}>
        <button
        onClick={() => xr_store.enterAR()}
        style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#3c2741ff',
            color: 'white',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }}
      >
        Enter AR
      </button>
        <Canvas camera={{ position: [0, 0, 256], fov: 5 }}>
          <XR store={xr_store}>
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 12, 10]} intensity={0.8} />
            <OrbitControls enableDamping />
            <IfInSessionMode allow={'immersive-ar'}>
              <HitTest />              
              <ARAnchoredVectorField />
              <XRDomOverlay>
                <button 
                  onClick={() => xr_store.getState().session?.end()}
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    padding: '10px 20px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#3c2741ff',
                    color: 'white',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  Exit AR
                </button>
              </XRDomOverlay>
            </IfInSessionMode>
            
            <IfInSessionMode deny={'immersive-ar'}>
              <VectorField
                bounds={bounds}
                fieldSampler={layeredSampler as FieldSampler}
                currentTime={time}
                heightSlices={heightOrder.length ? heightOrder : undefined}
                statusText={statusText}
              />
            </IfInSessionMode>          
          </XR>
        </Canvas>
        
        
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

        </div>
      </div>
    </div>
  );
}
