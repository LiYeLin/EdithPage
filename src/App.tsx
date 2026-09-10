import { Plus, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { FrequentSites } from './components/FrequentSites'
import { ModulePanel } from './components/ModulePanel'
import { SearchDeck } from './components/SearchDeck'
import { SettingsDrawer } from './components/SettingsDrawer'
import { SiteDragProvider } from './components/SiteDragProvider'
import { searchEngines } from './data/defaultConfig'
import { usePersistentConfig } from './hooks/usePersistentConfig'
import type { EditorTarget, Module, SearchEngine, Site } from './types'
import { moveSite, type SiteMove } from './utils/moveSite'

const ENGINE_STORAGE_KEY = 'edith-navigation-search-engine-v1'
const USAGE_STORAGE_KEY = 'edith-navigation-usage-v1'
const defaultFrequentIds = ['chatgpt', 'claude', 'github', 'deepseek', 'perplexity', 'huggingface', 'juejin']
const EDIT_MODE_INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'form',
  '.search-deck',
  '.frequent-panel',
  '.module-panel',
  '.undo-toast',
  '.editing-toast',
  '.settings-drawer',
  '.drawer-backdrop',
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

function App() {
  const { config, setConfig, resetConfig } = usePersistentConfig()
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
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && editing && !settingsOpen
        && !dragSessionRef.current.active && performance.now() > dragSessionRef.current.suppressUntil) setEditing(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing, settingsOpen])

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
      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const handleDragStateChange = useCallback((active: boolean) => {
    dragSessionRef.current = { active, suppressUntil: active ? Infinity : performance.now() + 360 }
    setDragging(active)
  }, [])

  const preventDragClick = (event: MouseEvent<HTMLDivElement>) => {
    // A drop can dispatch a trailing click on the background or on the newly positioned icon.
    if (dragSessionRef.current.active || performance.now() < dragSessionRef.current.suppressUntil) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const enterEditMode = useCallback(() => setEditing(true), [])

  const finishEditingFromBlankArea = (event: MouseEvent<HTMLDivElement>) => {
    if (!editing || settingsOpen) return

    const target = event.target
    if (!(target instanceof Element) || target.closest(EDIT_MODE_INTERACTIVE_SELECTOR)) return

    setEditing(false)
  }

  const closeSettings = () => {
    setSettingsOpen(false)
    setActiveModuleId(null)
    setEditingTarget(null)
  }

  const openGeneralSettings = () => {
    setActiveModuleId(null)
    setEditingTarget(null)
    setSettingsOpen(true)
  }

  const openAddSite = (moduleId: string) => {
    setActiveModuleId(moduleId)
    setEditingTarget(null)
    setSettingsOpen(true)
  }

  const openEditSite = (moduleId: string, siteId: string) => {
    setActiveModuleId(moduleId)
    setEditingTarget({ type: 'site', moduleId, siteId })
    setSettingsOpen(true)
  }

  const openEditModule = (moduleId: string) => {
    setActiveModuleId(moduleId)
    setEditingTarget({ type: 'module', moduleId })
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
    const next = moveSite(config, move)
    if (next === config) return false
    const source = config.modules.find((module) => module.id === move.fromModuleId)!
    const originalIndex = source.sites.findIndex((site) => site.id === move.siteId)
    const target = next.modules.find((module) => module.id === move.toModuleId)!
    setConfig(next)
    setRevealSite({ moduleId: move.toModuleId, siteId: move.siteId })
    queueUndo({ type: 'move', move, originalIndex, message: `已将 ${source.sites[originalIndex].name} 移到「${target.title}」` })
    return true
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
      onClick={finishEditingFromBlankArea}
    >
      <SiteDragProvider
        modules={config.modules}
        enabled={editing && !settingsOpen}
        onMove={moveSiteToModule}
        onDragStateChange={handleDragStateChange}
      >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="noise" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="返回顶部">
          <img className="brand-mark" src="/brand/edith-mark-white.svg" alt="" aria-hidden="true" />
        </a>

        <div className="top-actions">
          <button className="settings-button" type="button" onClick={openGeneralSettings} aria-label="打开设置">
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <main id="top">
        <div className="hero-brand">
          <img
            className="hero-logo"
            src="/brand/edith-logo-white-compact.svg"
            alt="Edith"
          />
        </div>

        <section className="command-row" aria-label="搜索和站点操作">
          <SearchDeck engine={engine} onEngineChange={changeEngine} />
          {editing && (
            <button className="quick-add" type="button" onClick={openGeneralSettings} aria-label="添加站点">
              <Plus size={17} />
              <span>添加站点</span>
            </button>
          )}
        </section>

        <FrequentSites
          sites={frequentSites}
          isEditing={editing}
          onEnterEditMode={enterEditMode}
          onEditSite={openEditSite}
          onRemoveSite={removeSite}
          onVisit={recordVisit}
        />

        <div className="module-grid" id="modules">
          {config.modules.map((module, index) => (
            <ModulePanel
              module={module}
              revealSite={revealSite?.moduleId === module.id ? revealSite : null}
              index={index}
              isEditing={editing}
              onEnterEditMode={enterEditMode}
              onAddSite={openAddSite}
              onEditSite={openEditSite}
              onEditModule={openEditModule}
              onRemoveSite={removeSite}
              onRemoveModule={removeModule}
              onVisit={recordVisit}
              key={module.id}
            />
          ))}
        </div>
      </main>

      {undoAction ? (
        <div className="undo-toast" role="status">
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
        <div className="editing-toast"><span /> 点击图标编辑，拖动到其他分类，点击 × 删除，点击空白处完成</div>
      )}

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
      </SiteDragProvider>
    </div>
  )
}

export default App
