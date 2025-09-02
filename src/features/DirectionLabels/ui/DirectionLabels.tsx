import React from 'react';
import { TextPlane } from '@/shared/ui/TextPlane';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  bounds: [number, number, number];
  floorY: number;
  labelMargin?: number;
};

export const DirectionLabels: React.FC<Props> = ({ bounds, floorY, labelMargin = 0.8 }) => {
  const QuantizedYawToCamera: React.FC<{
    position: [number, number, number];
    stepRad?: number;
    children: React.ReactNode;
  }> = ({ position, stepRad = -Math.PI / 2, children }) => {
    const groupRef = React.useRef<THREE.Group>(null);
    const { camera } = useThree();
    const step = Math.abs(stepRad);

    useFrame(() => {
      const g = groupRef.current;
      if (!g) return;
      const dx = camera.position.x - g.position.x;
      const dz = camera.position.z - g.position.z;
      const angle = Math.atan2(dx, dz);
      const snapped = Math.round(angle / step) * step;
      g.rotation.y = snapped;
    });

    return (
      <group ref={groupRef} position={position}>
        {children}
      </group>
    );
  };

  return (
    <>
      <QuantizedYawToCamera position={[0, floorY, -bounds[2] - labelMargin]}>
        <TextPlane text="NORTH" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      </QuantizedYawToCamera>
      <QuantizedYawToCamera position={[0, floorY, bounds[2] + labelMargin]}>
        <TextPlane text="SOUTH" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      </QuantizedYawToCamera>
      <QuantizedYawToCamera position={[bounds[0] + labelMargin, floorY, 0]}>
        <TextPlane text="EAST" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      </QuantizedYawToCamera>
      <QuantizedYawToCamera position={[-bounds[0] - labelMargin, floorY, 0]}>
        <TextPlane text="WEST" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      </QuantizedYawToCamera>
    </>
  );
};


