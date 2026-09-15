import './plain.css'
import { AppWindow, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { SiteIcon } from '../../components/SiteIcon'
import { FrequentSiteStrip } from '../../components/FrequentSiteStrip'
import type { Module, Site } from '../../types'
import type { NavigationTemplateProps } from '../types'

function PlainSiteTile({
  module,
  site,
  modules,
  editing,
  onEdit,
  onRemove,
  onMove,
  onVisit,
}: {
  module: Module
  site: Site
  modules: readonly Module[]
  editing: boolean
  onEdit: () => void
  onRemove: () => void
  onMove: (toModuleId: string) => void
  onVisit: () => void
}) {
  return (
    <article className={`plain-site-tile ${editing ? 'is-editing' : ''}`} data-editing-interactive data-plain-site={site.id}>
      <a
        className="plain-site-link"
        href={site.url}
        target="_blank"
        rel="noreferrer"
        onClick={onVisit}
        aria-label={`${site.name}，打开站点`}
      >
        <SiteIcon url={site.url} name={site.name} size={76} />
        <strong>{site.name}</strong>
      </a>
      {editing && (
        <div className="plain-site-editor" data-editing-interactive>
          <div className="plain-site-actions">
            <button type="button" onClick={onEdit} aria-label={`编辑 ${site.name}`} title="编辑">
              <Pencil size={13} />
            </button>
            <button type="button" onClick={onRemove} aria-label={`删除 ${site.name}`} title="删除">
              <Trash2 size={13} />
            </button>
          </div>
          <label className="plain-move-label">
            <span>移动到</span>
            <select
              aria-label={`移动 ${site.name}`}
              value=""
              onChange={(event) => onMove(event.target.value)}
            >
              <option value="" disabled>选择分类</option>
              {modules.filter((target) => target.id !== module.id).map((target) => (
                <option value={target.id} key={target.id}>{target.title}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </article>
  )
}

function PlainModuleActions({
  module,
  onEdit,
  onAdd,
  onRemove,
}: {
  module: Module
  onEdit: () => void
  onAdd: () => void
  onRemove: () => void
}) {
  return (
    <div className="plain-module-actions" data-editing-interactive>
      <button type="button" onClick={onEdit} aria-label={`编辑分类 ${module.title}`} title="编辑分类">
        <Pencil size={14} />
      </button>
      <button type="button" onClick={onAdd} aria-label={`添加到 ${module.title}`} title="添加站点">
        <Plus size={15} />
      </button>
      <button type="button" onClick={onRemove} aria-label={`删除分类 ${module.title}`} title="删除分类">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function PlainTemplate({
  modules,
  frequentSites,
  editing,
  actions,
  onInteractionStateChange,
}: NavigationTemplateProps) {
  useEffect(() => {
    onInteractionStateChange({ dragging: false, settling: false })
    return () => onInteractionStateChange({ dragging: false, settling: false })
  }, [onInteractionStateChange])

  return (
    <section className="plain-template" data-template="plain" aria-label="纯净应用网格模板">
      <FrequentSiteStrip sites={frequentSites} editing={editing} onEnterEditMode={actions.enterEditMode}
        onEdit={(moduleId, siteId) => actions.edit({ type: 'site', moduleId, siteId })}
        onRemove={actions.removeSite} onVisit={actions.visitSite} />
      <div className="plain-content">
        {modules.length > 0 ? (
          modules.map((module) => (
            <section className="plain-module" aria-labelledby={`plain-module-${module.id}`} key={module.id}>
              <div className="plain-module-heading" data-editing-interactive>
                <div>
                  <h3 id={`plain-module-${module.id}`}>{module.title}</h3>
                  <span>{module.sites.length} 个应用</span>
                </div>
                {editing ? (
                  <PlainModuleActions
                    module={module}
                    onEdit={() => actions.edit({ type: 'module', moduleId: module.id })}
                    onAdd={() => actions.addSite(module.id)}
                    onRemove={() => actions.removeModule(module.id)}
                  />
                ) : (
                  <button className="plain-module-edit-button" data-onboarding-edit type="button" onClick={actions.enterEditMode} aria-label={`进入编辑模式：${module.title}`}>
                    <Pencil size={13} />编辑
                  </button>
                )}
              </div>

              {module.sites.length > 0 ? (
                <div className="plain-site-grid">
                  {module.sites.map((site) => (
                    <PlainSiteTile
                      key={site.id}
                      module={module}
                      site={site}
                      modules={modules}
                      editing={editing}
                      onEdit={() => actions.edit({ type: 'site', moduleId: module.id, siteId: site.id })}
                      onRemove={() => actions.removeSite(module.id, site.id)}
                      onMove={(toModuleId) => actions.moveSite({ siteId: site.id, fromModuleId: module.id, toModuleId })}
                      onVisit={() => actions.visitSite(site.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="plain-empty-state">
                  <AppWindow size={28} strokeWidth={1.5} />
                  <p>这个分类还没有应用</p>
                  {editing && (
                    <button type="button" onClick={() => actions.addSite(module.id)}>
                      <Plus size={15} />添加站点
                    </button>
                  )}
                </div>
              )}
            </section>
          ))
        ) : (
          <div className="plain-empty-state">
            <AppWindow size={28} strokeWidth={1.5} />
            <p>还没有分类</p>
            <button type="button" onClick={actions.openSettings}>
              <Plus size={15} />创建分类
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="plain-editing-note" data-editing-interactive>
          <Check size={14} />编辑模式：修改完成后点击空白处退出
        </div>
      )}
    </section>
  )
}
