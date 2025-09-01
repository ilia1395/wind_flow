import React, { useState } from 'react';
import { useWindDataPanelMetrics } from '../model/windDataPanelModel';
import { formatDeg } from '../lib/metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

type Mode = 'realtime' | 'avg10min';

 

export const WindDataPanel: React.FC = () => {
  const { realtime: rt, avg10: av } = useWindDataPanelMetrics();

  const [mode, setMode] = useState<Mode>('realtime');

  return (
    <Card className="w-full sm:max-w-md bg-background/60 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Wind Data</CardTitle>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="mt-2">
            <TabsTrigger value="realtime">Real-Time</TabsTrigger>
            <TabsTrigger value="avg10min">10-Min Avg</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsContent value="realtime" className="border-none p-0">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Current Speed" value={`${rt.speed.toFixed(1)} m/s`} />
              <Metric label="Direction" value={formatDeg(rt.dir)} />
              <Metric label="Gusts" value={`${rt.gust.toFixed(1)} m/s`} />
              <Metric label="Shear" value={`${rt.shearPer100m.toFixed(2)} m/s per 100 m`} />
              <Metric label="Veer" value={`${rt.veerDeg.toFixed(0)}°`} />
              <Metric label="Turbulence (TI)" value={`${(rt.ti * 100).toFixed(1)}%`} />
            </div>
          </TabsContent>
          <TabsContent value="avg10min" className="border-none p-0">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Mean Speed" value={`${av.speed.toFixed(1)} m/s`} />
              <Metric label="Mean Direction" value={formatDeg(av.dir)} />
              <Metric label="Avg Shear" value={`${av.shearPer100m.toFixed(2)} m/s per 100 m`} />
              <Metric label="Avg Veer" value={`${av.veerDeg.toFixed(0)}°`} />
              <Metric label="Turbulence (TI)" value={`${(av.turbulence * 100).toFixed(1)}%`} />
              <Metric label="Wind Power Density" value={`${av.wpd.toFixed(0)} W/m²`} />
              <Metric label="Stability" value={av.stability} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md bg-muted/40 p-2">
    <div className="text-[12px] text-muted-foreground">{label}</div>
    <div className="text-[18px] font-semibold">{value}</div>
  </div>
);


