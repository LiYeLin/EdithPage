import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import type { NavigationTemplateProps, TemplateDefinition } from './types'

export type LoadedTemplate = { definition: TemplateDefinition; Component: ComponentType<NavigationTemplateProps> }

/** Load-before-replace. Request identity prevents cancelled/stale promises from committing. */
export function useTemplateSelection(catalog: readonly TemplateDefinition[], initialId: string) {
  const [active, setActive] = useState<LoadedTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const loadingRef = useRef(false)
  const cache = useRef(new Map<string, LoadedTemplate>())
  const initial = useRef(initialId)

  const invalidate = useCallback(() => { request.current++; loadingRef.current = false }, [])
  const cancel = useCallback(() => {
    invalidate()
    setLoading(false)
    setError(null)
  }, [invalidate])

  const load = useCallback(async (id: string, commit: (loaded: LoadedTemplate) => void) => {
    if (loadingRef.current) return
    const definition = catalog.find(item => item.id === id)
    if (!definition) return
    const token = ++request.current
    loadingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const loaded = cache.current.get(id) ?? { definition, Component: (await definition.load()).default }
      if (request.current !== token) return
      cache.current.set(id, loaded)
      commit(loaded)
    } catch {
      if (request.current === token) setError('模板加载失败，请重试。')
    } finally {
      if (request.current === token) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [catalog])

  const retryInitial = useCallback(() => { void load(initial.current, setActive) }, [load])
  useEffect(() => {
    retryInitial()
    return invalidate
  }, [retryInitial, invalidate])

  return { active, setActive, loading, error, load, cancel, retryInitial }
}
