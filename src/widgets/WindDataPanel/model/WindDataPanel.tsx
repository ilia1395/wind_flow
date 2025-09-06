import { useMemo, useState, useEffect } from "react";

import { WindDataPanelView } from "../ui/WindDataPanelView";
import { useWindStore } from "@/entities/WindData";
import { computeWindMetrics } from '../lib/metrics';

import type { Mode } from "../types/panelTypes";

export function WindDataPanel () {
  const heights = useWindStore((s) => s.heightOrder);
  const framesByHeight = useWindStore((s) => s.framesByHeight);
  const frameIndex = useWindStore((s) => s.frameIndex);

  const defaultBottom = useMemo(() => (heights.length ? Math.min(...heights) : undefined), [heights]);
  const defaultTop = useMemo(() => (heights.length ? Math.max(...heights) : undefined), [heights]);

  const [bottomH, setBottomH] = useState<number | undefined>(defaultBottom);
  const [topH, setTopH] = useState<number | undefined>(defaultTop);
  const { realtime: rt, avg10: av } = useMemo(() => computeWindMetrics(framesByHeight, heights, frameIndex, bottomH, topH), [framesByHeight, heights, frameIndex, bottomH, topH])

  const [mode, setMode] = useState<Mode>('avg10min');

  useEffect(() => {
    if (heights.length) {
      setBottomH((prev) => (prev == null ? Math.min(...heights) : prev));
      setTopH((prev) => (prev == null ? Math.max(...heights) : prev));
    }
  }, [heights]);

  return (
    <WindDataPanelView 
      mode={mode} 
      setMode={setMode} 
      heights={heights} 
      bottomH={bottomH} 
      setBottomH={setBottomH} 
      topH={topH} 
      setTopH={setTopH} 
      rt={rt} av={av} />
  )
}