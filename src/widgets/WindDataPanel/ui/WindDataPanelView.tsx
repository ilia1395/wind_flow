import React from 'react';

import { formatDeg } from '../lib/metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

import type { Mode, RealtimeMetrics, Avg10Metrics } from '../types/panelTypes';

type WindDataPanelViewProps = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  heights: number[];
  bottomH: number | undefined;
  setBottomH: (h: number) => void;
  topH: number | undefined;
  setTopH: (h: number) => void;
  rt: RealtimeMetrics;
  av: Avg10Metrics;
}

export const WindDataPanelView: React.FC<WindDataPanelViewProps> = ({ mode, setMode, heights, bottomH, setBottomH, topH, setTopH, rt, av }) => {
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
              onChange={(h) => setBottomH(h ?? 0)}
            />
            <HeightSelect
              label="Top height"
              heights={heights}
              value={topH}
              onChange={(h) => setTopH(h ?? 0)}
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
              <Metric label="Shear" value={`${rt.shearPer100m.toFixed(2)} m/s`} />
              <Metric label="Veer" value={`${rt.veerDeg.toFixed(0)}°`} />
            </div>
          </TabsContent>
          <TabsContent value="avg10min" className="border-none p-0">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Mean Speed" value={`${av.speed.toFixed(1)} m/s`} />
              <Metric label="Mean Direction" value={formatDeg(av.dir)} />
              <Metric label="Avg Shear" value={`${av.shearPer100m.toFixed(2)} m/s`} />
              <Metric label="Avg Veer" value={`${av.veerDeg.toFixed(0)}°`} />
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


