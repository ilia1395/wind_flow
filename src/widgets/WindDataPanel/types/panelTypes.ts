export type Mode = 'realtime' | 'avg10min';

export type DirStats = {
  meanSpeed: number;
  meanDirDeg: number;
};

export type RealtimeMetrics = {
  speed: number;
  dir: number;
  shearPer100m: number;
  veerDeg: number;
};

export type Avg10Metrics = {
  speed: number;
  dir: number;
  shearPer100m: number;
  veerDeg: number;
};

export type WindMetrics = {
  realtime: RealtimeMetrics;
  avg10: Avg10Metrics;
};