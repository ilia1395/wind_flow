// Robust timestamp parser for mast CSV (e.g. "07/08/2014 08:10")
// Tries day-first dd/MM/yyyy, then month-first MM/dd/yyyy when unambiguous
export function parseMastTimestampSeconds(raw: string | undefined): number | undefined {
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
export const isFiniteNumber = (n: number) => Number.isFinite(n);
export const isSentinel = (n: number) => !Number.isFinite(n) || Math.abs(n) >= 9000;

export function sanitizeNumber(n: number | undefined, min: number, max: number, fallback = 0): number {
  if (n == null || !isFiniteNumber(n) || isSentinel(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function sanitizeAngleDeg(n: number | undefined): number {
  if (n == null || !isFiniteNumber(n) || isSentinel(n)) return 0;
  let d = n % 360;
  if (d < 0) d += 360;
  return d;
}