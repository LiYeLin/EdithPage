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
    ? 'fast.ai' : name.slice(0, 1).toUpperCase()
}

export function getSiteIconSources(domain: string): string[] {
  // The service returns a decodable 16px globe for this host even with sz=128.
  // Skip that known placeholder instead of relying on img.onError to reject it.
  if (domain.toLowerCase().replace(/^www\./, '') === 'fast.ai') return []
  const local = getLocalSiteIcon(domain)
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
  return local ? [local, favicon] : [favicon]
}
