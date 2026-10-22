import type { SearchSelection } from '../types'

type SearchApi = {
  runtime?: { id?: string }
  search?: {
    query(options: { text: string; disposition: 'NEW_TAB' }): Promise<void>
  }
}

export const browserDefaultSearch: SearchSelection = {
  id: 'browser-default',
  name: '浏览器默认',
  placeholder: '使用浏览器默认搜索引擎搜索…',
}

function chromeApi(): SearchApi | undefined {
  return (globalThis as typeof globalThis & { chrome?: SearchApi }).chrome
}

export function isExtensionSearch(): boolean {
  return import.meta.env.VITE_EXTENSION_BUILD === 'true' || Boolean(chromeApi()?.runtime?.id)
}

export async function submitSearch(query: string, selection: SearchSelection): Promise<void> {
  const text = query.trim()
  if (isExtensionSearch() && !text) return

  if (selection.id === 'browser-default') {
    const api = chromeApi()
    if (!api?.search?.query) throw new Error('当前浏览器不支持默认搜索，请使用地址栏搜索。')
    try {
      await api.search.query({ text, disposition: 'NEW_TAB' })
    } catch {
      throw new Error('搜索未能打开，请重试或使用地址栏搜索。')
    }
    return
  }

  window.open(text ? `${selection.searchUrl}${encodeURIComponent(text)}` : selection.homeUrl,
    '_blank', 'noopener,noreferrer')
}
