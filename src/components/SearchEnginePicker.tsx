import { useId, useRef, useState } from 'react'
import { searchEngines } from '../data/defaultConfig'
import type { SearchEngine } from '../types'

// Fixed catalog: no runtime favicon service or network-dependent logo lookup.
const engineLogos: Record<string, string> = {
  google: '/site-icons/google.svg',
  perplexity: '/site-icons/perplexity.svg',
  baidu: '/site-icons/baidu.svg',
}

export function SearchEnginePicker({ engine, onChange }: {
  engine: SearchEngine
  onChange: (engine: SearchEngine) => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <div
      className={`engine-picker ${open ? 'is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
          trigger.current?.focus()
        }
        if (event.key === 'ArrowDown' && event.target === trigger.current) {
          event.preventDefault()
          setOpen(true)
          event.currentTarget.querySelector<HTMLButtonElement>('.engine-option')?.focus()
        }
      }}
    >
      <button ref={trigger} type="button" className="engine-trigger"
        aria-label={`当前引擎：${engine.name}，切换搜索引擎`}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)}>
        <img className="engine-logo" src={engineLogos[engine.id]} alt="" />
      </button>
      <div className="engine-options" id={id} role="group" aria-label="选择搜索引擎" inert={!open}>
        {searchEngines.map((item) => (
          <button key={item.id} type="button"
            aria-label={item.name} aria-pressed={engine.id === item.id}
            aria-describedby={`${id}-${item.id}`}
            className={`engine-option ${engine.id === item.id ? 'is-active' : ''}`}
            onClick={() => { onChange(item); setOpen(false) }}>
            <img className="engine-logo" src={engineLogos[item.id]} alt="" />
            <span className="engine-tooltip" role="tooltip" id={`${id}-${item.id}`}>{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
