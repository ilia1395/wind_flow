export type WindVector = {
  position: [number, number, number];
  direction: number; // radians around Y
  speed: number; // m/s
};

export type PreparedVector = {
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
};


