import { Matrix4, Vector3, Quaternion } from 'three';

export let hitTestMatrices: Partial<Record<XRHandedness, Matrix4 | undefined>> = {}

export function onResults(
    handedness: XRHandedness,
    results: Array<XRHitTestResult>,
    getWorldMatrix: (target: Matrix4, hit: XRHitTestResult) => void,
) {
    if (results && results.length > 0 && results[0]) {
        hitTestMatrices[handedness] ??= new Matrix4();
        getWorldMatrix(hitTestMatrices[handedness], results[0]);
    }
}
