import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Module } from '../../../types'
import type { CapacityValidator } from '../../types'
import { getWorkspaceLayout, type WorkspaceSize } from '../utils/workspaceLayout'

export function useWorkspaceLayout(modules: readonly Module[], frozen: boolean, onValidatorChange?: (validator: CapacityValidator | null) => void) {
  const stage = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<WorkspaceSize>({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (frozen) return
    const measure = () => {
      const element = stage.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      // Document position, not scroll-relative position: scrolling an overfull page must not increase capacity.
      const next = { width: Math.floor(rect.width), height: Math.max(0, Math.floor(window.innerHeight - rect.top - window.scrollY - 56)) }
      setSize(current => current.width === next.width && current.height === next.height ? current : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (stage.current) observer.observe(stage.current)
    const main = stage.current?.closest('main')
    if (main) observer.observe(main)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [frozen])
  const [snapshot, setSnapshot] = useState(() => ({ modules, size, layout: getWorkspaceLayout(modules, size) }))
  let { layout } = snapshot
  // Keep the previous result as render state so concurrent renders cannot overwrite a ref.
  if (snapshot.modules !== modules || snapshot.size !== size) {
    layout = getWorkspaceLayout(modules, size, snapshot.layout)
    setSnapshot({ modules, size, layout })
  }
  useEffect(() => {
    onValidatorChange?.(nextModules => {
      if (!size.width || !size.height) return '正在测量可用空间，请稍后再试。'
      return getWorkspaceLayout(nextModules, size, layout).fits ? null : '当前窗口空间不足，请减少内容或扩大窗口。'
    })
    return () => onValidatorChange?.(null)
  }, [size, layout, onValidatorChange])
  return { stage, layout, measured: size.width > 0 && size.height > 0 }
}
