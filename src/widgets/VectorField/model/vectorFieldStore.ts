import { create } from 'zustand';

type VectorFieldConfig = {
  numParticles: number;
  trailLength: number;
  lifespan: [number, number];
  interpolatedVyBoost: number;
  trailDecayPerSecond: number;
  particleSize: number;
  trailDotBaseSize: number;
  favorMeasured: number; // 0..1
  colorBySpeed: boolean;
  interpolatedColor: [number, number, number];
  interpolatedOpacity: number;
};

type VectorFieldActions = {
  setNumParticles: (n: number) => void;
  setTrailLength: (n: number) => void;
  setLifespan: (a: [number, number]) => void;
  setVyBoost: (x: number) => void;
  setTrailDecay: (x: number) => void;
  setParticleSize: (x: number) => void;
  setTrailDotBaseSize: (x: number) => void;
  setFavorMeasured: (x: number) => void;
  setColorBySpeed: (x: boolean) => void;
  setInterpolatedColor: (rgb: [number, number, number]) => void;
  setInterpolatedOpacity: (x: number) => void;
};

export type VectorFieldStore = VectorFieldConfig & VectorFieldActions;

export const useVectorFieldStore = create<VectorFieldStore>((set) => ({
  numParticles: 1000,
  trailLength: 128,
  lifespan: [10, 14],
  interpolatedVyBoost: 2.0,
  trailDecayPerSecond: 1.0,
  particleSize: 1.2,
  trailDotBaseSize: 0.075,
  favorMeasured: 0.9,
  colorBySpeed: true,
  interpolatedColor: [0.8, 0.8, 0.8],
  interpolatedOpacity: 0.1,

  setNumParticles: (n) => set({ numParticles: Math.max(1, Math.floor(n)) }),
  setTrailLength: (n) => set({ trailLength: Math.max(1, Math.floor(n)) }),
  setLifespan: (a) => set({ lifespan: [Math.max(0.1, a[0]), Math.max(a[0], a[1])] }),
  setVyBoost: (x) => set({ interpolatedVyBoost: Math.max(0, x) }),
  setTrailDecay: (x) => set({ trailDecayPerSecond: Math.max(0, x) }),
  setParticleSize: (x) => set({ particleSize: Math.max(0.01, x) }),
  setTrailDotBaseSize: (x) => set({ trailDotBaseSize: Math.max(0.001, x) }),
  setFavorMeasured: (x) => set({ favorMeasured: Math.min(1, Math.max(0, x)) }),
  setColorBySpeed: (x) => set({ colorBySpeed: !!x }),
  setInterpolatedColor: (rgb) => set({ interpolatedColor: rgb }),
  setInterpolatedOpacity: (x) => set({ interpolatedOpacity: Math.min(1, Math.max(0, x)) }),
}));

// Selectors
export const selectConfig = (s: VectorFieldStore) => s;
export const selectNumParticles = (s: VectorFieldStore) => s.numParticles;
export const selectTrailLength = (s: VectorFieldStore) => s.trailLength;
export const selectLifespan = (s: VectorFieldStore) => s.lifespan;
export const selectVyBoost = (s: VectorFieldStore) => s.interpolatedVyBoost;
export const selectTrailDecay = (s: VectorFieldStore) => s.trailDecayPerSecond;
export const selectParticleSize = (s: VectorFieldStore) => s.particleSize;
export const selectTrailDotBaseSize = (s: VectorFieldStore) => s.trailDotBaseSize;
export const selectFavorMeasured = (s: VectorFieldStore) => s.favorMeasured;
export const selectColorBySpeed = (s: VectorFieldStore) => s.colorBySpeed;
export const selectInterpolatedColor = (s: VectorFieldStore) => s.interpolatedColor;
export const selectInterpolatedOpacity = (s: VectorFieldStore) => s.interpolatedOpacity;


