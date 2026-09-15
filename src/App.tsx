import type { TemplateDefinition, TemplateInteractionState } from './templates/types'
import { templates as productionTemplates } from './templates/registry'
import { canSwitchTemplate, getTemplateAppearance, selectTemplate } from './templates/config'
import { TemplateHost } from './templates/TemplateHost'
import { useTemplateSelection } from './templates/useTemplateSelection'
import { TemplatePicker } from './components/TemplatePicker'
import { Layers3, Plus, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { OnboardingGuide, type OnboardingStep } from './components/OnboardingGuide'
import { SearchDeck } from './components/SearchDeck'
import { SettingsDrawer } from './components/SettingsDrawer'
import { searchEngines } from './data/defaultConfig'
import { usePersistentConfig } from './hooks/usePersistentConfig'
import type { EditorTarget, Module, SearchEngine, Site } from './types'
import { moveSite, type SiteMove } from './utils/moveSite'

const ENGINE_STORAGE_KEY = 'edith-navigation-search-engine-v1'
const USAGE_STORAGE_KEY = 'edith-navigation-usage-v1'
const defaultFrequentIds = ['chatgpt', 'claude', 'github', 'deepseek', 'perplexity', 'huggingface', 'juejin']
const ONBOARDING_STORAGE_KEY = 'edith-navigation-onboarding-completed-v1'

const EDIT_MODE_INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'form',
  '[data-editing-interactive]',
].join(',')

type UndoAction =
  | { type: 'move'; move: SiteMove; originalIndex: number; message: string }
  | { type: 'site'; moduleId: string; site: Site; index: number; message: string }
  | { type: 'module'; module: Module; index: number; message: string }

function loadUsageCounts(): Record<string, number> {
  try {
    const saved = localStorage.getItem(USAGE_STORAGE_KEY)
    return saved ? JSON.parse(saved) as Record<string, number> : {}
  } catch {
    return {}
  }
}

function App({ templates = productionTemplates }: { templates?: readonly TemplateDefinition[] }) {
  const { config, setConfig, resetConfig, storageError } = usePersistentConfig(templates)
  const selection = useTemplateSelection(templates, config.templateId)
  const appearance = getTemplateAppearance(selection.active?.definition)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerOpenRef = useRef(false)
  const templateButtonRef = useRef<HTMLButtonElement>(null)
  const pickerFocusTimer = useRef<number | null>(null)
  const [interaction, setInteraction] = useState<TemplateInteractionState>({ dragging: false, settling: false })
  const interactionRef = useRef(interaction)
  const [engine, setEngine] = useState<SearchEngine>(() => {
    try {
      return searchEngines.find((item) => item.id === localStorage.getItem(ENGINE_STORAGE_KEY)) ?? searchEngines[0]
    } catch {
      return searchEngines[0]
    }
  })
  const changeEngine = (next: SearchEngine) => {
    setEngine(next)
    try {
      localStorage.setItem(ENGINE_STORAGE_KEY, next.id)
    } catch {
      // Search remains usable when browser storage is unavailable.
    }
  }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(() => {
    try { return localStorage.getItem(ONBOARDING_STORAGE_KEY) ? null : 1 } catch { return 1 }
  })
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [revealSite, setRevealSite] = useState<{ moduleId: string; siteId: string } | null>(null)
  const dragSessionRef = useRef({ active: false, suppressUntil: 0 })
  const [editingTarget, setEditingTarget] = useState<EditorTarget>(null)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>(loadUsageCounts)
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const undoPointerRef = useRef<number | null>(null)
  const undoTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current)
    if (pickerFocusTimer.current !== null) window.clearTimeout(pickerFocusTimer.current)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && editing && !settingsOpen && !pickerOpen
        && !dragSessionRef.current.active && performance.now() > dragSessionRef.current.suppressUntil) setEditing(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing, settingsOpen, pickerOpen])

  const frequentSites = useMemo(() => {
    const preference = new Map(defaultFrequentIds.map((id, index) => [id, index]))
    return config.modules
      .flatMap((module) => module.sites.map((site) => ({ site, moduleId: module.id })))
      .map((entry, index) => ({ ...entry, index }))
      .sort((a, b) => {
        const usageDifference = (usageCounts[b.site.id] ?? 0) - (usageCounts[a.site.id] ?? 0)
        if (usageDifference !== 0) return usageDifference
        const aPreference = preference.get(a.site.id) ?? defaultFrequentIds.length + a.index
        const bPreference = preference.get(b.site.id) ?? defaultFrequentIds.length + b.index
        return aPreference - bPreference
      })
      .slice(0, 7)
      .map(({ site, moduleId }) => ({ site, moduleId }))
  }, [config.modules, usageCounts])

  const recordVisit = useCallback((siteId: string) => {
    setUsageCounts((current) => {
      const next = { ...current, [siteId]: (current[siteId] ?? 0) + 1 }
      try { localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next)) } catch { /* Keep visits usable without storage. */ }
      return next
    })
  }, [])

  const handleDragStateChange = useCallback((active: boolean) => {
    dragSessionRef.current = { active, suppressUntil: active ? Infinity : performance.now() + 360 }
    setDragging(active)
  }, [])

  const handleInteractionStateChange = useCallback((state: TemplateInteractionState) => {
    interactionRef.current = state
    setInteraction(state)
    if (dragSessionRef.current.active !== state.dragging) handleDragStateChange(state.dragging)
  }, [handleDragStateChange])

  const preventDragClick = (event: MouseEvent<HTMLDivElement>) => {
    // A drop can dispatch a trailing click on the background or on the newly positioned icon.
    if (dragSessionRef.current.active || performance.now() < dragSessionRef.current.suppressUntil) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const completeOnboardingAction = useCallback(() => {
    setOnboardingStep((current) => {
      if (!current || current === 1) return current === 1 ? 2 : current
      if (current === 4) { try { localStorage.setItem(ONBOARDING_STORAGE_KEY, '1') } catch { /* storage unavailable */ } ; return null }
      return (current + 1) as OnboardingStep
    })
  }, [])
  const skipOnboarding = useCallback(() => { try { localStorage.setItem(ONBOARDING_STORAGE_KEY, '1') } catch { /* storage unavailable */ } ; setOnboardingStep(null) }, [])
  const enterEditMode = useCallback(() => { setEditing(true); if (onboardingStep === 4) completeOnboardingAction() }, [completeOnboardingAction, onboardingStep])

  const finishEditingFromBlankArea = (event: MouseEvent<HTMLDivElement>) => {
    if (!editing || settingsOpen || pickerOpen) return

    const target = event.target
    if (!(target instanceof Element) || target.closest(EDIT_MODE_INTERACTIVE_SELECTOR)) return

    setEditing(false)
  }

  const cancelLoad = selection.cancel
  const closePicker = useCallback(() => {
    pickerOpenRef.current = false
    setPickerOpen(false)
    cancelLoad()
    if (pickerFocusTimer.current !== null) window.clearTimeout(pickerFocusTimer.current)
    // Restore only after React has removed inert, and never steal focus from a reopened picker.
    pickerFocusTimer.current = window.setTimeout(() => {
      pickerFocusTimer.current = null
      if (!pickerOpenRef.current) templateButtonRef.current?.focus()
    }, 20)
  }, [cancelLoad])

  const openPicker = () => {
    if (!selection.active || selection.loading || !canSwitchTemplate(interactionRef.current)) return
    setSettingsOpen(false)
    pickerOpenRef.current = true
    setPickerOpen(true)
    if (onboardingStep === 3) completeOnboardingAction()
  }

  const chooseTemplate = (id: string) => {
    if (!pickerOpenRef.current || selection.loading || !canSwitchTemplate(interactionRef.current)) return
    if (id === selection.active?.definition.id) { closePicker(); return }
    void selection.load(id, (loaded) => {
      // Repeat the guard at commit time; disabled controls alone do not serialize events.
      if (!pickerOpenRef.current || !canSwitchTemplate(interactionRef.current)) return
      setConfig(current => selectTemplate(current, loaded.definition.id))
      setEditing(false)
      setRevealSite(null)
      selection.setActive(loaded)
      closePicker()
    })
  }

  const closeSettings = () => {
    setSettingsOpen(false)
    setActiveModuleId(null)
    setEditingTarget(null)
  }

  const openGeneralSettings = () => {
    setActiveModuleId(null)
    setEditingTarget(null)
    if (pickerOpenRef.current) closePicker()
    setSettingsOpen(true)
  }

  const openAddSite = (moduleId: string) => {
    setActiveModuleId(moduleId)
    setEditingTarget(null)
    if (pickerOpenRef.current) closePicker()
    setSettingsOpen(true)
  }

  const openEditSite = (moduleId: string, siteId: string) => {
    setActiveModuleId(moduleId)
    setEditingTarget({ type: 'site', moduleId, siteId })
    if (pickerOpenRef.current) closePicker()
    setSettingsOpen(true)
  }

  const openEditModule = (moduleId: string) => {
    setActiveModuleId(moduleId)
    setEditingTarget({ type: 'module', moduleId })
    if (pickerOpenRef.current) closePicker()
    setSettingsOpen(true)
  }

  const queueUndo = useCallback((action: UndoAction) => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current)
    setUndoAction(action)
    undoTimerRef.current = window.setTimeout(() => {
      setUndoAction(null)
      undoTimerRef.current = null
    }, 5000)
  }, [])

  const removeSite = (moduleId: string, siteId: string) => {
    const module = config.modules.find((item) => item.id === moduleId)
    const index = module?.sites.findIndex((site) => site.id === siteId) ?? -1
    const site = index >= 0 ? module?.sites[index] : null
    if (!site) return

    setConfig({
      ...config,
      modules: config.modules.map((item) =>
        item.id === moduleId ? { ...item, sites: item.sites.filter((entry) => entry.id !== siteId) } : item,
      ),
    })
    queueUndo({ type: 'site', moduleId, site, index, message: `已删除 ${site.name}` })
  }

  const removeModule = (moduleId: string) => {
    const index = config.modules.findIndex((module) => module.id === moduleId)
    if (index < 0) return
    const module = config.modules[index]

    setConfig({ ...config, modules: config.modules.filter((item) => item.id !== moduleId) })
    queueUndo({
      type: 'module',
      module,
      index,
      message: `已删除分类「${module.title}」和其中 ${module.sites.length} 个站点`,
    })
  }

  const moveSiteToModule = (move: SiteMove) => {
    let moved = false
    setConfig(current => {
      const next = moveSite(current, move)
      if (next === current) return current
      const source = current.modules.find(module => module.id === move.fromModuleId)!
      const originalIndex = source.sites.findIndex(site => site.id === move.siteId)
      const target = next.modules.find(module => module.id === move.toModuleId)!
      moved = true
      setRevealSite({ moduleId: move.toModuleId, siteId: move.siteId })
      queueUndo({ type: 'move', move, originalIndex, message: `已将 ${source.sites[originalIndex].name} 移到「${target.title}」` })
      return next
    })
    return moved
  }

  const undoChange = () => {
    if (!undoAction) return
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current)

    if (undoAction.type === 'move') {
      setRevealSite({ moduleId: undoAction.move.fromModuleId, siteId: undoAction.move.siteId })
    }
    setConfig((current) => {
      if (undoAction.type === 'move') {
        return moveSite(current, {
          siteId: undoAction.move.siteId,
          fromModuleId: undoAction.move.toModuleId,
          toModuleId: undoAction.move.fromModuleId,
          toIndex: undoAction.originalIndex,
        })
      }
      if (undoAction.type === 'module') {
        if (current.modules.some((module) => module.id === undoAction.module.id)) return current
        const modules = [...current.modules]
        modules.splice(Math.min(undoAction.index, modules.length), 0, undoAction.module)
        return { ...current, modules }
      }

      return {
        ...current,
        modules: current.modules.map((module) => {
          if (module.id !== undoAction.moduleId || module.sites.some((site) => site.id === undoAction.site.id)) {
            return module
          }
          const sites = [...module.sites]
          sites.splice(Math.min(undoAction.index, sites.length), 0, undoAction.site)
          return { ...module, sites }
        }),
      }
    })
    setUndoAction(null)
    undoTimerRef.current = null
  }

  const drawerKey = editingTarget?.type === 'site'
    ? `site-${editingTarget.moduleId}-${editingTarget.siteId}`
    : editingTarget?.type === 'module'
      ? `module-${editingTarget.moduleId}`
      : activeModuleId
        ? `add-${activeModuleId}`
        : 'settings'

  return (
    <div
      className={`app ${editing ? 'is-editing' : ''} ${dragging ? 'is-site-dragging' : ''}`}
      onPointerDownCapture={() => {
        // A fresh intentional click (for example Undo) must not be swallowed by the drop guard.
        if (!dragSessionRef.current.active) dragSessionRef.current.suppressUntil = 0
      }}
      onClickCapture={preventDragClick}
      data-accent={config.accent}
      style={{
        '--app-background-image': `url("${appearance.backgroundImage}")`,
        '--app-background-position': appearance.backgroundPosition,
      } as CSSProperties}
      onClick={finishEditingFromBlankArea}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="noise" />

      <header className="topbar" inert={pickerOpen}>
        <a className="brand" href="#top" aria-label="返回顶部">
          <img className="brand-mark" src="/brand/edith-mark-white.svg" alt="" aria-hidden="true" />
        </a>

        <div className="top-actions">
          <button ref={templateButtonRef} className="template-button" type="button" onClick={openPicker} disabled={!selection.active || selection.loading || !canSwitchTemplate(interaction)} aria-label="切换模板"><Layers3 size={17} /></button>
          <button className="settings-button" type="button" onClick={openGeneralSettings} aria-label="打开设置">
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <main id="top" inert={pickerOpen}>
        <div className="hero-brand">
          <img
            className="hero-logo"
            src="/brand/edith-logo-white-compact.svg"
            alt="Edith"
          />
        </div>

        <section className="command-row" aria-label="搜索和站点操作">
          <SearchDeck engine={engine} onEngineChange={(next) => { changeEngine(next); if (onboardingStep === 2) completeOnboardingAction() }} />
          {editing && (
            <button className="quick-add" type="button" onClick={openGeneralSettings} aria-label="添加站点">
              <Plus size={17} />
              <span>添加站点</span>
            </button>
          )}
        </section>

        <TemplateHost active={selection.active} error={selection.error} retry={selection.retryInitial} modules={config.modules} frequentSites={frequentSites} editing={editing}
          interactionBlocked={settingsOpen || pickerOpen || selection.loading} revealSite={revealSite}
          onInteractionStateChange={handleInteractionStateChange}
          actions={{ enterEditMode, openSettings: openGeneralSettings, addSite: openAddSite,
            edit: (target) => target.type === 'site' ? openEditSite(target.moduleId, target.siteId) : openEditModule(target.moduleId),
            removeSite, removeModule, moveSite: moveSiteToModule, visitSite: recordVisit }} />
      </main>

      {undoAction ? (
        <div inert={pickerOpen} data-editing-interactive className="undo-toast" role="status">
          <span>{undoAction.message}</span>
          <button
            type="button"
            onPointerDown={(event) => { if (event.button === 0) undoPointerRef.current = event.pointerId }}
            onPointerLeave={() => { undoPointerRef.current = null }}
            onPointerCancel={() => { undoPointerRef.current = null }}
            onPointerUp={(event) => {
              if (undoPointerRef.current !== event.pointerId || dragSessionRef.current.active) return
              undoPointerRef.current = null
              // dnd-kit captures clicks for 50ms after drop. An explicit press/release on Undo
              // is already intentional; handle it now, then swallow its trailing click.
              undoChange()
              dragSessionRef.current.suppressUntil = performance.now() + 250
            }}
            onClick={undoChange}
          >撤销</button>
        </div>
      ) : editing && (
        <div data-editing-interactive className="editing-toast"><span /> {selection.active?.definition.editingHint}</div>
      )}

      {storageError && <div className="storage-error" role="alert">{storageError}</div>}
      {pickerOpen && <TemplatePicker templates={templates} currentId={config.templateId} loading={selection.loading}
        busy={!canSwitchTemplate(interaction)} error={selection.error} onSelect={chooseTemplate} onClose={closePicker} />}
      <SettingsDrawer
        key={drawerKey}
        open={settingsOpen}
        activeModuleId={activeModuleId}
        editingTarget={editingTarget}
        config={config}
        onClose={closeSettings}
        onChange={setConfig}
        onReset={resetConfig}
      />
      {onboardingStep && !pickerOpen && !settingsOpen && <OnboardingGuide step={onboardingStep} onNext={completeOnboardingAction} onSkip={skipOnboarding} />}
    </div>
  )
}

export default App
