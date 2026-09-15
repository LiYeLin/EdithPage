import { vi } from 'vitest'

type MediaListener = (event: MediaQueryListEvent) => void

export type MatchMediaController = {
  setMatches: (matches: boolean) => void
  listeners: Set<MediaListener>
}

export function installDomStubs(initialReducedMotion = false): MatchMediaController {
  const listeners = new Set<MediaListener>()
  let matches = initialReducedMotion
  const mediaQuery = {
    get matches() { return matches },
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: MediaListener) => listeners.delete(listener),
    addListener: (listener: MediaListener) => listeners.add(listener),
    removeListener: (listener: MediaListener) => listeners.delete(listener),
    dispatchEvent: () => true,
  } satisfies MediaQueryList

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => mediaQuery),
  })

  class TestPointerEvent extends MouseEvent {
    pointerId: number
    pointerType: string
    isPrimary: boolean

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
      this.isPrimary = init.isPrimary ?? true
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent)

  class TestResizeObserver implements ResizeObserver {
    static instances: TestResizeObserver[] = []
    readonly observe = vi.fn()
    readonly unobserve = vi.fn()
    readonly disconnect = vi.fn()
    constructor(readonly callback: ResizeObserverCallback) {
      TestResizeObserver.instances.push(this)
    }
  }
  vi.stubGlobal('ResizeObserver', TestResizeObserver)

  if (!window.requestAnimationFrame) {
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16),
    })
  }
  if (!window.cancelAnimationFrame) {
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: (id: number) => window.clearTimeout(id),
    })
  }

  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(function scrollTo(this: HTMLElement, options?: ScrollToOptions | number, y?: number) {
      if (typeof options === 'number') {
        this.scrollLeft = options
        this.scrollTop = y ?? 0
      } else if (options) {
        if (typeof options.left === 'number') this.scrollLeft = options.left
        if (typeof options.top === 'number') this.scrollTop = options.top
      }
    }),
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn(() => false),
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: vi.fn(() => ({ cancel: vi.fn() } as unknown as Animation)),
  })
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  })

  const existingCss = globalThis.CSS
  vi.stubGlobal('CSS', {
    ...existingCss,
    supports: vi.fn(() => false),
  })

  return {
    listeners,
    setMatches(next) {
      matches = next
      const event = { matches, media: mediaQuery.media } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}

export function setDocumentVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  Object.defineProperty(document, 'hidden', { configurable: true, value: state !== 'visible' })
}
