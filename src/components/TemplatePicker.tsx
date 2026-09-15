import { Check, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { TemplateDefinition } from '../templates/types'

type Props = {
  templates: readonly TemplateDefinition[]
  currentId: string
  loading: boolean
  busy: boolean
  error: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

export function TemplatePicker({ templates, currentId, loading, busy, error, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = dialog.current!
    const focusable = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]')]
    focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key === 'Tab') {
        const elements = focusable(), first = elements[0], last = elements.at(-1)
        if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { event.preventDefault(); first?.focus() }
      }
    }
    const focusin = (event: FocusEvent) => { if (!node.contains(event.target as Node)) focusable()[0]?.focus() }
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin)
    }
  }, [onClose])
  return <>
    <div className="drawer-backdrop is-open" data-editing-interactive onClick={onClose} />
    <aside ref={dialog} className="settings-drawer template-picker is-open" data-editing-interactive role="dialog" aria-modal="true" aria-labelledby="template-picker-title">
      <header className="drawer-head"><h2 id="template-picker-title">选择模板</h2><button className="icon-button" type="button" onClick={onClose} aria-label="关闭模板选择"><X size={20} /></button></header>
      <div className="drawer-scroll">
      <p className="template-picker-description">模板改变展示与交互，分类、站点和使用记录始终保留。</p>
      <div className="template-options" aria-busy={loading}>
        {templates.map(template => <button className="template-option" key={template.id} type="button" aria-pressed={template.id === currentId}
          disabled={loading || busy} onClick={() => onSelect(template.id)}>
          <span><strong>{template.name}</strong><small>{template.description}</small></span>
          {template.id === currentId && <span className="template-current"><Check size={16} />当前</span>}
        </button>)}
      </div>
      {loading && <p role="status">正在加载模板…可关闭面板取消。</p>}
      {busy && <p role="status">请等待拖动与动画结束。</p>}
      {error && <p role="alert">{error} 点击所选模板重试。</p>}
      </div>
    </aside>
  </>
}
