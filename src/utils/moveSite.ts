import type { NavigationConfig } from '../types'

export type SiteMove = {
  siteId: string
  fromModuleId: string
  toModuleId: string
  toIndex?: number
}

// Both lists change together. Invalid/cancelled drops preserve the original object and site identity.
export function moveSite(config: NavigationConfig, move: SiteMove): NavigationConfig {
  const { siteId, fromModuleId, toModuleId, toIndex } = move
  if (fromModuleId === toModuleId) return config
  const source = config.modules.find((module) => module.id === fromModuleId)
  const target = config.modules.find((module) => module.id === toModuleId)
  const site = source?.sites.find((item) => item.id === siteId)
  if (!site || !target || target.sites.some((item) => item.id === siteId)) return config

  return {
    ...config,
    modules: config.modules.map((module) => {
      if (module.id === fromModuleId) {
        return { ...module, sites: module.sites.filter((item) => item.id !== siteId) }
      }
      if (module.id === toModuleId) {
        const sites = [...module.sites]
        sites.splice(toIndex === undefined ? sites.length : Math.max(0, Math.min(toIndex, sites.length)), 0, site)
        return { ...module, sites }
      }
      return module
    }),
  }
}
