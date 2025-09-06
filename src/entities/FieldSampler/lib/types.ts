export type FieldSample = {
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  turbulence?: number;
  gust?: number;
  gustRatio?: number;
  isInterpolated?: boolean;
};

export type FieldSampler = (x: number, y: number, z: number, time: number) => FieldSample;


