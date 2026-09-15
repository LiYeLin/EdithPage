import { useEffect, useRef, useState } from 'react'
import type { NavigationTemplateProps } from '../../src/templates/types'

/** Test fixture: deliberately no bubble DOM, dnd-kit or liquid renderer. */
export default function ListTemplate({ modules, frequentSites, editing, interactionBlocked, revealSite, actions, onInteractionStateChange }: NavigationTemplateProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [moves, setMoves] = useState(0)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return <section data-template="list" aria-label="列表测试模板" inert={interactionBlocked}>
    <button type="button" data-onboarding-edit onClick={actions.enterEditMode}>进入列表编辑</button>
    <button type="button" onClick={actions.openSettings}>列表设置</button>
    <p>移动成功次数：{moves}</p>
    <p role="status">{revealSite ? `定位 ${revealSite.moduleId}/${revealSite.siteId}` : '无定位请求'}</p>
    <div data-editing-interactive>
      {/* Deterministic protocol probes complement real bubble drag tests, not replace them. */}
      {(['dragging', 'settling'] as const).map(phase => <button key={phase} onClick={() => {
        onInteractionStateChange({ dragging: phase === 'dragging', settling: phase === 'settling' })
        timer.current = setTimeout(() => onInteractionStateChange({ dragging: false, settling: false }), 800)
      }}>模拟{phase}</button>)}
    </div>
    <section data-editing-interactive aria-label="列表最常使用"><h2>最常使用</h2>
      <ul>{frequentSites.map(({ site }) => <li key={site.id}><a href={site.url} target="_blank" rel="noreferrer" onClick={() => actions.visitSite(site.id)}>{site.name}</a></li>)}</ul>
    </section>
    {modules.map(module => <section data-editing-interactive key={module.id} data-list-module={module.id}>
      <h2>{module.title}</h2>
      {editing && <><button onClick={() => actions.edit({ type: 'module', moduleId: module.id })}>编辑分类 {module.title}</button>
        <button onClick={() => actions.removeModule(module.id)}>删除分类 {module.title}</button>
        <button onClick={() => actions.addSite(module.id)}>添加到 {module.title}</button></>}
      <ul>{module.sites.map(site => <li key={site.id} data-list-site={site.id}>
        <a href={site.url} target="_blank" rel="noreferrer" onClick={() => actions.visitSite(site.id)}>{site.name}</a>
        {editing && <><button onClick={() => actions.edit({ type: 'site', moduleId: module.id, siteId: site.id })}>编辑 {site.name}</button>
          <button onClick={() => actions.removeSite(module.id, site.id)}>删除 {site.name}</button>
          <select aria-label={`移动 ${site.name}`} value="" onChange={event => {
            const move = { siteId: site.id, fromModuleId: module.id, toModuleId: event.target.value }
            if (actions.moveSite(move)) setMoves(count => count + 1)
            // Deliberately submit twice to check the shared atomic duplicate guard.
            if (actions.moveSite(move)) setMoves(count => count + 1)
          }}><option value="" disabled>移到分类</option>{modules.filter(target => target.id !== module.id).map(target => <option value={target.id} key={target.id}>{target.title}</option>)}</select></>}
      </li>)}</ul>
    </section>)}
  </section>
}
