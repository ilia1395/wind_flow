import { Reticle } from './reticle.ts'

export const HitTestHeadset = () => {
  return (
    <>
      <Reticle handedness={'right'} />
      <Reticle handedness={'left'} />
    </>
  )
}