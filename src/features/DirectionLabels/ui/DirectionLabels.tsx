import React from 'react';
import { TextPlane } from '@/shared/ui/TextPlane';

type Props = {
  bounds: [number, number, number];
  floorY: number;
  labelMargin?: number;
};

export const DirectionLabels: React.FC<Props> = ({ bounds, floorY, labelMargin = 0.8 }) => {
  return (
    <>
      <TextPlane text="NORTH" position={[0, floorY, -bounds[2] - labelMargin]} rotation={[-Math.PI / 2, 0, 0]} />
      <TextPlane text="SOUTH" position={[0, floorY, bounds[2] + labelMargin]} rotation={[-Math.PI / 2, 0, 0]} />
      <TextPlane text="EAST" position={[bounds[0] + labelMargin, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <TextPlane text="WEST" position={[-bounds[0] - labelMargin, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    </>
  );
};


