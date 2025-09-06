import * as THREE from 'three';
import type { WindVector, PreparedVector } from '../types/types';

export function prepareVectors(vectors?: WindVector[]): PreparedVector[] {
  return (vectors ?? []).map((v) => {
    const angle = v.direction;
    const vx = Math.cos(angle) * v.speed;
    const vz = Math.sin(angle) * v.speed;
    const vy = 0;
    return { px: v.position[0], py: v.position[1], pz: v.position[2], vx, vy, vz, speed: v.speed };
  });
}

export function computeSliceYs(heightSlices: number[] | undefined, halfY: number) {
  if (!heightSlices || heightSlices.length === 0) return undefined as number[] | undefined;
  const minH = Math.min(...heightSlices);
  const maxH = Math.max(...heightSlices);
  const span = Math.max(1e-6, maxH - minH);
  const ys = [...heightSlices]
    .sort((a, b) => a - b)
    .map((h) => THREE.MathUtils.lerp(-halfY, halfY, (h - minH) / span));
  return ys;
}

export function computeTypicalGapY(sliceYs: number[] | undefined, halfY: number) {
  if (!sliceYs || sliceYs.length < 2) return halfY * 0.25;
  const gaps: number[] = [];
  for (let i = 0; i < sliceYs.length - 1; i += 1) gaps.push(Math.abs(sliceYs[i + 1] - sliceYs[i]));
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return mean;
}


