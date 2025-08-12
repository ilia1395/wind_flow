import { useXRHitTest } from '@react-three/xr'
import { onResults } from './hitTestUtils.ts'
import { Reticle } from './reticle.ts'

const HitTestHandheld = () => {
  useXRHitTest(onResults.bind(null, 'none'), 'viewer')

  return <Reticle handedness="none" />
}

export { HitTestHandheld }