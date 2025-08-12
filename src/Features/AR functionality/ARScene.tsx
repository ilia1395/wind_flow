import { Canvas } from '@react-three/fiber'
import { 
    createXRStore,
    DefaultXRHand,
    IfInSessionMode,
    useXRInputSourceStateContext,
    XR,
    XRDomOverlay,
    XRHitTest,
    XRSpace 
} from "@react-three/xr";

import { onResults } from "./hitTestUtils";
import { HitTest } from './hit-test';
import { Suspense } from 'react';

const xr_store = createXRStore({
    domOverlay: true,
    hitTest: true,
    anchors: true,
    layers: false,
    meshDetection: false,
    planeDetection: false,

    hand: () => {
        const state = useXRInputSourceStateContext();

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
        const state = useXRInputSourceStateContext();

        return (
            <>
                <XRSpace space={state.inputSource.targetRaySpace}>
                    <XRHitTest onResults={onResults.bind(null, state.inputSource.handedness)} />
                </XRSpace>
            </>    
        )
    }
});

export function AnchoringSystem() {
    return (
        <>
            <button onClick={(() => xr_store.enterAR())}>Enter AR</button>
            <Canvas>
                <XR store={xr_store}>
                    <directionalLight position={[1, 2, 1]} />
                    <ambientLight />

                    <IfInSessionMode allow={'immersive-ar'}>
                        <HitTest />
                        <XRDomOverlay>
                            <button onClick={() => xr_store.getState().session?.end()}>Exit AR</button>
                        </XRDomOverlay>
                    </IfInSessionMode>
                </XR>
            </Canvas>
            
        </>
    )
}