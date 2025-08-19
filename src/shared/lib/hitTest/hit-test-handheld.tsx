import { useXRHitTest } from '@react-three/xr'
import { onResults } from '@shared/lib/hitTest/hitTestUtils'
import { Reticle } from '@shared/ui/reticle.tsx'

export const HitTestHandheld = () => {
  useXRHitTest(onResults.bind(null, 'none'), 'viewer')

  return <Reticle handedness="none" />
}