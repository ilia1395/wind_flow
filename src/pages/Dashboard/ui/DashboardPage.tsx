import { Canvas } from '@react-three/fiber';
import { VectorField } from '@/widgets/VectorField';
import { WindDataPanel } from '@/widgets/WindDataPanel/ui/WindDataPanel';
import { PlaybackControls } from '@/widgets/PlaybackControls'

import { OrbitControls } from '@react-three/drei';

export function DashboardPage() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gridTemplateRows: 'auto 1fr auto', gap: '12px', height: '100vh', width: '100vw', padding: '12px', boxSizing: 'border-box', background: '#0f0f10' }}>
      <div style={{ gridColumn: '1 / 2', gridRow: '1 / 3', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 12px', color: 'white', background: 'rgba(255,255,255,0.06)', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}>Vector Field</div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <Canvas camera={{ position: [0, 0, 8192], fov: 1, near: 0.1, far: 500000 }}>
            <OrbitControls enableDamping={true} enablePan={false} enableZoom={true} />
            <VectorField />
          </Canvas>
        </div>
      </div>

      <div style={{ gridColumn: '2 / 3', gridRow: '1 / 3', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 12px', color: 'white', background: 'rgba(255,255,255,0.06)', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}>Wind Data</div>
        <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.04)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: 12 }}>
            <WindDataPanel />
          </div>
        </div>
      </div>

      <div style={{ gridColumn: '1 / 2', gridRow: '3 / 4', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%' }}>
          <div style={{ padding: '10px 12px', color: 'white', background: 'rgba(255,255,255,0.06)', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}>Playback</div>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.04)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
            <PlaybackControls />
          </div>
        </div>
      </div>
    </div>
  );
}


