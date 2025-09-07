export interface WindFrame {
  time: number;
  timeString?: string;
  directionDeg: number;
  horizSpeedMean: number;
  horizSpeedStd: number;
  horizSpeedMax?: number;
  vertSpeedMean: number;
  vertSpeedStd: number;
  horizVariance?: number;
  horizMin?: number;
  turbulenceIntensity?: number;
}

export type FramesByHeight = Record<number, WindFrame[]>;

export interface TimelineInfo {
  length: number;
  representativeHeight: number;
}


