import { ArrowUpRight, Search, Sparkles } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import type { SearchEngine } from '../types'
import { SearchEnginePicker } from './SearchEnginePicker'

type SearchDeckProps = {
  engine: SearchEngine
  onEngineChange: (engine: SearchEngine) => void
}

export function SearchDeck({ engine, onEngineChange }: SearchDeckProps) {
  const [query, setQuery] = useState('')
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

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    window.open(value ? `${engine.searchUrl}${encodeURIComponent(value)}` : engine.homeUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="search-deck" aria-label="搜索">
      <SearchEnginePicker engine={engine} onChange={(item) => {
        onEngineChange(item)
        inputRef.current?.focus({ preventScroll: true })
      }} />

      <form className="search-form" onSubmit={submit}>
        <Search size={24} strokeWidth={1.8} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={engine.placeholder}
          aria-label={`使用 ${engine.name} 搜索`}
        />
        <span className="keyboard-hint"><span>⌘</span>K</span>
        <button className="search-submit" type="submit" aria-label="开始搜索">
          <Sparkles size={16} />
          <span>搜索</span>
          <ArrowUpRight size={16} />
        </button>
      </form>
      <div className="search-beam" />
    </section>
  )
}
