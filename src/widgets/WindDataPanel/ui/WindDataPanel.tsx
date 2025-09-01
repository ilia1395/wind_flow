import React, { useState } from 'react';
import { useWindDataPanelMetrics } from '../model/windDataPanelModel';
import { formatDeg } from '../lib/metrics';

type Mode = 'realtime' | 'avg10min';

 

export const WindDataPanel: React.FC = () => {
  const { realtime: rt, avg10: av } = useWindDataPanelMetrics();

  const [mode, setMode] = useState<Mode>('realtime');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, color: 'white', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setMode('realtime')}
          style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: mode === 'realtime' ? '#3c2741' : '#222', color: 'white' }}
        >
          Real-Time
        </button>
        <button
          onClick={() => setMode('avg10min')}
          style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: mode === 'avg10min' ? '#3c2741' : '#222', color: 'white' }}
        >
          10-Min Avg
        </button>
      </div>

      {mode === 'realtime' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Metric label="Current Speed" value={`${rt.speed.toFixed(1)} m/s`} />
          <Metric label="Direction" value={formatDeg(rt.dir)} />
          <Metric label="Gusts" value={`${rt.gust.toFixed(1)} m/s`} />
          <Metric label="Shear" value={`${rt.shearPer100m.toFixed(2)} m/s per 100 m`} />
          <Metric label="Veer" value={`${rt.veerDeg.toFixed(0)}°`} />
          <Metric label="Turbulence (TI)" value={`${(rt.ti * 100).toFixed(1)}%`} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Metric label="Mean Speed" value={`${av.speed.toFixed(1)} m/s`} />
          <Metric label="Mean Direction" value={formatDeg(av.dir)} />
          <Metric label="Avg Shear" value={`${av.shearPer100m.toFixed(2)} m/s per 100 m`} />
          <Metric label="Avg Veer" value={`${av.veerDeg.toFixed(0)}°`} />
          <Metric label="Turbulence (TI)" value={`${(av.turbulence * 100).toFixed(1)}%`} />
          <Metric label="Wind Power Density" value={`${av.wpd.toFixed(0)} W/m²`} />
          <Metric label="Stability" value={av.stability} />
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 10px' }}>
    <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
  </div>
);


