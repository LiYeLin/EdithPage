import './beijing.css'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { SiteIcon } from '../../components/SiteIcon'
import { FrequentSiteStrip } from '../../components/FrequentSiteStrip'
import type { IconPositionPersistence } from '../../types'
import type { NavigationTemplateProps } from '../types'
import { loadTerrainAssets } from './assets'
import { createBeijingScene } from './scene'
import { OUTLINE_STROKE, type TerrainAsset, type TerrainLayout } from './terrain'

const motionQuery = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const reducedMotion = () => window.matchMedia(motionQuery).matches

export default function BeijingTemplate({ modules, frequentSites, editing, interactionBlocked, actions, iconPositionPersistence, onInteractionStateChange }: NavigationTemplateProps) {
  const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => true)
  const [asset, setAsset] = useState<TerrainAsset | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [layout, setLayout] = useState<TerrainLayout | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const iconRefs = useRef(new Map<string, HTMLDivElement>())
  const scene = useRef<ReturnType<typeof createBeijingScene> | null>(null)
  const iconPositionPersistenceRef = useRef<IconPositionPersistence | undefined>(iconPositionPersistence)
  const saveIconPositionsRef = useRef(actions.saveIconPositions)
  const sites = useMemo(() => modules.flatMap(module => module.sites.map(site => ({ module, site }))), [modules])
  const animated = !!asset && !error && !reduced
  const persistenceEnabled = iconPositionPersistence?.enabled === true

  useEffect(() => {
    iconPositionPersistenceRef.current = iconPositionPersistence
    saveIconPositionsRef.current = actions.saveIconPositions
  }, [actions.saveIconPositions, iconPositionPersistence])

  useEffect(() => {
    if (reduced || asset) return
    const controller = new AbortController()
    void loadTerrainAssets(controller.signal).then(result => {
      if (!controller.signal.aborted) setAsset(result)
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    })
    return () => controller.abort()
  }, [attempt, reduced, asset])

  useEffect(() => {
    if (!animated || !asset || !stageRef.current) return
    let runtime: ReturnType<typeof createBeijingScene>
    try {
      runtime = createBeijingScene(stageRef.current, asset, {
        iconFor: id => iconRefs.current.get(id), onLayout: setLayout, report: onInteractionStateChange,
        getIconPositionPersistence: () => iconPositionPersistenceRef.current,
        saveIconPositions: positions => saveIconPositionsRef.current?.('beijing', positions),
      })
    } catch {
      // Keep navigation available if the browser cannot initialise the physical scene.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Publish synchronous external Canvas init failure so navigation remains usable.
      setError(true)
      return
    }
    scene.current = runtime
    return () => { scene.current = null; runtime.dispose() }
  }, [animated, asset, onInteractionStateChange, persistenceEnabled])

  useEffect(() => { scene.current?.reconcile(sites) }, [sites, animated, asset, persistenceEnabled])
  useEffect(() => { scene.current?.setPaused(interactionBlocked) }, [interactionBlocked, animated, asset, persistenceEnabled])
  useEffect(() => {
    onInteractionStateChange({ dragging: false, settling: false })
    return () => onInteractionStateChange({ dragging: false, settling: false })
  }, [onInteractionStateChange])

  return (
    <section className="beijing-template" data-template="beijing" style={{ '--beijing-outline-stroke': OUTLINE_STROKE } as CSSProperties} aria-label="北京地标导航模板" inert={interactionBlocked}>
      <FrequentSiteStrip sites={frequentSites} editing={editing} onEnterEditMode={actions.enterEditMode}
        onEdit={(moduleId, siteId) => actions.edit({ type: 'site', moduleId, siteId })}
        onRemove={actions.removeSite} onVisit={actions.visitSite} />
      {!editing && <div className="beijing-edit-entry">
        <button type="button" data-onboarding-edit data-editing-interactive onClick={actions.enterEditMode} disabled={interactionBlocked} aria-label="进入编辑模式">
          <Pencil size={14} aria-hidden="true" /><span>进入编辑模式</span>
        </button>
      </div>}
      {!animated && <p className="beijing-status" role={error ? 'alert' : 'status'}>
        {error ? '北京地形加载失败，暂以列表展示站点。' : reduced ? '已减少动态效果，以列表展示站点。' : '正在加载北京地形…'}
        {error && <button type="button" data-editing-interactive onClick={() => { setError(false); setAsset(null); setAttempt(n => n + 1) }}>重试加载地形</button>}
      </p>}
      <div ref={stageRef} className={animated ? 'beijing-stage' : 'beijing-fallback'} aria-label={animated ? '北京地标物理舞台' : '网站列表'}>
        {animated && layout && <svg className="beijing-landmarks" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
          {asset.landmarks.map(landmark => {
            const transform = layout.buildings.find(b => b.id === landmark.id)!
            return <g key={landmark.id} data-landmark={landmark.id} transform={`translate(${transform.x} ${transform.y}) scale(${layout.scale})`}>
              {landmark.paths.map((path, i) => <path key={i} className={`beijing-line-${path.kind}`} d={path.d} vectorEffect="non-scaling-stroke" />)}
            </g>
          })}
          <path className="beijing-line-ground" d={`M 0 ${layout.groundY} H ${layout.width}`} />
        </svg>}
        <div className="beijing-icons" aria-label="网站快捷入口">
          {sites.map(({ site, module }) => (
            <div key={`${animated ? 'physics' : 'list'}-${site.id}`} className="beijing-icon-link" data-site-id={site.id}
              ref={element => { if (element) iconRefs.current.set(site.id, element); else iconRefs.current.delete(site.id) }}>
              <a className="beijing-icon-anchor" href={site.url} target="_blank" rel="noreferrer" aria-label={`${site.name}，打开站点`}
                onDragStart={event => event.preventDefault()} onClick={() => actions.visitSite(site.id)}>
                <span className="beijing-icon-shell" style={{ '--beijing-accent': module.accent } as CSSProperties}>
                  <SiteIcon url={site.url} name={site.name} size={42} />
                </span>
              </a>
              <span className="beijing-icon-name" aria-hidden="true">{site.name}</span>
              {editing && <span className="beijing-icon-actions" data-editing-interactive>
                <button type="button" aria-label={`编辑 ${site.name}`} onClick={() => actions.edit({ type: 'site', moduleId: module.id, siteId: site.id })}><Pencil size={11} /></button>
                <button type="button" aria-label={`删除 ${site.name}`} onClick={() => actions.removeSite(module.id, site.id)}><Trash2 size={11} /></button>
              </span>}
            </div>
          ))}
        </div>
        {sites.length === 0 && <div className="beijing-empty"><p>还没有网站，添加一个开始探索北京地标吧。</p><button type="button" data-editing-interactive onClick={actions.openSettings}>添加网站</button></div>}
      </div>
    </section>
  )
}
