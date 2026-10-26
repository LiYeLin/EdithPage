import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'zh-CN' })
