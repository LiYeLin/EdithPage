import { useContext, useEffect, useState } from 'react'
import { PreferencesContext } from '../i18n/PreferencesContext'
import type { IconService } from '../i18n/preferences'
import { getSiteIconFallbackText, getSiteIconSources } from '../data/siteIcons'
import { getDomain } from '../utils'

type SiteIconProps = {
  url: string
  name: string
  size?: number
}

function SiteIconImage({ domain, name, size, service }: { domain: string; name: string; size: number; service: IconService }) {
  const sources = getSiteIconSources(domain, service)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [loadedSource, setLoadedSource] = useState<string | null>(null)
  const src = sources[sourceIndex]
  useEffect(() => {
    if (!src || loadedSource === src) return
    const timer = window.setTimeout(() => setSourceIndex(index => index === sourceIndex ? index + 1 : index), 8000)
    return () => window.clearTimeout(timer)
  }, [src, loadedSource, sourceIndex])
  const fallbackText = getSiteIconFallbackText(domain, name)

  return src ? (
    <img key={src} src={src} referrerPolicy="no-referrer" onLoad={() => setLoadedSource(src)} alt="" width={size} height={size} draggable={false}
      onError={() => setSourceIndex(index => index === sourceIndex ? index + 1 : index)} />
  ) : (
    <span className={`site-icon-fallback${fallbackText === 'fast.ai' ? ' site-icon-wordmark' : ''}`}>{fallbackText}</span>
  )
}

export function SiteIcon({ url, name, size = 40 }: SiteIconProps) {
  const { preferences } = useContext(PreferencesContext)
  const domain = getDomain(url).toLowerCase()

  return (
    <span className="site-icon" style={{ width: size, height: size }} aria-hidden="true">
      {/* Reset failed sources when an existing shortcut is edited to a different host. */}
      <SiteIconImage key={`${domain}:${preferences.iconService}`} domain={domain} name={name} size={size} service={preferences.iconService} />
    </span>
  )
}
