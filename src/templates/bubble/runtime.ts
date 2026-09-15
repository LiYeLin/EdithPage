import { createContext, useContext, type RefObject } from 'react'

// This DOM boundary is private to bubbles; it is not part of the template protocol.
export const BubbleRuntimeContext = createContext<{ root: RefObject<HTMLDivElement | null>; blocked: boolean } | null>(null)
export function useBubbleRuntime() {
  const value = useContext(BubbleRuntimeContext)
  if (!value) throw new Error('Bubble component must be inside BubbleTemplate')
  return value
}
