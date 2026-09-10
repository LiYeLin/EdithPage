export type Site = {
  id: string
  name: string
  url: string
  description: string
  shortcut?: string
}

export type Module = {
  id: string
  title: string
  description: string
  accent: string
  sites: Site[]
}

export type SearchEngine = {
  id: 'google' | 'perplexity' | 'baidu'
  name: string
  homeUrl: string
  searchUrl: string
  domain: string
  placeholder: string
}

export type NavigationConfig = {
  modules: Module[]
  accent: 'mint' | 'violet' | 'orange'
}

export type EditorTarget =
  | { type: 'site'; moduleId: string; siteId: string }
  | { type: 'module'; moduleId: string }
  | null
