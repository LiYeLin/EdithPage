import { useTranslation } from '../../../i18n/useTranslation'
import { useBubbleRuntime } from '../runtime'
import { LiquidBubbleSkin } from './LiquidBubbleSkin'
import { useBubbleFloat } from '../hooks/useBubbleFloat'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { Plus, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useBubbleLiquid } from '../hooks/useBubbleLiquid'
import { useMotionPreference } from '../../../hooks/useMotionPreference'
import { useContext, useEffect, useRef, type CSSProperties } from 'react'
import { SiteDragEnabledContext } from '../drag/context'
import { useLongPress } from '../../../hooks/useLongPress'
import type { Module } from '../../../types'
import { getBubbleContents } from '../utils/bubbleLayout'
import type { BubblePlacement } from '../utils/workspaceLayout'
import { SiteTile } from './SiteTile'

type ModulePanelProps = {
  placement?: BubblePlacement
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
  placement,
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
  const t = useTranslation()
  const { blocked } = useBubbleRuntime()
  const dragEnabled = useContext(SiteDragEnabledContext)
  const { active } = useDndContext()
  const { setNodeRef, isOver } = useDroppable({
    id: module.id,
    disabled: !isEditing || !dragEnabled,
    data: { type: 'module', moduleId: module.id },
  })
  const isDropTarget = isOver && active?.data.current?.moduleId !== module.id
  const listRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useMotionPreference()
  const { floatRef, floatStyle } = useBubbleFloat(module.id)
  const liquidSkin = useBubbleLiquid(!reducedMotion && !blocked && !placement?.rectangular, !isEditing)
  const { longPressProps, consumeLongPressClick } = useLongPress(onEnterEditMode)
  const layout = placement ?? getBubbleContents(module.sites.length)
  const shellHeight = placement?.shellHeight ?? layout.diameter
  const addPosition = layout.positions[module.sites.length]
  const transition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 280, damping: 27, mass: 0.8 }

  useEffect(() => {
    if (!revealSite) return
    const frame = window.requestAnimationFrame(() => {
      const tile = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-site-id]') ?? [])]
        .find(tile => tile.dataset.siteId === revealSite.siteId)
      if (!tile?.hasAttribute('data-pending-arrival')) tile?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [revealSite])

  const handleModuleClick = () => {
    if (consumeLongPressClick()) return
    if (isEditing) onEditModule(module.id)
  }

  return (
    <motion.section
      layout={reducedMotion ? false : 'position'}
      transition={transition}
      className={`module-panel bubble-panel module-${index + 1} ${isDropTarget ? 'is-drop-target' : ''} ${placement?.rectangular ? 'is-rectangular' : ''}`}
      data-module-id={module.id}
      style={{
        width: layout.diameter,
        ...(placement ? { position: 'absolute', left: placement.x, top: placement.y } : {}),
        '--module-accent': module.accent,
        '--bubble-tile-width': `${layout.tile.width}px`,
        '--bubble-tile-height': `${layout.tile.height}px`,
        '--bubble-icon-size': `${layout.tile.icon}px`,
      } as CSSProperties}
    >
      <motion.div className="bubble-float-body" ref={floatRef} style={floatStyle}>
        <div className="bubble-punch-body">
          <header className="module-header" data-editing-interactive>
            <button
              {...longPressProps}
              className={`module-title ${isEditing ? 'is-editable' : ''}`}
              type="button"
              onClick={handleModuleClick}
              onContextMenu={(event) => event.preventDefault()}
              aria-label={isEditing ? t("编辑分类 {0}", module.title) : t("{0}，长按进入编辑模式", module.title)}
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
                  aria-label={t("删除分类 {0} 及其中的 {1} 个站点", module.title, module.sites.length)}
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
            style={{ height: shellHeight, borderRadius: placement?.rectangular ? 24 : '50%' }}
          >
            <LiquidBubbleSkin skinRef={liquidSkin} />
            <div className="site-list bubble-site-list" ref={listRef}>
              <div className="bubble-page">
                {module.sites.map((site, siteIndex) => (
                  <motion.div
                    layout={reducedMotion ? false : 'position'}
                    transition={transition}
                    key={site.id}
                    className="bubble-site-motion"
                    style={{ left: layout.diameter / 2 + layout.positions[siteIndex].x, top: shellHeight / 2 + layout.positions[siteIndex].y }}
                  >
                    <SiteTile
                      site={site}
                      moduleId={module.id}
                      variant="module"
                      index={index * 7 + siteIndex}
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
                    style={{ left: layout.diameter / 2 + addPosition.x, top: shellHeight / 2 + addPosition.y }}
                  >
                    <button className="add-site-app" type="button" onClick={() => onAddSite(module.id)} aria-label={t("添加站点到 {0}", module.title)}>
                      <span><Plus size={20} strokeWidth={1.5} /></span>
                      <strong>{module.sites.length === 0 ? t("添加首个站点") : t("添加")}</strong>
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  )
}
