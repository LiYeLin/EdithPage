import './bubble.css'
import { BubbleRuntimeContext } from './runtime'
import { useCallback, useRef, useState } from 'react'
import type { NavigationTemplateProps, TemplateInteractionState } from '../types'
import { FrequentSites } from './components/FrequentSites'
import { ModulePanel } from './components/ModulePanel'
import { BubbleFloatProvider } from './components/BubbleFloatProvider'
import { SiteDragProvider } from './components/SiteDragProvider'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'
import { useTranslation } from '../../i18n/useTranslation'

export default function BubbleTemplate({ modules, frequentSites, editing, interactionBlocked, revealSite, actions, onInteractionStateChange, onCapacityValidatorChange }: NavigationTemplateProps) {
  const root = useRef<HTMLDivElement>(null)
  const t = useTranslation()
  const [settling, setSettling] = useState(false)
  const [dragging, setDragging] = useState(false)
  const report = useCallback((state: TemplateInteractionState) => {
    setDragging(state.dragging)
    setSettling(state.settling)
    onInteractionStateChange(state)
  }, [onInteractionStateChange])
  const { stage, layout, measured } = useWorkspaceLayout(modules, dragging || settling, onCapacityValidatorChange)
  const placements = new Map(layout.items.map(item => [item.id, item]))
  const editSite = (moduleId: string, siteId: string) => actions.edit({ type: 'site', moduleId, siteId })
  return <BubbleRuntimeContext.Provider value={{ root, blocked: interactionBlocked }}>
  <div ref={root} data-template="bubble" className={`bubble-template ${editing ? 'is-editing' : ''} ${dragging ? 'is-site-dragging' : ''}`}>
    <SiteDragProvider modules={modules} enabled={editing && !interactionBlocked} onMove={actions.moveSite} onInteractionStateChange={report}>
      <FrequentSites sites={frequentSites} isEditing={editing} onEnterEditMode={actions.enterEditMode} onEditSite={editSite} onRemoveSite={actions.removeSite} onVisit={actions.visitSite} />
      <div className="bubble-capacity-status" role="status" aria-live="polite">
        {measured && !layout.fits && <span>{t('当前窗口空间不足，已临时启用纵向滚动。请减少内容或扩大窗口。')}</span>}
      </div>
      <BubbleFloatProvider blocked={editing || interactionBlocked || !layout.fits} layoutVersion={layout}>
        <div ref={stage} className="module-grid bubble-workspace" id="modules" aria-busy={!measured} data-capacity={measured ? layout.fits ? 'fits' : 'overflow' : 'measuring'} style={{ height: layout.height }}>
          {measured && modules.map((module, index) => <ModulePanel key={module.id} module={module} index={index} placement={placements.get(module.id)}
            revealSite={revealSite?.moduleId === module.id ? revealSite : null}
            isEditing={editing} onEnterEditMode={actions.enterEditMode} onAddSite={actions.addSite}
            onEditSite={editSite} onEditModule={(moduleId) => actions.edit({ type: 'module', moduleId })}
            onRemoveSite={actions.removeSite} onRemoveModule={actions.removeModule} onVisit={actions.visitSite} />)}
        </div>
      </BubbleFloatProvider>
    </SiteDragProvider>
  </div>
  </BubbleRuntimeContext.Provider>
}
