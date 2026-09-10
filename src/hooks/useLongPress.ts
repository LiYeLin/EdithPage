import { useCallback, useEffect, useRef } from 'react'
import type { PointerEventHandler } from 'react'

type LongPressOptions = {
  delay?: number
  moveThreshold?: number
}

export function useLongPress(
  onLongPress: () => void,
  { delay = 500, moveThreshold = 9 }: LongPressOptions = {},
) {
  const timerRef = useRef<number | null>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    originRef.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return

    cancel()
    suppressClickRef.current = false
    originRef.current = { x: event.clientX, y: event.clientY }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      suppressClickRef.current = true
      onLongPress()
      window.navigator.vibrate?.(10)
    }, delay)
  }, [cancel, delay, onLongPress])

  const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    const origin = originRef.current
    if (!origin) return

    const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
    if (distance > moveThreshold) cancel()
  }, [cancel, moveThreshold])

  const consumeLongPressClick = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  return {
    longPressProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
    },
    consumeLongPressClick,
  }
}
