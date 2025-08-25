import React from 'react';
import * as THREE from 'three';
import { Billboard, Text } from '@react-three/drei';

type Props = {
  text?: string;
  y: number;
};

export const StatusBillboard: React.FC<Props> = ({ text, y }) => {
  if (!text) return null;
  return (
    <Billboard position={[0, y, 0]} follow>
      <mesh renderOrder={2}>
        <planeGeometry args={[112, 8]} />
        <meshBasicMaterial color={new THREE.Color('black')} transparent opacity={0.15} />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={3}
        color="white"
        outlineWidth={0.02}
        outlineColor="black"
        maxWidth={128.0}
        lineHeight={1.15}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {text}
      </Text>
    </Billboard>
  );
};


