import { useMemo, useState } from 'react'
import { getDomain } from '../utils'

type SiteIconProps = {
  url: string
  name: string
  size?: number
}

export function SiteIcon({ url, name, size = 40 }: SiteIconProps) {
  const [failed, setFailed] = useState(false)
  const domain = useMemo(() => getDomain(url), [url])
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`

  return (
    <span className="site-icon" style={{ width: size, height: size }} aria-hidden="true">
      {failed ? (
        <span className="site-icon-fallback">{name.slice(0, 1).toUpperCase()}</span>
      ) : (
        <img src={src} alt="" width={size} height={size} onError={() => setFailed(true)} />
      )}
    </span>
  )
}
