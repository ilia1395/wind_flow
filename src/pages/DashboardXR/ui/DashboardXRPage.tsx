 
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
import { WindDataPanel } from '@widgets/WindDataPanel/ui/WindDataPanel';

export function DashboardXRPage() {

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', height: '100vh', width: '100vw', gap: '12px', padding: '12px', boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', height: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
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
        <div style={{ width: '100%', maxWidth: '100%', height: '80vh' }}>
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
        </div>
        
        
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            margin: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
            pointerEvents: 'none',
            gap: '8px',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <PlaybackControls />
          </div>
        </div>
      </div>

      <div style={{ overflowY: 'auto', height: 'calc(100vh - 24px)' }}>
        <WindDataPanel />
      </div>
    </div>
  );
}
