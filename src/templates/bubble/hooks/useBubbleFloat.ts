import { useMotionValue, type MotionStyle, type MotionValue } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type RefCallback,
} from 'react'

export type BubbleFloatContextValue = {
  register: (id: string, element: HTMLElement, x: MotionValue<number>, y: MotionValue<number>) => () => void
}

export const BubbleFloatContext = createContext<BubbleFloatContextValue | null>(null)

export function useBubbleFloat(id: string): {
  floatRef: RefCallback<HTMLDivElement>
  floatStyle: MotionStyle
} {
  const context = useContext(BubbleFloatContext)
  const element = useRef<HTMLDivElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const floatRef = useCallback<RefCallback<HTMLDivElement>>((node) => { element.current = node }, [])

  useEffect(() => {
    if (!context || !element.current) return
    return context.register(id, element.current, x, y)
  }, [context, id, x, y])

  const floatStyle = useMemo<MotionStyle>(() => ({ x, y }), [x, y])
  return { floatRef, floatStyle }
}
