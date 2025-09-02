import React, { useEffect, useMemo, useState } from 'react';
import { useWindDataPanelMetrics } from '../model/windDataPanelModel';
import { formatDeg } from '../lib/metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useWindStore } from '@/entities/WindData';

type Mode = 'realtime' | 'avg10min';

 

export const WindDataPanel: React.FC = () => {
  const heights = useWindStore((s) => s.heightOrder);
  const defaultBottom = useMemo(() => (heights.length ? Math.min(...heights) : undefined), [heights]);
  const defaultTop = useMemo(() => (heights.length ? Math.max(...heights) : undefined), [heights]);

  const [bottomH, setBottomH] = useState<number | undefined>(defaultBottom);
  const [topH, setTopH] = useState<number | undefined>(defaultTop);
  const { realtime: rt, avg10: av } = useWindDataPanelMetrics(bottomH, topH);

  const [mode, setMode] = useState<Mode>('avg10min');

  useEffect(() => {
    if (heights.length) {
      setBottomH((prev) => (prev == null ? Math.min(...heights) : prev));
      setTopH((prev) => (prev == null ? Math.max(...heights) : prev));
    }
  }, [heights]);

  return (
    <Card className="w-full md:min-w-[320px] md:w-auto bg-background/60 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Wind Data</CardTitle>
        <div className="flex flex-col gap-2">
          
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="mt-2">
            <TabsTrigger value="realtime">Realtime</TabsTrigger>
            <TabsTrigger value="avg10min">10 min</TabsTrigger>
          </TabsList>
          </Tabs>
          <div className="grid grid-cols-2 gap-2">
            <HeightSelect
              label="Bottom height"
              heights={heights}
              value={bottomH}
              onChange={(h) => setBottomH(h)}
            />
            <HeightSelect
              label="Top height"
              heights={heights}
              value={topH}
              onChange={(h) => setTopH(h)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsContent value="realtime" className="border-none p-0">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Current Speed" value={`${rt.speed.toFixed(1)} m/s`} />
              <Metric label="Direction" value={formatDeg(rt.dir)} />
              {/* <Metric label="Gusts" value={`${rt.gust.toFixed(1)} m/s`} /> */}
              <Metric label="Shear" value={`${rt.shearPer100m.toFixed(2)} m/s`} />
              <Metric label="Veer" value={`${rt.veerDeg.toFixed(0)}°`} />
              {/* <Metric label="Turbulence (TI)" value={`${(rt.ti * 100).toFixed(1)}%`} /> */}
            </div>
          </TabsContent>
          <TabsContent value="avg10min" className="border-none p-0">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Mean Speed" value={`${av.speed.toFixed(1)} m/s`} />
              <Metric label="Mean Direction" value={formatDeg(av.dir)} />
              <Metric label="Avg Shear" value={`${av.shearPer100m.toFixed(2)} m/s`} />
              <Metric label="Avg Veer" value={`${av.veerDeg.toFixed(0)}°`} />
              {/* <Metric label="Turbulence (TI)" value={`${(av.turbulence * 100).toFixed(1)}%`} /> */}
              {/* <Metric label="Wind Power Density" value={`${av.wpd.toFixed(0)} W/m²`} /> */}
              {/* <Metric label="Stability" value={av.stability} /> */}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md bg-muted/40 p-2">
    <div className="text-[9px] text-muted-foreground">{label}</div>
    <div className="text-[12px] font-semibold">{value}</div>
  </div>
);

const HeightSelect: React.FC<{
  label: string;
  heights: number[];
  value?: number;
  onChange: (h: number | undefined) => void;
}> = ({ label, heights, value, onChange }) => {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <select
        className="h-9 rounded-md border border-border bg-background/60 px-2 text-sm text-[12px]"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
      >
        {value == null && <option value="">Select</option>}
        {heights.map((h) => (
          <option key={h} value={h}>
            {h} m
          </option>
        ))}
      </select>
    </label>
  );
};


