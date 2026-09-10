import { LiquidBubbleSkin } from './LiquidBubbleSkin'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useBubbleLiquid } from '../hooks/useBubbleLiquid'
import { useMotionPreference } from '../hooks/useMotionPreference'
import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SiteDragEnabledContext } from '../drag/context'
import { useLongPress } from '../hooks/useLongPress'
import { useViewportWidth } from '../hooks/useViewportWidth'
import type { Module } from '../types'
import { getBubbleLayout } from '../utils/bubbleLayout'
import { SiteTile } from './SiteTile'

type ModulePanelProps = {
  module: Module
  revealSite: { siteId: string } | null
  index: number
  isEditing: boolean
  onEnterEditMode: () => void
  onAddSite: (moduleId: string) => void
  onEditSite: (moduleId: string, siteId: string) => void
  onEditModule: (moduleId: string) => void
  onRemoveSite: (moduleId: string, siteId: string) => void
  onRemoveModule: (moduleId: string) => void
  onVisit: (siteId: string) => void
}

export function ModulePanel({
  module,
  revealSite,
  index,
  isEditing,
  onEnterEditMode,
  onAddSite,
  onEditSite,
  onEditModule,
  onRemoveSite,
  onRemoveModule,
  onVisit,
}: ModulePanelProps) {
  const dragEnabled = useContext(SiteDragEnabledContext)
  const { active } = useDndContext()
  const { setNodeRef, isOver } = useDroppable({
    id: module.id,
    disabled: !isEditing || !dragEnabled,
    data: { type: 'module', moduleId: module.id },
  })
  const isDropTarget = isOver && active?.data.current?.moduleId !== module.id
  const listRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(0)
  const lastRevealRef = useRef(revealSite)
  const [activePage, setActivePage] = useState(0)
  const viewportWidth = useViewportWidth()
  const reducedMotion = useMotionPreference()
  const liquidSkin = useBubbleLiquid(!reducedMotion)
  const { longPressProps, consumeLongPressClick } = useLongPress(onEnterEditMode)
  const layout = useMemo(
    () => getBubbleLayout(module.sites.length, viewportWidth),
    [module.sites.length, viewportWidth],
  )
  const pageCount = Math.max(1, Math.ceil(module.sites.length / layout.pageSize))
  const transition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 280, damping: 27, mass: 0.8 }

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    // After a move, reveal the received site even if it was appended to a new page.
    // Otherwise retain the current page and clamp it after deletions or resizing.
    const siteIndex = revealSite && revealSite !== lastRevealRef.current
      ? module.sites.findIndex((site) => site.id === revealSite.siteId) : -1
    lastRevealRef.current = revealSite
    let focusFrame = 0
    const frame = window.requestAnimationFrame(() => {
      pageRef.current = siteIndex >= 0 ? Math.floor(siteIndex / layout.pageSize) : Math.min(pageRef.current, pageCount - 1)
      list.scrollTo({ left: pageRef.current * list.clientWidth, behavior: 'instant' })
      setActivePage(pageRef.current)
      if (siteIndex >= 0) {
        focusFrame = window.requestAnimationFrame(() => {
          // Wait for React to remove inert from the newly selected page before restoring focus.
          const tile = [...list.querySelectorAll<HTMLElement>('[data-site-id]')].find((tile) => tile.dataset.siteId === revealSite?.siteId)
          // Liquid arrivals keep their layout, but focus waits until the visual session releases them.
          if (!tile?.hasAttribute('data-pending-arrival')) tile?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true })
        })
      }
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(focusFrame)
    }
  }, [pageCount, layout.diameter, layout.pageSize, revealSite, module.sites])

  const scroll = (direction: -1 | 1) => {
    const list = listRef.current
    if (!list) return
    const page = Math.max(0, Math.min(pageCount - 1, pageRef.current + direction))
    list.scrollTo({ left: page * list.clientWidth, behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  const handleModuleClick = () => {
    if (consumeLongPressClick()) return
    if (isEditing) onEditModule(module.id)
  }

  return (
    <motion.section
      layout={reducedMotion ? false : 'position'}
      transition={transition}
      className={`module-panel bubble-panel module-${index + 1} ${isDropTarget ? 'is-drop-target' : ''}`}
      data-module-id={module.id}
      style={{
        width: layout.diameter,
        '--module-accent': module.accent,
        '--bubble-tile-width': `${layout.tile.width}px`,
        '--bubble-tile-height': `${layout.tile.height}px`,
        '--bubble-icon-size': `${layout.tile.icon}px`,
      } as CSSProperties}
    >
      <header className="module-header">
        <button
          {...longPressProps}
          className={`module-title ${isEditing ? 'is-editable' : ''}`}
          type="button"
          onClick={handleModuleClick}
          onContextMenu={(event) => event.preventDefault()}
          aria-label={isEditing ? `编辑分类 ${module.title}` : `${module.title}，长按进入编辑模式`}
        >
          <span className="module-dot" />
          <h2>{module.title}</h2>
          <span className="module-count">{module.sites.length}</span>
        </button>
        {isEditing && (
          <div className="module-controls">
            <button
              className="remove-module"
              type="button"
              onClick={() => onRemoveModule(module.id)}
              aria-label={`删除分类 ${module.title} 及其中的 ${module.sites.length} 个站点`}
            >
              <X size={13} strokeWidth={2.6} />
            </button>
          </div>
        )}
      </header>

      <motion.div
        layout={!reducedMotion}
        transition={transition}
        className="bubble-shell"
        ref={setNodeRef}
        data-drop-target={isDropTarget || undefined}
        style={{ height: layout.diameter, borderRadius: '50%' }}
      >
        <LiquidBubbleSkin skinRef={liquidSkin} />
        <div
          className={`site-list bubble-site-list ${pageCount > 1 ? 'is-paginated' : ''}`}
          ref={listRef}
          onScroll={(event) => {
            const list = event.currentTarget
            const page = Math.round(list.scrollLeft / list.clientWidth)
            pageRef.current = page
            setActivePage(page)
          }}
        >
          {Array.from({ length: pageCount }, (_, pageIndex) => {
            const sites = module.sites.slice(pageIndex * layout.pageSize, (pageIndex + 1) * layout.pageSize)
            const positions = layout.positionsForPage(sites.length)
            const addPosition = positions[sites.length]

            return (
              <div className="bubble-page" key={pageIndex} aria-label={`${module.title} 第 ${pageIndex + 1} 页`} inert={activePage !== pageIndex}>
                {sites.map((site, siteIndex) => (
                  <motion.div
                    layout={reducedMotion ? false : 'position'}
                    transition={transition}
                    key={site.id}
                    className="bubble-site-motion"
                    style={{ left: layout.diameter / 2 + positions[siteIndex].x, top: layout.diameter / 2 + positions[siteIndex].y }}
                  >
                    <SiteTile
                      site={site}
                      moduleId={module.id}
                      variant="module"
                      index={index * 7 + pageIndex * layout.pageSize + siteIndex}
                      isEditing={isEditing}
                      onEnterEditMode={onEnterEditMode}
                      onEdit={() => onEditSite(module.id, site.id)}
                      onRemove={() => onRemoveSite(module.id, site.id)}
                      onVisit={() => onVisit(site.id)}
                    />
                  </motion.div>
                ))}
                {isEditing && (
                  <motion.div
                    layout={reducedMotion ? false : 'position'}
                    transition={transition}
                    className="bubble-site-motion bubble-add-position"
                    style={{ left: layout.diameter / 2 + addPosition.x, top: layout.diameter / 2 + addPosition.y }}
                  >
                    <button className="add-site-app" type="button" onClick={() => onAddSite(module.id)} aria-label={`添加站点到 ${module.title}`}>
                      <span><Plus size={20} strokeWidth={1.5} /></span>
                      <strong>{module.sites.length === 0 ? '添加首个站点' : '添加'}</strong>
                    </button>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {pageCount > 1 && (
        <div className="bubble-pagination module-controls" aria-label={`${module.title}翻页`}>
          <button type="button" onClick={() => scroll(-1)} disabled={activePage === 0} aria-label={`${module.title} 向左滑动`}>
            <ChevronLeft size={14} />
          </button>
          <span aria-live="polite">{Math.min(activePage + 1, pageCount)} / {pageCount}</span>
          <button type="button" onClick={() => scroll(1)} disabled={activePage >= pageCount - 1} aria-label={`${module.title} 向右滑动`}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </motion.section>
  )
}
