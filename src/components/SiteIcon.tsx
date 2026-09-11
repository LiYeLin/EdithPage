import { useMemo, useState } from 'react'
import { getSiteIconFallbackText, getSiteIconSources } from '../data/siteIcons'
import { getDomain } from '../utils'

type SiteIconProps = {
  url: string
  name: string
  size?: number
}

function SiteIconImage({ domain, name, size }: { domain: string; name: string; size: number }) {
  const sources = useMemo(() => getSiteIconSources(domain), [domain])
  const [sourceIndex, setSourceIndex] = useState(0)
  const src = sources[sourceIndex]
  const fallbackText = getSiteIconFallbackText(domain, name)

  return src ? (
    <img key={src} src={src} alt="" width={size} height={size}
      onError={() => setSourceIndex((index) => index + 1)} />
  ) : (
    <span className={`site-icon-fallback${fallbackText === 'fast.ai' ? ' site-icon-wordmark' : ''}`}>{fallbackText}</span>
  )
}

export function SiteIcon({ url, name, size = 40 }: SiteIconProps) {
  const domain = getDomain(url)

  return (
    <span className="site-icon" style={{ width: size, height: size }} aria-hidden="true">
      {/* Reset failed sources when an existing shortcut is edited to a different host. */}
      <SiteIconImage key={domain} domain={domain} name={name} size={size} />
    </span>
  )
}
