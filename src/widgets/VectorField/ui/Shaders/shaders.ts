import { useMemo } from 'react';
 
export function useShaders(particleSize: number, trailDotBaseSize: number) {
    // Particle appearance
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
  uSize: { value: particleSize },
  uViewportHeight: { value: 400.0 },
  uFov: { value: 45 * Math.PI / 180 },
  uOpacity: { value: 1.0 },
  }), [particleSize]);


  // Trails appearance
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
  uSize: { value: trailDotBaseSize },
  uViewportHeight: { value: 400.0 },
  uFov: { value: 45 * Math.PI / 180 },
  uOpacity: { value: 1.0 },
  }), [trailDotBaseSize]);


  return { particleVertex, particleFragment, particleUniforms, trailPointVertex, trailPointFragment, trailPointUniforms };
} 

