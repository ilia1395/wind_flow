
import { useMemo } from 'react';

import { useWindStore, type WindFrame } from '@entities/WindData';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  IfInSessionMode,
  XR,
  XRDomOverlay,
} from '@react-three/xr';

import { xr_store } from '@shared/lib/XRStoreInit';
import { VectorField } from '@widgets/VectorField';
import { ObjectPlacement } from '@features/ObjectPlacement';
import { PlaybackControls } from '@widgets/PlaybackControls';
import { createLayeredFieldSampler } from '@entities/FieldSampler/model/fieldSampler';

export function VectorFieldPage() {
  const framesByHeight = useWindStore((s) => s.framesByHeight);
  const heightOrder = useWindStore((s) => s.heightOrder);
  const frameIndex = useWindStore((s) => s.frameIndex);

  const layeredSampler = useMemo(() => {
    if (heightOrder.length && Object.keys(framesByHeight).length) {
      return createLayeredFieldSampler(framesByHeight, heightOrder, frameIndex);
    }
  }, [framesByHeight, heightOrder, frameIndex]);

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
    let maxLen = 0; let repH = heightOrder[0];
    for (const h of heightOrder) {
      const len = (framesByHeight[h] || []).length;
      if (len > maxLen) { maxLen = len; repH = h; }
    }
    const arr = framesByHeight[repH] || [];
    const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, arr.length - 1));
    return arr[idx] as WindFrame | undefined;
  }, [framesByHeight, heightOrder, frameIndex]);

  

  const statusText = useMemo(() => {
    let meanHS = 0;
    let count = 0;
    let meanGustRatio = 0;
    if (heightOrder.length && Object.keys(framesByHeight).length) {
      // use same index policy as timeline (floor of frameIndex)
      const idx = Math.min(Math.max(Math.floor(frameIndex), 0), Math.max(0, timelineLength - 1));
      for (const h of heightOrder) {
        const arr = framesByHeight[h] || [];
        if (!arr.length) continue;
        const f = arr[Math.min(idx, arr.length - 1)];
        if (!f) continue;
        const hs = f.horizSpeedMean ?? 0;
        const max = (f as WindFrame).horizSpeedMax ?? hs;
        const gr = hs > 0 ? Math.max(0, (max - hs) / hs) : 0;
        meanHS += hs;
        meanGustRatio += gr;
        count += 1;
      }
    } else {
      const f = currentFrame;
      if (f) {
        const hs = f.horizSpeedMean ?? 0;
        const max = (f as WindFrame).horizSpeedMax ?? hs;
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
  }, [heightOrder, framesByHeight, frameIndex, timelineLength, currentFrame]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', height: '100vh', width: '100vw' }}>
      <div style={{ position: 'relative', height: '95vh', gridColumn: '1 / -1' }}>
        {/* <button
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
      </button> */}
        <Canvas camera={{ position: [0, 0, 8192], fov: 1, near: 0.1, far: 500000 }}>
          <XR store={xr_store}>
            <OrbitControls />
            <IfInSessionMode allow={'immersive-ar'}>
              <ObjectPlacement scale={1}>
                <VectorField
                  fieldSampler={layeredSampler}
                  heightSlices={heightOrder.length ? heightOrder : undefined}
                  statusText={statusText}
                />
              </ObjectPlacement>
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
              <ObjectPlacement>
                <VectorField
                  fieldSampler={layeredSampler}
                  heightSlices={heightOrder.length ? heightOrder : undefined}
                  statusText={statusText}
                />
              </ObjectPlacement>
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
            <PlaybackControls />
          </div>

        </div>
      </div>
    </div>
  );
}
