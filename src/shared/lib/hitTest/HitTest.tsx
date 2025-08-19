import { useXR } from '@react-three/xr'
import { HitTestHandheld } from '@shared/lib/hitTest/hit-test-handheld.tsx'
import { HitTestHeadset } from '@shared/lib/hitTest/hit-test-headset'

export const HitTest = () => {
  const isHandheld = useXR((xr) => xr.session?.interactionMode === 'screen-space');
  return isHandheld ? <HitTestHandheld /> : <HitTestHeadset />
}