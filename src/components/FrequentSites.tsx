import type { Site } from '../types'
import { SiteTile } from './SiteTile'

export type FrequentSiteItem = {
  site: Site
  moduleId: string
}

type FrequentSitesProps = {
  sites: FrequentSiteItem[]
  isEditing: boolean
  onEnterEditMode: () => void
  onEditSite: (moduleId: string, siteId: string) => void
  onRemoveSite: (moduleId: string, siteId: string) => void
  onVisit: (siteId: string) => void
}

export function FrequentSites({
  sites,
  isEditing,
  onEnterEditMode,
  onEditSite,
  onRemoveSite,
  onVisit,
}: FrequentSitesProps) {
  return (
    <section className="frequent-panel" aria-labelledby="frequent-title">
      <header className="frequent-header">
        <span className="frequent-dot" />
        <h2 id="frequent-title">最常使用</h2>
        <span>{sites.length}</span>
      </header>

      <div className="frequent-list">
        {sites.map(({ site, moduleId }, index) => (
          <SiteTile
            key={site.id}
            site={site}
            moduleId={moduleId}
            variant="frequent"
            index={index}
            isEditing={isEditing}
            onEnterEditMode={onEnterEditMode}
            onEdit={() => onEditSite(moduleId, site.id)}
            onRemove={() => onRemoveSite(moduleId, site.id)}
            onVisit={() => onVisit(site.id)}
          />
        ))}
      </div>
    </section>
  )
}
