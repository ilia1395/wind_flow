import { Reticle } from './reticle.tsx'

export const HitTestHeadset = () => {
  return (
    <>
      <Reticle handedness={'right'} />
      <Reticle handedness={'left'} />
    </>
  )
}