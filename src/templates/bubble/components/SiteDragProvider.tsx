import type { TemplateInteractionState } from '../../types'
import { useBubbleRuntime } from '../runtime'
import {
  DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, MouseSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useMotionPreference } from '../../../hooks/useMotionPreference'
import { createPortal } from 'react-dom'
import { bubbleCollision, categoryKeyboardCoordinates } from '../drag/collision'
import { ArrivalFeedbackContext, PendingArrivalContext, SiteDragEnabledContext } from '../drag/context'
import type { Module, Site } from '../../../types'
import type { SiteMove } from '../../../utils/moveSite'
import { SiteIcon } from '../../../components/SiteIcon'
import { LiquidDragLayer } from './LiquidDragLayer'
import { LiquidEffectBoundary } from './LiquidEffectBoundary'
import { findSiteTile, supportsLiquid, visibleIcon } from '../drag/liquidDom'
import { rectCenter, type Point } from '../drag/liquidGeometry'
import { LiquidSession, type Arrival } from '../drag/liquidSession'
import { createLiquidVisual, type LiquidVisual } from '../drag/liquidVisual'

function eventPoint(event: Event): Point | null {
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY }
  if ('touches' in event) {
    const touch = (event as TouchEvent).touches[0]
    if (touch) return { x: touch.clientX, y: touch.clientY }
  }
  return null
}

type DragPreview = { site: Site; width: number; height: number; iconSize: number }
type SiteDragProviderProps = {
  children: ReactNode
  modules: readonly Module[]
  enabled: boolean
  onMove: (move: SiteMove) => boolean
  onInteractionStateChange: (state: TemplateInteractionState) => void
}

export function SiteDragProvider({ children, modules, enabled, onMove, onInteractionStateChange }: SiteDragProviderProps) {
  const { root: templateRoot } = useBubbleRuntime()
  const mounted = useRef(false)
  const interaction = useRef<TemplateInteractionState>({ dragging: false, settling: false })
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({})
  const report = useCallback((patch: Partial<TemplateInteractionState>) => {
    const next = { ...interaction.current, ...patch }
    if (next.dragging === interaction.current.dragging && next.settling === interaction.current.settling) return
    interaction.current = next
    onInteractionStateChange(next)
  }, [onInteractionStateChange])
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const [visual, setVisual] = useState<LiquidVisual | null>(null)
  const [pending, setPending] = useState<Arrival | null>(null)
  const [feedback, setFeedback] = useState<Arrival | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputActive = useRef(false)
  const visualRef = useRef<LiquidVisual | null>(null)
  const lastPointer = useRef<Point | null>(null)
  const focusFrame = useRef(0)
  const movedRef = useRef(false)
  const keyboardDragRef = useRef(false)
  const liquidUnavailable = useRef(false)
  const reducedMotion = useMotionPreference()

  const cancelFocus = useCallback(() => { cancelAnimationFrame(focusFrame.current) }, [])

  useEffect(() => {
    mounted.current = true
    const move = (event: Event) => {
      const point = eventPoint(event)
      if (!point) return
      lastPointer.current = point
      const current = visualRef.current
      if (!current?.lifetime.dragging) return
      // Native client coordinates avoid double-applying dnd-kit's auto-scroll delta.
      current.x.set(point.x + current.pointerOffset.x)
      current.y.set(point.y + current.pointerOffset.y)
    }
    const interrupt = () => {
      cancelFocus()
      if (visualRef.current && !visualRef.current.lifetime.dragging) visualRef.current.lifetime.finish('interrupted')
    }
    const pointerDown = (event: PointerEvent) => { lastPointer.current = { x: event.clientX, y: event.clientY }; interrupt() }
    const hide = () => { if (document.hidden) visualRef.current?.lifetime.finish('interrupted') }
    document.addEventListener('mousemove', move, { capture: true, passive: true })
    document.addEventListener('touchmove', move, { capture: true, passive: true })
    document.addEventListener('pointerdown', pointerDown, true)
    document.addEventListener('keydown', interrupt, true)
    document.addEventListener('visibilitychange', hide)
    return () => {
      mounted.current = false
      document.removeEventListener('mousemove', move, true)
      document.removeEventListener('touchmove', move, true)
      document.removeEventListener('pointerdown', pointerDown, true)
      document.removeEventListener('keydown', interrupt, true)
      document.removeEventListener('visibilitychange', hide)
      cancelFocus()
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      visualRef.current?.lifetime.finish('unmount')
      inputActive.current = false
      report({ dragging: false, settling: false })
    }
  }, [cancelFocus, report])

  useEffect(() => {
    const current = visualRef.current
    if (!enabled && inputActive.current) {
      inputActive.current = false
      setPreview(null)
      report({ dragging: false })
    }
    if (!current) return
    const expected = current.lifetime.pending ?? current.source
    const exists = modules.find(module => module.id === expected.moduleId)?.sites.some(site => site.id === expected.siteId)
    // Undo, removal, settings and a live reduced-motion change release the old session.
    if (!enabled || reducedMotion || !exists) current.lifetime.finish('interrupted')
  }, [modules, enabled, reducedMotion, report])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // A brief hold distinguishes dragging from swiping pages; touch scrolling remains available.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ['Space'], cancel: ['Escape', 'Tab'], end: ['Space', 'Enter'] },
      coordinateGetter: categoryKeyboardCoordinates,
      scrollBehavior: 'auto',
    }),
  )

  const startDrag = ({ active, activatorEvent }: DragStartEvent) => {
    cancelFocus()
    visualRef.current?.lifetime.finish('interrupted')
    movedRef.current = false
    keyboardDragRef.current = activatorEvent instanceof KeyboardEvent
    setFeedback(null)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    const css = templateRoot.current ? getComputedStyle(templateRoot.current) : null
    setPortalStyle({ '--accent': css?.getPropertyValue('--accent'), '--accent-rgb': css?.getPropertyValue('--accent-rgb'),
      '--module-accent': modules.find(module => module.id === active.data.current?.moduleId)?.accent } as CSSProperties)
    report({ settling: false })
    const data = active.data.current
    const site = modules.find((module) => module.id === data?.moduleId)?.sites.find((site) => site.id === data?.siteId)
    if (!enabled || !site) return
    const tile = activatorEvent.target instanceof Element ? activatorEvent.target.closest<HTMLElement>('.site-tile-wrap') : null
    const rect = active.rect.current.initial
    const icon = visibleIcon(tile)
    const iconSize = icon?.size ?? 44
    setPreview({ site, width: rect?.width ?? 64, height: rect?.height ?? 70, iconSize })
    if (!(activatorEvent instanceof KeyboardEvent) && !reducedMotion && !liquidUnavailable.current && supportsLiquid()) {
      const origin = icon?.point ?? rectCenter(rect ?? { left: 0, top: 0, width: 64, height: 70 })
      const pointer = eventPoint(activatorEvent) ?? origin
      const source: Arrival = { siteId: site.id, moduleId: data!.moduleId, variant: data?.variant ?? 'module' }
      const lifetime = new LiquidSession(
        (arrival) => { if (mounted.current && visualRef.current?.lifetime === lifetime) setPending(arrival) },
        (reason) => {
          if (visualRef.current?.lifetime !== lifetime) return
          const current = visualRef.current
          visualRef.current = null
          if (reason === 'unmount' || !mounted.current) return
          setVisual(null)
          if ((reason === 'complete' || reason === 'timeout') && current.targetModuleId) {
            const arrival: Arrival = { ...source, moduleId: current.targetModuleId, variant: 'module' }
            focusFrame.current = requestAnimationFrame(() => {
              const target = findSiteTile(templateRoot.current, arrival)
              if (!visualRef.current && visibleIcon(target)) target?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true })
            })
          }
        },
        undefined,
        (settling) => { if (visualRef.current?.lifetime === lifetime) report({ settling }) },
      )
      const next = createLiquidVisual(site, source, origin, pointer, iconSize, lifetime)
      // Mouse activation consumed the first 8px; show the drop at the current pointer, not the old press.
      const latest = lastPointer.current ?? pointer
      next.x.set(latest.x + next.pointerOffset.x); next.y.set(latest.y + next.pointerOffset.y)
      visualRef.current = next
      setVisual(next)
    }
    inputActive.current = true
    report({ dragging: true })
  }

  const overDrag = ({ active, over }: DragOverEvent) => {
    const current = visualRef.current
    if (current?.lifetime.dragging) {
      current.targetModuleId = over?.data.current?.type === 'module' && over.id !== active.data.current?.moduleId
        ? String(over.id) : null
    }
  }

  const finishInput = () => {
    setPreview(null)
    inputActive.current = false
    // Input is over now. Never keep the global drag lock alive for visual settling.
    report({ dragging: false })
  }

  const cancelDrag = () => {
    const current = visualRef.current
    if (current) { current.targetModuleId = null; current.lifetime.settle(false, current.source) }
    keyboardDragRef.current = false
    finishInput()
  }

  const endDrag = ({ active, over }: DragEndEvent) => {
    const source = active.data.current
    const wasKeyboardDrag = keyboardDragRef.current
    // KeyboardSensor can receive Enter before React has committed the collision
    // update produced by the previous arrow key. Resolve the translated center
    // against the rendered module shells so a valid keyboard move is not lost.
    let targetModuleId = over?.data.current?.type === 'module' ? String(over.data.current.moduleId) : null
    if (keyboardDragRef.current && source?.type === 'site'
      && (!targetModuleId || targetModuleId === source.moduleId)) {
      const rect = active.rect.current.translated
      if (rect) {
        const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        const moduleElement = [...document.querySelectorAll<HTMLElement>('.module-panel[data-module-id]')]
          .find((element) => {
            const bounds = element.getBoundingClientRect()
            return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
          })
        const moduleId = moduleElement?.dataset.moduleId
        if (moduleId && moduleId !== source.moduleId) targetModuleId = moduleId
      }
    }
    const moved = !!(enabled && source?.type === 'site' && targetModuleId
      && onMove({ siteId: source.siteId, fromModuleId: source.moduleId, toModuleId: targetModuleId }))
    movedRef.current = moved
    keyboardDragRef.current = false
    const current = visualRef.current
    if (current) {
      current.targetModuleId = moved ? targetModuleId : null
      current.lifetime.settle(moved, moved ? { ...current.source, moduleId: targetModuleId!, variant: 'module' } : current.source)
    }
    if (moved && !current && !wasKeyboardDrag) {
      setFeedback({ siteId: source!.siteId, moduleId: targetModuleId!, variant: 'module' })
      report({ settling: true })
      feedbackTimer.current = setTimeout(() => { setFeedback(null); report({ settling: false }) }, 450)
    }
    finishInput()
  }

  const siteName = (id: string) => modules.flatMap((module) => module.sites).find((site) => site.id === id)?.name ?? '站点'
  const moduleName = (id: string) => modules.find((module) => module.id === id)?.title ?? '分类'

  return (
    <SiteDragEnabledContext.Provider value={enabled}>
    <PendingArrivalContext.Provider value={pending}>
    <ArrivalFeedbackContext.Provider value={feedback}>
    <DndContext
      sensors={sensors}
      collisionDetection={bubbleCollision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={{
        acceleration: 4,
        interval: 16,
        threshold: { x: 0.12, y: 0.12 },
        canScroll: (element) => element.classList.contains('module-grid') || element === document.scrollingElement,
        layoutShiftCompensation: false,
      }}
      onDragStart={startDrag}
      onDragOver={overDrag}
      onDragEnd={endDrag}
      onDragCancel={cancelDrag}
      accessibility={{
        screenReaderInstructions: { draggable: '编辑模式下，按空格提起站点，方向键选择分类，空格或回车放下，Escape 取消。轻点或回车编辑站点。' },
        announcements: {
          onDragStart: ({ active }) => `已提起 ${siteName(active.data.current?.siteId)}。方向键选择分类，空格放下，Escape 取消。`,
          onDragOver: ({ active, over }) => !over ? '当前没有可接收的分类。'
            : over.id === active.data.current?.moduleId ? '仍在原分类，放下不会移动。'
              : `放入 ${moduleName(String(over.id))}。`,
          onDragEnd: ({ over }) => over && movedRef.current
            ? `已放入 ${moduleName(String(over.id))}。可使用撤销按钮恢复。` : '未移动站点。',
          onDragCancel: () => '已取消移动。',
        },
      }}
    >
      {children}
      {createPortal(
        <div data-template="bubble" className="bubble-portals" style={portalStyle}>
        <DragOverlay dropAnimation={null} transition="none" zIndex={1100}>
          {preview && !visual && (
            <div className="site-drag-preview" style={{ width: preview.width, height: preview.height, '--drag-icon-size': `${preview.iconSize}px` } as CSSProperties} aria-hidden="true">
              <SiteIcon url={preview.site.url} name={preview.site.name} size={preview.iconSize} />
              <strong>{preview.site.name}</strong>
            </div>
          )}
        </DragOverlay></div>, document.body,
      )}
      {visual && (
        <LiquidEffectBoundary key={visual.id} onUnavailable={() => {
          liquidUnavailable.current = true
          visual.lifetime.finish('interrupted')
        }}>
          <LiquidDragLayer visual={visual} portalStyle={portalStyle} />
        </LiquidEffectBoundary>
      )}
    </DndContext>
    </ArrivalFeedbackContext.Provider>
    </PendingArrivalContext.Provider>
    </SiteDragEnabledContext.Provider>
  )
}
