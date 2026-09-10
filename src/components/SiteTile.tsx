import { useDraggable } from '@dnd-kit/core'
import { X } from 'lucide-react'
import { useContext, type CSSProperties, type MouseEvent } from 'react'
import { ArrivalFeedbackContext, PendingArrivalContext, SiteDragEnabledContext } from '../drag/context'
import { useLongPress } from '../hooks/useLongPress'
import type { Site } from '../types'
import { SiteIcon } from './SiteIcon'

type SiteTileProps = {
  site: Site
  moduleId: string
  variant: 'module' | 'frequent'
  index: number
  isEditing: boolean
  onEnterEditMode: () => void
  onEdit: () => void
  onRemove: () => void
  onVisit: () => void
}

type JiggleStyle = CSSProperties & {
  '--jiggle-delay': string
  '--jiggle-duration': string
  '--jiggle-start': string
  '--jiggle-end': string
}

export function SiteTile({
  site,
  moduleId,
  variant,
  index,
  isEditing,
  onEnterEditMode,
  onEdit,
  onRemove,
  onVisit,
}: SiteTileProps) {
  const { longPressProps, consumeLongPressClick } = useLongPress(onEnterEditMode)
  const dragEnabled = useContext(SiteDragEnabledContext)
  const arrival = useContext(PendingArrivalContext)
  const feedback = useContext(ArrivalFeedbackContext)
  const pending = arrival?.siteId === site.id && arrival.moduleId === moduleId && arrival.variant === variant
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    // Frequent shortcuts and category icons are separate instances of the same persisted site.
    id: JSON.stringify([variant, moduleId, site.id]),
    disabled: !isEditing || !dragEnabled,
    data: { type: 'site', siteId: site.id, moduleId, variant },
  })
  const direction = index % 2 === 0 ? 1 : -1
  const jiggleStyle: JiggleStyle = {
    '--jiggle-delay': `${-(index % 7) * 23}ms`,
    '--jiggle-duration': `${165 + (index % 4) * 11}ms`,
    '--jiggle-start': `${direction * -1.35}deg`,
    '--jiggle-end': `${direction * 1.15}deg`,
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (consumeLongPressClick()) {
      event.preventDefault()
      return
    }

    if (isEditing) {
      event.preventDefault()
      onEdit()
      return
    }

    onVisit()
  }

  const handleRemove = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove()
  }

  const linkClassName = variant === 'module' ? 'site-link' : 'frequent-site'
  const wrapClassName = variant === 'module' ? 'site-link-wrap' : 'frequent-site-wrap'

  return (
    <div ref={setNodeRef} className={`site-tile-wrap ${wrapClassName} ${isDragging ? 'is-drag-source' : ''}`} style={jiggleStyle} data-site-id={site.id} data-module-id={moduleId} data-variant={variant} data-pending-arrival={pending || undefined} aria-hidden={pending || undefined}
      data-arrival-feedback={(feedback?.moduleId === moduleId && feedback.siteId === site.id && variant === 'module') || undefined}>
      <a
        {...(isEditing ? {} : longPressProps)}
        {...(isEditing ? attributes : {})}
        {...(isEditing ? listeners : {})}
        ref={setActivatorNodeRef}
        className={linkClassName}
        href={site.url}
        target="_blank"
        rel="noreferrer"
        draggable={false}
        tabIndex={pending ? -1 : 0}
        aria-label={isEditing ? `编辑 ${site.name}` : `${site.name}：${site.description}`}
        title={isEditing ? `编辑 ${site.name}` : site.description}
        onClick={handleClick}
        onContextMenu={(event) => event.preventDefault()}
      >
        <SiteIcon url={site.url} name={site.name} size={variant === 'module' ? 46 : 44} />
        <strong>{site.name}</strong>
      </a>
      {isEditing && (
        <button className="remove-site" type="button" tabIndex={pending ? -1 : 0} onClick={handleRemove} aria-label={`删除 ${site.name}`}>
          <X size={12} strokeWidth={2.6} />
        </button>
      )}
    </div>
  )
}
