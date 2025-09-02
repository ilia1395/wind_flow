import { Canvas } from '@react-three/fiber';
import { VectorField } from '@/widgets/VectorField';
import { WindDataPanel } from '@/widgets/WindDataPanel/ui/WindDataPanel';
import { PlaybackControls } from '@/widgets/PlaybackControls'

import { OrbitControls } from '@react-three/drei';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function DashboardPage() {
  return (
    <div className="grid grid-cols-1 [grid-template-rows:auto_auto_auto] md:[grid-template-columns:minmax(0,1.4fr)_minmax(320px,1fr)] md:[grid-template-rows:auto_1fr_auto] gap-3 h-dvh w-dvw p-3 bg-background text-foreground">
      <div className="md:[grid-column:1/2] md:[grid-row:1/3] flex flex-col min-h-0">
        <Card className="h-auto md:h-full overflow-hidden bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Vector Field</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-full">
            <div className="relative h-[45dvh] md:h-full">
              <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [0, 0, 8192], fov: 1, near: 0.1, far: 500000 }}>
                <OrbitControls enableDamping={true} enablePan={false} enableZoom={true} />
                <VectorField />
              </Canvas>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="md:[grid-column:2/3] md:[grid-row:1/3] min-h-0 flex flex-col gap-3 order-2 md:order-none md:min-w-[320px]">
        {/* <div className="flex items-center justify-end">
          <ThemeToggle />
        </div> */}
        <div className="md:max-h-[calc(100dvh-1rem)] md:overflow-y-auto pr-1 w-full">
          <WindDataPanel />
        </div>
      </div>

      <div className="md:[grid-column:1/2] md:[grid-row:3/4] flex items-center order-3 md:order-none ">
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


