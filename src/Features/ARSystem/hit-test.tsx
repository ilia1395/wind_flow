import { useXR } from '@react-three/xr';
import { HitTestHandheld } from './hit-test-handheld';
import { HitTestHeadset } from './hit-test-headset';

export const HitTest = () => {
    const isHandheld = useXR((xr) => xr.session?.interactionMode === 'screen-space');
    return isHandheld ? <HitTestHandheld /> : <HitTestHeadset />;
}