import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';

function useTextTexture(label: string): THREE.Texture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    const width = 512;
    const height = 256;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    ctx.font = 'bold 120px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(label, width / 2, height / 2);
    ctx.fillStyle = 'white';
    ctx.fillText(label, width / 2, height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [label]);
}

export const TextPlane: React.FC<{
  text: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
  billboard?: boolean;
}> = ({ text, position, rotation = [0, 0, 0], size = [1.8, 0.9], billboard = false }) => {
  const tex = useTextTexture(text);
  if (billboard) {
    return (
      <Billboard position={position} follow>
        <mesh renderOrder={1}>
          <planeGeometry args={size} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} />
        </mesh>
      </Billboard>
    );
  }
  return (
    <mesh position={position} rotation={rotation} renderOrder={1}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
};


