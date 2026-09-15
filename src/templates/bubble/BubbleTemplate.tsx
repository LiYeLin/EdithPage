import './bubble.css'
import { BubbleRuntimeContext } from './runtime'
import { useCallback, useRef, useState } from 'react'
import type { NavigationTemplateProps, TemplateInteractionState } from '../types'
import { FrequentSites } from './components/FrequentSites'
import { ModulePanel } from './components/ModulePanel'
import { BubbleFloatProvider } from './components/BubbleFloatProvider'
import { SiteDragProvider } from './components/SiteDragProvider'

export default function BubbleTemplate({ modules, frequentSites, editing, interactionBlocked, revealSite, actions, onInteractionStateChange }: NavigationTemplateProps) {
  const root = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const report = useCallback((state: TemplateInteractionState) => {
    setDragging(state.dragging)
    onInteractionStateChange(state)
  }, [onInteractionStateChange])
  const editSite = (moduleId: string, siteId: string) => actions.edit({ type: 'site', moduleId, siteId })
  return <BubbleRuntimeContext.Provider value={{ root, blocked: interactionBlocked }}>
  <div ref={root} data-template="bubble" className={`bubble-template ${editing ? 'is-editing' : ''} ${dragging ? 'is-site-dragging' : ''}`}>
    <SiteDragProvider modules={modules} enabled={editing && !interactionBlocked} onMove={actions.moveSite} onInteractionStateChange={report}>
      <FrequentSites sites={frequentSites} isEditing={editing} onEnterEditMode={actions.enterEditMode} onEditSite={editSite} onRemoveSite={actions.removeSite} onVisit={actions.visitSite} />
      <BubbleFloatProvider blocked={editing || interactionBlocked}>
        <div className="module-grid" id="modules">
          {modules.map((module, index) => <ModulePanel key={module.id} module={module} index={index}
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
