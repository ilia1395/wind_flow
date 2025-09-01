import { Canvas } from '@react-three/fiber';
import { VectorField } from '@/widgets/VectorField';
import { WindDataPanel } from '@/widgets/WindDataPanel/ui/WindDataPanel';
import { PlaybackControls } from '@/widgets/PlaybackControls'

import { OrbitControls } from '@react-three/drei';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ThemeToggle } from '@/shared/components/ui/theme-toggle';

export function DashboardPage() {
  return (
    <div className="grid [grid-template-columns:1.4fr_1fr] [grid-template-rows:auto_1fr_auto] gap-3 h-dvh w-dvw p-3 bg-background text-foreground">
      <div className="[grid-column:1/2] [grid-row:1/3] flex flex-col min-h-0">
        <Card className="h-full overflow-hidden bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Vector Field</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-full">
            <div className="relative h-full">
              <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [0, 0, 8192], fov: 1, near: 0.1, far: 500000 }}>
                <OrbitControls enableDamping={true} enablePan={false} enableZoom={true} />
                <VectorField />
              </Canvas>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="[grid-column:2/3] [grid-row:1/3] min-h-0 flex flex-col gap-3">
        {/* <div className="flex items-center justify-end">
          <ThemeToggle />
        </div> */}
        <div className="max-h-[calc(100dvh-1rem)] overflow-y-auto pr-1">
          <WindDataPanel />
        </div>
      </div>

      <div className="[grid-column:1/2] [grid-row:3/4] flex items-center">
        <Card className="w-full bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Playback</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PlaybackControls />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


