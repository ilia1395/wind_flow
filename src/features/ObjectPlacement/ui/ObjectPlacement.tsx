import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useXR, useXRInputSourceEvent, useXRHitTest } from '@react-three/xr';
import { hitTestMatrices, onResults } from '@/shared/lib/hitTest/hitTestUtils';
import { Reticle } from '@/shared/ui/reticle';

type AnchorPose = { position: THREE.Vector3; quaternion: THREE.Quaternion };

type Props = {
  children: React.ReactNode;
  scale?: number;
  // If true, hide children in AR until placed via select
  requirePlacementInAR?: boolean;
  // Default anchor used when not in AR (or when clearing)
  defaultAnchor?: AnchorPose;
};

export const ObjectPlacement: React.FC<Props> = ({
  children,
  scale = 1,
  requirePlacementInAR = true,
  defaultAnchor,
}) => {
  const xr = useXR();
  const isAR = !!xr.session && (xr.session as any).mode === 'immersive-ar';
  const isHandheld = useXR((xr) => xr.session?.interactionMode === 'screen-space');

  const identityAnchor = useMemo<AnchorPose>(() => ({
    position: new THREE.Vector3(0, 0, 0),
    quaternion: new THREE.Quaternion(),
  }), []);

  const [anchor, setAnchor] = useState<AnchorPose | undefined>(undefined);
  const [placed, setPlaced] = useState<boolean>(false);

  // Ensure anchor defaults when not in AR
  useEffect(() => {
    if (!isAR) {
      setAnchor(defaultAnchor ?? identityAnchor);
      setPlaced(true);
    } else if (requirePlacementInAR) {
      // entering AR: wait for placement
      setPlaced(false);
    }
  }, [isAR, requirePlacementInAR, defaultAnchor, identityAnchor]);

  // Handle select to place in AR
  useXRInputSourceEvent(
    'all',
    'select',
    (e) => {
      if (!isAR) return;
      if (placed) return;
      const matrix = hitTestMatrices[e.inputSource.handedness];
      if (matrix) {
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        matrix.decompose(position, quaternion, new THREE.Vector3());
        setAnchor({ position, quaternion });
        setPlaced(true);
      }
    },
    [isAR, placed]
  );

  // For handheld AR, drive hit test updates from viewer space
  useXRHitTest(onResults.bind(null, 'none'), 'viewer');

  const showReticle = isAR && requirePlacementInAR && !placed;
  const pose = anchor ?? (defaultAnchor ?? identityAnchor);

  return (
    <>
      {showReticle && (
        isHandheld ? (
          <Reticle handedness={'none'} />
        ) : (
          <>
            <Reticle handedness={'right'} />
            <Reticle handedness={'left'} />
          </>
        )
      )}
      {(isAR ? placed || !requirePlacementInAR : true) && (
        <group position={pose.position} quaternion={pose.quaternion} scale={scale}>
          {children}
        </group>
      )}
    </>
  );
};


