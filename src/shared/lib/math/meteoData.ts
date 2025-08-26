export function degToRad(deg: number) {
    return (deg * Math.PI) / 180;
}

export function meteoDirDegToRadXZ(deg: number) {
    // Meteorological direction points FROM the direction (e.g., 0 = from North towards South).
    // Convert to a flow vector pointing TO the movement direction in XZ plane.
    const rad = degToRad(deg);
    const flowAngle = rad + Math.PI; // reverse
    return flowAngle;
  }