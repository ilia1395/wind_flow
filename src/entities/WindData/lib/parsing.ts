import { parseMastTimestampSeconds, sanitizeAngleDeg, sanitizeNumber } from '@shared/lib/math/parsing';
import type { FramesByHeight, WindFrame } from '../types/types';

// Parse the provided mast CSV with columns repeated per height.
// Extracts per-height arrays and returns detected heights.
export function parseMastCsvByHeights(
  text: string,
  heights: number[] = [],
): { framesByHeight: FramesByHeight; heights: number[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return { framesByHeight: {}, heights };

  const headerLineIndex = lines[0].toLowerCase().includes('csv converter') ? 1 : 0;
  const header = lines[headerLineIndex].split(',').map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());

  const idxTime = lower.findIndex((h) => h.startsWith('time and date'));
  if (idxTime === -1) throw new Error('Time and Date column not found');

  let detectedHeights: number[] = heights ?? [];
  if (!heights || heights.length === 0) {
    const heightSet = new Set<number>();
    for (const h of lower) {
      const m = h.match(/\bat\s*(\d+)m\s*$/);
      if (m) {
        const val = Number(m[1]);
        if (Number.isFinite(val)) heightSet.add(val);
      }
    }
    detectedHeights = Array.from(heightSet).sort((a, b) => a - b);
  }

  const colFor = (height: number, label: string) =>
    lower.findIndex((h) => h === `${label.toLowerCase()} at ${height}m`);

  const colMap: Record<number, { dir: number; hs: number; vs: number; ti: number; hsStd: number; vsStd?: number; hMax?: number }> = {};
  detectedHeights.forEach((h) => {
    colMap[h] = {
      dir: colFor(h, 'Wind Direction (deg)'),
      hs: colFor(h, 'Horizontal Wind Speed (m/s)'),
      vs: colFor(h, 'Vertical Wind Speed (m/s)'),
      ti: colFor(h, 'TI'),
      hsStd: colFor(h, 'Horizontal Std.Dev. (m/s)'),
      hMax: colFor(h, 'Horizontal Max (m/s)'),
      vsStd: -1,
    };
  });

  const framesByHeight: FramesByHeight = {};
  detectedHeights.forEach((h) => (framesByHeight[h] = []));

  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const parts = raw.split(',');
    const timeStr = parts[idxTime]?.trim();
    const timeSec = parseMastTimestampSeconds(timeStr);
    const time = timeSec ?? i - (headerLineIndex + 1);

    for (const h of detectedHeights) {
      const map = colMap[h];
      if (map.dir < 0 || map.hs < 0 || map.vs < 0 || map.ti < 0) continue;
      const directionDeg = sanitizeAngleDeg(Number(parts[map.dir] ?? ''));
      const horizSpeedMean = sanitizeNumber(Number(parts[map.hs] ?? ''), 0, 75, 0);
      const vertSpeedMean = sanitizeNumber(Number(parts[map.vs] ?? ''), -30, 30, 0);
      const turbulenceIntensity = sanitizeNumber(Number(parts[map.ti] ?? ''), 0, 3, 0);
      const horizSpeedStd = map.hsStd >= 0 ? sanitizeNumber(Number(parts[map.hsStd] ?? ''), 0, 30, 0) : 0;
      const horizSpeedMax = map.hMax != null && map.hMax >= 0 ? sanitizeNumber(Number(parts[map.hMax] ?? ''), 0, 100, 0) : undefined;

      const wf: WindFrame = {
        time,
        timeString: timeStr,
        directionDeg,
        horizSpeedMean,
        horizSpeedStd,
        horizSpeedMax,
        vertSpeedMean,
        vertSpeedStd: 0,
        turbulenceIntensity,
      };
      framesByHeight[h].push(wf);
    }
  }

  return { framesByHeight, heights: detectedHeights };
}


