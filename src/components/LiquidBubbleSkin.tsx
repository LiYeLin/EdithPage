import type { RefObject } from 'react'
import '../effects/liquid-material.css'

/** Keep the original glass colors on the animated skin in both modes.
 * Only drag bridges need the shared Liquid filter; hit boxes and icons stay fixed. */
export function LiquidBubbleSkin({ skinRef }: { skinRef: RefObject<HTMLDivElement | null> }) {
  return <div className="bubble-liquid-layer" aria-hidden="true">
    <span className="bubble-liquid-ripple" />
    <div className="bubble-liquid-skin bubble-reflective" ref={skinRef}>
      <span className="reservoir-shine" /><span className="reservoir-glint" />
      <span className="reservoir-rim" /><span className="reservoir-caustic" />
    </div>
  </div>
}
