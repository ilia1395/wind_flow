import {
    createXRStore,
    DefaultXRController,
    DefaultXRHand,
    useXRInputSourceStateContext,
    XRHitTest,
    XRSpace
} from '@react-three/xr';
import { onResults} from '@shared/lib/hitTest/hitTestUtils'

export const xr_store = createXRStore({
    domOverlay: true,
    hitTest: true,
    anchors: true,
    layers: false,
    meshDetection: false,
  
    hand: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const state = useXRInputSourceStateContext()
  
      return (
        <>
          <DefaultXRHand />
          <XRSpace space={state.inputSource.targetRaySpace}>
            <XRHitTest onResults={onResults.bind(null, state.inputSource.handedness)} />
          </XRSpace>
        </>
      )
    },
  
    controller: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const state = useXRInputSourceStateContext()
  
      return (
        <>
          <DefaultXRController />
          <XRSpace space={state.inputSource.targetRaySpace}>
            <XRHitTest onResults={onResults.bind(null, state.inputSource.handedness)} />
          </XRSpace>
        </>
      )
    },
  })