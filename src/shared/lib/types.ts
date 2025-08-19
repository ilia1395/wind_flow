
// data type for input data from LiDAR
export type WindFrame = {
  // timestamp or frame index
  time: number;
  // original timestamp string if available (to avoid tz shifts in display)
  timeString?: string;
  // degrees (meteorological): 0/360 from North, clockwise. We'll convert to radians in XZ plane.
  directionDeg: number;
  // horizontal wind speed mean (m/s)
  horizSpeedMean: number;
  // horizontal wind speed std dev (m/s)
  horizSpeedStd: number;
  // horizontal wind speed max (m/s)
  horizSpeedMax?: number;
  // vertical wind speed mean (m/s)
  vertSpeedMean: number;
  // vertical wind speed std dev (m/s)
  vertSpeedStd: number;
  // horizontal variance (m^2/s^2)
  horizVariance?: number;
  // horizontal min (m/s)
  horizMin?: number;
  // turbulence intensity (0..1 typically; can be >1 in extreme cases)
  turbulenceIntensity?: number;
};

// particle system types
type FieldSample = {
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  turbulence?: number;
  gust?: number; // m/s above mean
  gustRatio?: number; // (max-mean)/mean
};

export type FieldSampler = (x: number, y: number, z: number, time: number) => FieldSample;

// wind data frames
export type FramesByHeight = Record<number, WindFrame[]>;
