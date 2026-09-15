import { useCallback, useEffect, useRef } from 'react'
import type { NavigationTemplateProps, TemplateInteractionState } from './types'
import type { LoadedTemplate } from './useTemplateSelection'

function MountedTemplate({ loaded, templateProps }: { loaded: LoadedTemplate; templateProps: NavigationTemplateProps }) {
  const alive = useRef(true)
  const notify = templateProps.onInteractionStateChange
  const report = useCallback((state: TemplateInteractionState) => {
    if (alive.current) notify(state)
  }, [notify])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      notify({ dragging: false, settling: false })
    }
  }, [notify])
  const Component = loaded.Component
  return <Component {...templateProps} onInteractionStateChange={report} />
}

export function TemplateHost({ active, error, retry, ...templateProps }: NavigationTemplateProps & {
  active: LoadedTemplate | null; error: string | null; retry: () => void
}) {
  if (!active) return <section className="template-placeholder" aria-label="导航模板" aria-busy={!error}>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={retry}>重试加载</button></> : <p role="status">正在加载导航模板…</p>}
  </section>
  return <div className="template-host" inert={templateProps.interactionBlocked}>
    {/* Only this subtree is keyed: search text, business state and undo deadlines survive. */}
    <MountedTemplate key={active.definition.id} loaded={active} templateProps={templateProps} />
  </div>
}
