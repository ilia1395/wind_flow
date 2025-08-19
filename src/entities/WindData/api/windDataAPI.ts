import { type WindFrame, type FramesByHeight } from '../../../shared/lib/types';

// Robust timestamp parser for mast CSV (e.g. "07/08/2014 08:10")
// Tries day-first dd/MM/yyyy, then month-first MM/dd/yyyy when unambiguous
function parseMastTimestampSeconds(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  // dd/MM/yyyy HH:mm[:ss]
  let m = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] ? Number(m[6]) : 0;
    // Heuristic: if day > 12, it's surely day-first; if day <= 12 but month > 12, it's month-first
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      // Interpret as LOCAL time to avoid UTC shift in display
      const ms = new Date(year, month - 1, day, hh, mm, ss).getTime();
      return Math.floor(ms / 1000);
    }
  }
  // MM/dd/yyyy HH:mm[:ss]
  m = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] ? Number(m[6]) : 0;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const ms = new Date(year, month - 1, day, hh, mm, ss).getTime();
      return Math.floor(ms / 1000);
    }
  }
  // Fallback: Date.parse if supported by runtime
  const t = Date.parse(s);
  if (Number.isFinite(t)) return Math.floor(t / 1000);
  return undefined;
}

// --- Sanitization helpers for CSV values ---
const isFiniteNumber = (n: number) => Number.isFinite(n);
const isSentinel = (n: number) => !Number.isFinite(n) || Math.abs(n) >= 9000;

function sanitizeNumber(n: number | undefined, min: number, max: number, fallback = 0): number {
  if (n == null || !isFiniteNumber(n) || isSentinel(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function sanitizeAngleDeg(n: number | undefined): number {
  if (n == null || !isFiniteNumber(n) || isSentinel(n)) return 0;
  let d = n % 360;
  if (d < 0) d += 360;
  return d;
}

// Minimal CSV ingestion (expects header with columns matching WindFrame keys, case-insensitive)
export async function parseWindCsv(text: string): Promise<WindFrame[]> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const idx = {
    time: col('time'),
    directionDeg: col('directionDeg'),
    horizSpeedMean: col('horizSpeedMean'),
    horizSpeedStd: col('horizSpeedStd'),
    vertSpeedMean: col('vertSpeedMean'),
    vertSpeedStd: col('vertSpeedStd'),
    horizVariance: col('horizVariance'),
    horizMin: col('horizMin'),
    turbulenceIntensity: col('turbulenceIntensity'),
  };

  const frames: WindFrame[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(',');
    const rawDir = Number(parts[idx.directionDeg] ?? '');
    const rawHS = Number(parts[idx.horizSpeedMean] ?? '');
    const rawHSstd = Number(parts[idx.horizSpeedStd] ?? '');
    const rawVS = Number(parts[idx.vertSpeedMean] ?? '');
    const rawVSstd = Number(parts[idx.vertSpeedStd] ?? '');
    const rawTI = parts[idx.turbulenceIntensity] != null ? Number(parts[idx.turbulenceIntensity]) : undefined;

    const f: WindFrame = {
      time: Number(parts[idx.time] ?? i - 1) || i - 1,
      directionDeg: sanitizeAngleDeg(rawDir),
      horizSpeedMean: sanitizeNumber(rawHS, 0, 75, 0),
      horizSpeedStd: sanitizeNumber(rawHSstd, 0, 30, 0),
      vertSpeedMean: sanitizeNumber(rawVS, -30, 30, 0),
      vertSpeedStd: sanitizeNumber(rawVSstd, 0, 30, 0),
      horizVariance: idx.horizVariance >= 0 ? sanitizeNumber(Number(parts[idx.horizVariance]), 0, 120, 0) : undefined,
      horizMin: idx.horizMin >= 0 ? sanitizeNumber(Number(parts[idx.horizMin]), 0, 75, 0) : undefined,
      turbulenceIntensity: sanitizeNumber(rawTI, 0, 3, 0),
    };
    frames.push(f);
  }
  return frames;
}

// Parse the provided mast CSV with columns repeated per height.
// Extracts per-height arrays for the requested heights (default 148, 90, 50, 35, 15).
export function parseMastCsvByHeights(
  text: string,
  heights: number[] = [],
): { framesByHeight: FramesByHeight; heights: number[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return { framesByHeight: {}, heights };

  // The first line is metadata in sample; actual header is the second line.
  const headerLineIndex = lines[0].toLowerCase().includes('csv converter') ? 1 : 0;
  const header = lines[headerLineIndex].split(',').map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());

  const idxTime = lower.findIndex((h) => h.startsWith('time and date'));
  if (idxTime === -1) throw new Error('Time and Date column not found');

  // Detect heights automatically if not provided by caller
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

  const colMap: Record<number, { dir: number; hs: number; vs: number; ti: number; hsStd: number; vsStd?: number; hMax?: number }> = {} as any;
  detectedHeights.forEach((h) => {
    colMap[h] = {
      dir: colFor(h, 'Wind Direction (deg)'),
      hs: colFor(h, 'Horizontal Wind Speed (m/s)'),
      vs: colFor(h, 'Vertical Wind Speed (m/s)'),
      ti: colFor(h, 'TI'),
      hsStd: colFor(h, 'Horizontal Std.Dev. (m/s)'),
      hMax: colFor(h, 'Horizontal Max (m/s)'),
      vsStd: -1, // not available in provided columns
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
