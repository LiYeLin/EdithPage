import type { IconService } from '../i18n/preferences'
// Match known hosts explicitly: broad suffix matches can give unrelated sites the wrong brand.
const siteIcons: Readonly<Record<string, string>> = {
  'chatgpt.com': 'chatgpt',
  'chat.openai.com': 'chatgpt',
  'openai.com': 'chatgpt',
  'claude.ai': 'claude',
  'gemini.google.com': 'gemini',
  'deepseek.com': 'deepseek',
  'chat.deepseek.com': 'deepseek',
  'perplexity.ai': 'perplexity',
  'cursor.com': 'cursor',
  'cursor.sh': 'cursor',
  'huggingface.co': 'huggingface',
  'kaggle.com': 'kaggle',
  'github.com': 'github',
  'stackoverflow.com': 'stackoverflow',
  'vercel.com': 'vercel',
  'docker.com': 'docker',
  'docs.docker.com': 'docker',
  'hub.docker.com': 'docker',
  'juejin.cn': 'juejin',
  'v2ex.com': 'v2ex',
  'news.ycombinator.com': 'hackernews',
  'dev.to': 'devto',
  'google.com': 'google',
  'baidu.com': 'baidu',
}

export function getLocalSiteIcon(domain: string): string | undefined {
  const host = domain.toLowerCase().replace(/^www\./, '')
  const icon = Object.hasOwn(siteIcons, host) ? siteIcons[host] : undefined
  return icon ? `/site-icons/${icon}.svg` : undefined
}

export function getSiteIconFallbackText(domain: string, name: string): string {
  return domain.toLowerCase().replace(/^www\./, '') === 'fast.ai'
    ? 'fast.ai' : (Array.from(name)[0] ?? '').toUpperCase()
}

export function getSiteIconSources(domain: string, service: IconService = 'google'): string[] {
  const local = getLocalSiteIcon(domain)
  // Only send a valid hostname, never a URL path, credential or query string.
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(domain)
    || domain.endsWith('.local') || domain.endsWith('.localhost')) return local ? [local] : []
  const remote = service === 'domestic'
    ? `https://cn.cravatar.com/favicon/api/index.php?url=${encodeURIComponent(domain)}`
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
  // Google returns a blurry placeholder for this host; the domestic service may resolve it.
  if (service === 'google' && domain.toLowerCase().replace(/^www\./, '') === 'fast.ai') return []
  return local ? [local, remote] : [remote]
}
