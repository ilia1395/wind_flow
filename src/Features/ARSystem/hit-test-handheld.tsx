import { useXRHitTest } from '@react-three/xr'
import { onResults } from './hitTestUtils.ts'
import { Reticle } from './reticle.tsx'

const HitTestHandheld = () => {
  useXRHitTest(onResults.bind(null, 'none'), 'viewer')

  return <Reticle handedness="none" />
}

export { HitTestHandheld }