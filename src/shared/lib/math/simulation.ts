// Lightweight pseudo-noise for turbulence (deterministic, cheap)
export function hashNoise(x: number, y: number, z: number, t: number): number {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + t * 0.151) * 43758.5453;
    return s - Math.floor(s);
  }