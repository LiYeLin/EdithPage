import { useTranslation } from '../i18n/useTranslation'
import { ArrowUpRight, Search, Sparkles } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import type { SearchSelection } from '../types'
import { submitSearch } from '../platform/search'
import { SearchEnginePicker } from './SearchEnginePicker'

type SearchDeckProps = {
  engine: SearchSelection
  onEngineChange: (engine: SearchSelection) => void
}

export function SearchDeck({ engine, onEngineChange }: SearchDeckProps) {
  const t = useTranslation()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus({ preventScroll: true })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await submitSearch(query, engine)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '搜索未能打开，请使用地址栏搜索。')
    }
  }

  return (
    <section data-editing-interactive className="search-deck" aria-label={t("搜索")}>
      <SearchEnginePicker engine={engine} onChange={(item) => {
        setError(null)
        onEngineChange(item)
        inputRef.current?.focus({ preventScroll: true })
      }} />

      <form className="search-form" onSubmit={submit}>
        <Search size={24} strokeWidth={1.8} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setError(null) }}
          placeholder={t(engine.placeholder)}
          aria-label={t("使用 {0} 搜索", t(engine.name))}
        />
        <span className="keyboard-hint"><span>⌘</span>K</span>
        <button className="search-submit" type="submit" aria-label={t("开始搜索")}>
          <Sparkles size={16} />
          <span>{t("搜索")}</span>
          <ArrowUpRight size={16} />
        </button>
      </form>
      <div className="search-beam" />
      {error && <div className="search-error" role="alert">{t(error)}</div>}
    </section>
  )
}
