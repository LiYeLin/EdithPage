import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange, { passive: true })
  return () => window.removeEventListener('resize', onChange)
}

const getWidth = () => window.innerWidth
const getServerWidth = () => 1440

export function useViewportWidth() {
  return useSyncExternalStore(subscribe, getWidth, getServerWidth)
}
