import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { WindVector, PreparedVector } from '../types/types';
import type { FieldSampler, FieldSample } from '@entities/FieldSampler';

export type Bounds = [number, number, number];

export type UseVectorFieldAppearanceParams = {
	vectors?: WindVector[];
	numParticles: number;
	bounds: Bounds;
	heightSlices?: number[];
	lifespanRangeSeconds?: [number, number];
	interpolatedVerticalBoost?: number;
	pointsRef: React.RefObject<THREE.Points | null>;
	trailDotsRef: React.RefObject<THREE.Points | null>;
};

export type UpdateFrameParams = {
	fieldSampler: FieldSampler | undefined;
	currentTime: number;
	isPlaying: boolean;
	delta: number;
	viewportHeightPx: number;
	fovRadians: number;
};

export const TRAIL_LENGTH = 128;

function prepareVectors(vectors?: WindVector[]): PreparedVector[] {
	return (vectors ?? []).map((v) => {
		const angle = v.direction;
		const vx = Math.cos(angle) * v.speed;
		const vz = Math.sin(angle) * v.speed;
		const vy = 0;
		return { px: v.position[0], py: v.position[1], pz: v.position[2], vx, vy, vz, speed: v.speed };
	});
}

function computeSliceYs(heightSlices: number[] | undefined, halfY: number) {
	if (!heightSlices || heightSlices.length === 0) return undefined as number[] | undefined;
	const minH = Math.min(...heightSlices);
	const maxH = Math.max(...heightSlices);
	const span = Math.max(1e-6, maxH - minH);
	const ys = [...heightSlices]
		.sort((a, b) => a - b)
		.map((h) => THREE.MathUtils.lerp(-halfY, halfY, (h - minH) / span));
	return ys;
}

function computeTypicalGapY(sliceYs: number[] | undefined, halfY: number) {
	if (!sliceYs || sliceYs.length < 2) return halfY * 0.25;
	const gaps: number[] = [];
	for (let i = 0; i < sliceYs.length - 1; i += 1) gaps.push(Math.abs(sliceYs[i + 1] - sliceYs[i]));
	const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
	return mean;
}

export function useVectorFieldAppearance(params: UseVectorFieldAppearanceParams) {
	const { vectors, numParticles, bounds, heightSlices, lifespanRangeSeconds, interpolatedVerticalBoost, pointsRef, trailDotsRef } = params;
	const halfX = bounds[0];
	const halfY = bounds[1];
	const halfZ = bounds[2];

	const preparedVectors = useMemo(() => prepareVectors(vectors), [vectors]);

	const positions = useMemo(() => new Float32Array(numParticles * 3), [numParticles]);
	const colors = useMemo(() => new Float32Array(numParticles * 3), [numParticles]);
	const velocities = useMemo(() => new Float32Array(numParticles * 3), [numParticles]);

	useMemo(() => {
		for (let i = 0; i < numParticles; i += 1) {
			const x = THREE.MathUtils.randFloatSpread(halfX * 2);
			const y = THREE.MathUtils.randFloatSpread(halfY * 2);
			const z = THREE.MathUtils.randFloatSpread(halfZ * 2);
			positions[i * 3 + 0] = x;
			positions[i * 3 + 1] = y;
			positions[i * 3 + 2] = z;
			colors[i * 3 + 0] = 1;
			colors[i * 3 + 1] = 1;
			colors[i * 3 + 2] = 1;
			if (preparedVectors[i]) {
				velocities[i * 3 + 0] = preparedVectors[i].vx;
				velocities[i * 3 + 1] = preparedVectors[i].vy;
				velocities[i * 3 + 2] = preparedVectors[i].vz;
			} else {
				velocities[i * 3 + 0] = 0;
				velocities[i * 3 + 1] = 0;
				velocities[i * 3 + 2] = 0;
			}
		}
		return undefined;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [numParticles, halfX, halfY, halfZ, preparedVectors]);

	const sliceYs = useMemo(() => computeSliceYs(heightSlices, halfY), [heightSlices, halfY]);
	const typicalGapY = useMemo(() => computeTypicalGapY(sliceYs, halfY), [sliceYs, halfY]);

	const trailPositions = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH * 3), [numParticles]);
	const trailColors = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH * 3), [numParticles]);
	const trailOpacities = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH).fill(0), [numParticles]);
	const trailDotSizes = useMemo(() => new Float32Array(numParticles * TRAIL_LENGTH).fill(0), [numParticles]);
	const trailHeadRef = useRef(0);

	const prevSpeed = useMemo(() => new Float32Array(numParticles), [numParticles]);
	const curSpeed = useMemo(() => new Float32Array(numParticles), [numParticles]);
	const deltaSpeed = useMemo(() => new Float32Array(numParticles), [numParticles]);
	const sizes = useMemo(() => new Float32Array(numParticles).fill(1), [numParticles]);
	const opacities = useMemo(() => new Float32Array(numParticles).fill(1), [numParticles]);
	const lifeRemaining = useMemo(() => new Float32Array(numParticles), [numParticles]);
	const angles = useMemo(() => new Float32Array(numParticles), [numParticles]);

	const particleVertex = `
		attribute float aSize;
		attribute float aOpacity;
		attribute float aAngle;
		attribute vec3 color;
		varying vec3 vColor;
		varying float vAngle;
		varying float vOpacity;
		uniform float uSize;
		uniform float uViewportHeight;
		uniform float uFov;
		void main() {
			vColor = color;
			vAngle = aAngle;
			vOpacity = aOpacity;
			vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			float projScale = uViewportHeight / (2.0 * tan(uFov * 0.5));
			float scaleFactor = length(modelMatrix[0].xyz);
			float sizePx = max(1.0, aSize * uSize * projScale / max(scaleFactor, -mvPosition.z));
			gl_PointSize = sizePx;
			gl_Position = projectionMatrix * mvPosition;
		}
	`;
	const particleFragment = `
		varying vec3 vColor;
		varying float vAngle;
		varying float vOpacity;
		uniform float uOpacity;
		void main() {
			vec2 p = gl_PointCoord - vec2(0.5);
			float s = sin(-vAngle);
			float c = cos(-vAngle);
			vec2 pr = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
			float h = 0.2;
			if (pr.y < -h || pr.y > h) discard;
			float halfWidth = (h - pr.y);
			if (abs(pr.x) > halfWidth) discard;
			gl_FragColor = vec4(vColor, uOpacity * vOpacity);
		}
	`;
	const particleUniforms = useMemo(() => ({
		uSize: { value: 1.2 },
		uViewportHeight: { value: 400.0 },
		uFov: { value: 45 * Math.PI / 180 },
		uOpacity: { value: 1.0 },
	}), []);

	const trailPointVertex = `
		attribute float aSize;
		attribute float aOpacity;
		attribute vec3 color;
		varying vec3 vColor;
		varying float vOpacity;
		uniform float uSize;
		uniform float uViewportHeight;
		uniform float uFov;
		void main() {
			vColor = color;
			vOpacity = aOpacity;
			vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			float projScale = uViewportHeight / (2.0 * tan(uFov * 0.5));
			float scaleFactor = length(modelMatrix[0].xyz);
			float sizePx = max(1.0, aSize * uSize * projScale / max(scaleFactor, -mvPosition.z));
			gl_PointSize = sizePx;
			gl_Position = projectionMatrix * mvPosition;
		}
	`;
	const trailPointFragment = `
		varying vec3 vColor;
		varying float vOpacity;
		uniform float uOpacity;
		void main() {
			vec2 c = gl_PointCoord - vec2(0.5);
			float r = dot(c, c);
			if (r > 0.25) discard;
			gl_FragColor = vec4(vColor, uOpacity * vOpacity);
		}
	`;
	const trailPointUniforms = useMemo(() => ({
		uSize: { value: 0.5 },
		uViewportHeight: { value: 400.0 },
		uFov: { value: 45 * Math.PI / 180 },
		uOpacity: { value: 1.0 },
	}), []);

	const lifeMin = Math.max(0.5, lifespanRangeSeconds?.[0] ?? 8);
	const lifeMax = Math.max(lifeMin, lifespanRangeSeconds?.[1] ?? 12);
	const initializedRef = useRef(false);

	function updateFrame({ fieldSampler, currentTime, isPlaying, delta, viewportHeightPx, fovRadians }: UpdateFrameParams) {
		particleUniforms.uViewportHeight.value = viewportHeightPx;
		particleUniforms.uFov.value = fovRadians;
		trailPointUniforms.uViewportHeight.value = viewportHeightPx;
		trailPointUniforms.uFov.value = fovRadians;

		if (!isPlaying) {
			velocities.fill(0);
			return;
		}
		if (!initializedRef.current) {
			for (let i = 0; i < numParticles; i += 1) {
				lifeRemaining[i] = THREE.MathUtils.lerp(lifeMin, lifeMax, Math.random());
			}
			initializedRef.current = true;
		}

		const pos = positions;
		const col = colors;
		const vel = velocities;

		for (let i = 0; i < pos.length; i += 3) {
			let x = pos[i + 0];
			let y = pos[i + 1];
			let z = pos[i + 2];

			const s: FieldSample = fieldSampler ? fieldSampler(x, y, z, currentTime) : { vx: 0, vy: 0, vz: 0, speed: 0, isInterpolated: false };

			const particleIndex = i / 3;
			curSpeed[particleIndex] = s.speed;
			const ds = s.speed - prevSpeed[particleIndex];
			deltaSpeed[particleIndex] = ds;
			prevSpeed[particleIndex] = s.speed;

			const tau = 0.8;
			const k = 1 / tau;
			const isInterpolated = Boolean(s.isInterpolated);
			const vyTarget = isInterpolated ? s.vy * (interpolatedVerticalBoost ?? 1) : s.vy;
			vel[i+0] += (s.vx - vel[i+0]) * k * delta;
			vel[i+1] += (vyTarget - vel[i+1]) * k * delta;
			vel[i+2] += (s.vz - vel[i+2]) * k * delta;

			x += vel[i + 0] * delta;
			y += vel[i + 1] * delta;
			z += vel[i + 2] * delta;

			if (x < -halfX) x += halfX * 2; else if (x > halfX) x -= halfX * 2;
			if (y < -halfY) y += halfY * 2; else if (y > halfY) y -= halfY * 2;
			if (z < -halfZ) z += halfZ * 2; else if (z > halfZ) z -= halfZ * 2;

			pos[i + 0] = x;
			pos[i + 1] = y;
			pos[i + 2] = z;

			if (isInterpolated) {
				col[i + 0] = 0.8;
				col[i + 1] = 0.8;
				col[i + 2] = 0.8;
			} else {
				const tSpeed = Math.max(0, Math.min(1, s.speed / 20));
				const r = 0.4 + 0.6 * tSpeed;
				const g = 0.9 - 0.7 * tSpeed;
				const b = 1 - 0.8 * tSpeed;
				col[i + 0] = r;
				col[i + 1] = g;
				col[i + 2] = b;
			}

			const ax = vel[i + 0];
			const az = vel[i + 2];
			const angle = (Math.abs(ax) + Math.abs(az)) > 1e-6 ? Math.atan2(az, ax) : 0.0;
			angles[particleIndex] = angle;

			const isInterpolated2 = Boolean(s.isInterpolated);
			opacities[particleIndex] = isInterpolated2 ? 0.1 : 1.0;

			lifeRemaining[particleIndex] -= delta;
			if (lifeRemaining[particleIndex] <= 0) {
				pos[particleIndex * 3 + 0] = THREE.MathUtils.randFloatSpread(halfX * 2);
				if (sliceYs && sliceYs.length > 0) {
					const favorMeasured = Math.random() < 0.7;
					if (favorMeasured) {
						const idx = Math.floor(Math.random() * sliceYs.length);
						const baseY = sliceYs[idx];
						const band = Math.min(1.5, Math.max(0.2, typicalGapY * 0.2));
						const jitter = THREE.MathUtils.randFloatSpread(band * 2);
						pos[particleIndex * 3 + 1] = THREE.MathUtils.clamp(baseY + jitter, -halfY, halfY);
					} else {
						pos[particleIndex * 3 + 1] = THREE.MathUtils.randFloatSpread(halfY * 2);
					}
				} else {
					pos[particleIndex * 3 + 1] = THREE.MathUtils.randFloatSpread(halfY * 2);
				}
				pos[particleIndex * 3 + 2] = THREE.MathUtils.randFloatSpread(halfZ * 2);
				vel[i + 0] = 0;
				vel[i + 1] = 0;
				vel[i + 2] = 0;
				lifeRemaining[particleIndex] = THREE.MathUtils.lerp(lifeMin, lifeMax, Math.random());
			}
		}

		const decayPerSecond = 1.0;
		const decay = Math.pow(decayPerSecond, delta * 1);

		for (let c = 0; c < trailColors.length; c += 1) {
			trailColors[c] *= decay;
		}
		for (let a = 0; a < trailOpacities.length; a += 1) {
			trailOpacities[a] *= decay;
		}

		const head = trailHeadRef.current;
		const headBaseFloat = head * numParticles * 3;

		for (let i = 0; i < numParticles; i += 1) {
			const pi = i * 3;
			const hi = headBaseFloat + pi;

			trailPositions[hi + 0] = positions[pi + 0];
			trailPositions[hi + 1] = positions[pi + 1];
			trailPositions[hi + 2] = positions[pi + 2];

			const sNow = curSpeed[i];
			const isInterpolatedTrail = opacities[i] < 1.0;
			let intensity = 0.4;
			if (isInterpolatedTrail) {
				trailColors[hi + 0] = 0.8;
				trailColors[hi + 1] = 0.8;
				trailColors[hi + 2] = 0.8;
				intensity = 0.4;
			} else {
				intensity = 0.5 * Math.max(0.1, Math.min(1, sNow / 20)) + 0.5 * Math.max(0.1, Math.min(1, sNow / 20));
				trailColors[hi + 0] = intensity;
				trailColors[hi + 1] = 0.6 * (1 - intensity * 0.5);
				trailColors[hi + 2] = 0.8 * (1 - intensity);
			}

			const vertexIndex = head * numParticles + i;
			const baseSize = 0.075;
			const boost = 0.8 * intensity;
			trailDotSizes[vertexIndex] = baseSize + boost;
			trailOpacities[vertexIndex] = opacities[i];
		}
		trailHeadRef.current = (head + 1) % TRAIL_LENGTH;

		if (pointsRef.current) {
			const geometry = pointsRef.current.geometry as THREE.BufferGeometry;
			(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
			(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
			(geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
			(geometry.getAttribute('aAngle') as THREE.BufferAttribute).needsUpdate = true;
			(geometry.getAttribute('aOpacity') as THREE.BufferAttribute).needsUpdate = true;
		}

		if (trailDotsRef.current) {
			const geometry = trailDotsRef.current.geometry as THREE.BufferGeometry;
			(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
			(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
			(geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
			const aOpacityAttr = geometry.getAttribute('aOpacity') as THREE.BufferAttribute | undefined;
			if (aOpacityAttr) aOpacityAttr.needsUpdate = true;
		}
	}

	return {
		positions,
		colors,
		velocities,
		angles,
		sizes,
		opacities,
		trailPositions,
		trailColors,
		trailOpacities,
		trailDotSizes,
		particleVertex,
		particleFragment,
		particleUniforms,
		trailPointVertex,
		trailPointFragment,
		trailPointUniforms,
		updateFrame,
	};
}


