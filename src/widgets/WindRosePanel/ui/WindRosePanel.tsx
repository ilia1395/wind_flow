import React, { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { type WindRoseData, type WindRosePeriod } from '../lib/windRose';
import { useWindRoseModel } from '../model/useWindRoseModel';
import { useWindStore } from '@/entities/WindData';
import { WIND_SPEED_PALETTE } from '@/shared/constants/windPalette';

type PeriodTab = WindRosePeriod;

// sector count is controlled in the model hook

export const WindRosePanel: React.FC = () => {
  const [period, setPeriod] = useState<PeriodTab>('10min');
  const heights = useWindStore((s) => s.heightOrder);
  const [height, setHeight] = useState<number | 'combined' | undefined>(undefined);

  useEffect(() => {
    if (height == null && heights.length > 0) {
      setHeight('combined');
    }
  }, [heights, height]);

  const rose: WindRoseData = useWindRoseModel(period, height);

  const { ref: containerRef, size: containerSize } = useContainerSize();

  return (
    <Card className="w-full h-full md:min-w-[320px] md:w-auto bg-background/60 backdrop-blur border-border/50 flex flex-col min-h-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Wind Rose</CardTitle>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodTab)}>
          <TabsList className="mt-2">
            <TabsTrigger value="2min">2 min</TabsTrigger>
            <TabsTrigger value="10min">10 min</TabsTrigger>
            <TabsTrigger value="1d">1 d</TabsTrigger>
            <TabsTrigger value="1month">1 month</TabsTrigger>
          </TabsList>
        </Tabs>
        {heights.length > 0 && (
          <Tabs
            value={height != null ? String(height) : ''}
            onValueChange={(v) => setHeight(v === 'combined' ? 'combined' : Number(v))}
          >
            <TabsList className="mt-2 flex flex-wrap">
              <TabsTrigger key={'combined'} value={'combined'}>combined</TabsTrigger>
              {heights.map((h) => (
                <TabsTrigger key={h} value={String(h)}>{h} m</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0">
        <div className="w-full h-full" ref={containerRef}>
          {containerSize.height > 0 && containerSize.width > 0 && (
            <RoseSvg data={rose} width={containerSize.width} height={containerSize.height} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// measure container to make SVG responsive to available space
function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, size } as const;
}

const RoseSvg: React.FC<{ data: WindRoseData; width: number; height: number }> = ({ data, width, height }) => {
  const padding = 16;
  const legendWidth = 96;
  const roseSize = Math.max(0, Math.min(height - padding * 2, width - legendWidth - padding * 2));
  const totalWidth = roseSize + legendWidth + padding * 3;
  const totalHeight = roseSize + padding * 2;

  const r = roseSize / 2 - 8;
  const cx = padding + roseSize / 2;
  const cy = padding + roseSize / 2;
  const sectorAngle = (2 * Math.PI) / data.sectors.length;
  const max = Math.max(1, data.maxTotal);

  // categorical color scale for speed bins unified with playback controls
  const colors = useMemo(() => {
    const count = data.binEdges.length;
    // Map bin edges to CSS palette; if more bins than palette, repeat last
    return new Array(count).fill(0).map((_, i) => WIND_SPEED_PALETTE[Math.min(i, WIND_SPEED_PALETTE.length - 1)]);
  }, [data.binEdges.length]);

  const TEXT_COLOR = '#e5e5e5';
  const GRID_COLOR = '#6b7280';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${totalWidth} ${totalHeight}`} preserveAspectRatio="xMidYMid meet">
      {/* grid circles */}
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <circle key={t} cx={cx} cy={cy} r={r * t} fill="none" stroke={GRID_COLOR} strokeWidth={1} opacity={t === 1 ? 0.7 : 0.35} />
      ))}

      {/* compass labels */}
      {['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'].map((lab, i) => {
        const a = -Math.PI / 2 + i * sectorAngle; // start at North
        const tx = cx + Math.cos(a) * (r + 10);
        const ty = cy + Math.sin(a) * (r + 10);
        const anchor = Math.cos(a) > 0.01 ? 'start' : Math.cos(a) < -0.01 ? 'end' : 'middle';
        return (
          <text key={lab} x={tx} y={ty} fontSize={10} textAnchor={anchor} alignmentBaseline="middle" fill={TEXT_COLOR}>{lab}</text>
        );
      })}

      {/* stacked bars per sector (from center outward) */}
      {data.sectors.map((s, i) => {
        const a0 = -Math.PI / 2 + i * sectorAngle - sectorAngle * 0.35; // slightly narrow than full sector
        const a1 = -Math.PI / 2 + i * sectorAngle + sectorAngle * 0.35;

        let inner = 0;
        return (
          <g key={i}>
            {s.binCounts.map((c, bi) => {
              if (!c) return null;
              const frac = (inner + c) / max;
              const r0 = (inner / max) * r;
              const r1 = frac * r;
              inner += c;
              const path = ringSegmentPath(cx, cy, r0, r1, a0, a1);
              return <path key={bi} d={path} fill={colors[bi]} stroke="none" opacity={0.95} />;
            })}
          </g>
        );
      })}

      {/* right-side vertical legend as one stacked bar with speed labels */}
      <g transform={`translate(${padding * 4 + roseSize}, ${padding})`}>
        {data.binEdges.map((edge, i) => {
          const h = (roseSize - padding) / data.binEdges.length + 5;
          const y = (data.binEdges.length - 1 - i) * h; // highest speeds on top
          return (
            <g key={i}>
              <rect x={0} y={y} width={20} height={h - 2} fill={colors[i]} />
              <text x={28} y={y + (h - 2) / 2} fontSize={10} alignmentBaseline="middle" fill={TEXT_COLOR}>
                {i < data.binEdges.length - 1 ? `${edge}–${data.binEdges[i + 1]}` : `${edge}+`} m/s
              </text>
            </g>
          );
        })}
        <text x={0} y={-4} fontSize={10} fill={TEXT_COLOR}>Speed</text>
      </g>
    </svg>
  );
};

function ringSegmentPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number
): string {
  const p0 = polarToXY(cx, cy, r0, a0);
  const p1 = polarToXY(cx, cy, r0, a1);
  const p2 = polarToXY(cx, cy, r1, a1);
  const p3 = polarToXY(cx, cy, r1, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r0} ${r0} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

function polarToXY(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}


