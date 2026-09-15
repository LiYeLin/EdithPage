import { Pencil, Trash2 } from 'lucide-react'
import { SiteIcon } from './SiteIcon'
import type { FrequentSiteItem } from '../types'

type FrequentSiteStripProps = {
  sites: readonly FrequentSiteItem[]
  editing: boolean
  onEnterEditMode: () => void
  onEdit: (moduleId: string, siteId: string) => void
  onRemove: (moduleId: string, siteId: string) => void
  onVisit: (siteId: string) => void
}

export function FrequentSiteStrip({ sites, editing, onEnterEditMode, onEdit, onRemove, onVisit }: FrequentSiteStripProps) {
  return (
    <section className="frequent-site-strip" aria-labelledby="frequent-site-strip-title">
      <header className="frequent-site-strip-header">
        <h2 id="frequent-site-strip-title">最常使用</h2>
        <span>{sites.length}</span>
      </header>
      <div className="frequent-site-strip-list">
        {sites.map(({ site, moduleId }) => (
          <div className="frequent-site-strip-item" key={site.id}>
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              aria-label={editing ? `编辑 ${site.name}` : `${site.name}：${site.description}`}
              onClick={(event) => {
                if (editing) {
                  event.preventDefault()
                  onEdit(moduleId, site.id)
                } else {
                  onVisit(site.id)
                }
              }}
            >
              <SiteIcon url={site.url} name={site.name} size={34} />
              <strong>{site.name}</strong>
            </a>
            {!editing && (
              <button type="button" onClick={onEnterEditMode} aria-label={`编辑最常使用的 ${site.name}`}>
                <Pencil size={11} />
              </button>
            )}
            {editing && (
              <span className="frequent-site-strip-actions" data-editing-interactive>
                <button type="button" onClick={() => onEdit(moduleId, site.id)} aria-label={`编辑 ${site.name}`}>
                  <Pencil size={11} />
                </button>
                <button type="button" onClick={() => onRemove(moduleId, site.id)} aria-label={`删除 ${site.name}`}>
                  <Trash2 size={11} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
