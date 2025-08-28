 
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

export function VectorFieldPage() {
  // VectorField now derives its own model (sampler, heights, status) internally

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
                <VectorField />
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
                <VectorField />
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
