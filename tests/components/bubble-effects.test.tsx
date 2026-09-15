// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { createRef, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomStubs, setDocumentVisibility } from './testEnvironment'

const motionBoundary = vi.hoisted(() => ({
  values: [] as Array<{ get: () => number; set: ReturnType<typeof vi.fn> }>,
  reset() { this.values.length = 0 },
}))

vi.mock('motion/react', async () => {
  const React = await import('react')
  const createValue = (initial: number) => {
    let value = initial
    const motionValue = {
      get: () => value,
      set: vi.fn((next: number) => { value = next }),
    }
    motionBoundary.values.push(motionValue)
    return motionValue
  }
  return {
    useMotionValue: (initial: number) => {
      const ref = React.useRef<ReturnType<typeof createValue> | null>(null)
      if (!ref.current) ref.current = createValue(initial)
      return ref.current
    },
  }
})

import { LiquidBubbleSkin } from '../../src/templates/bubble/components/LiquidBubbleSkin'
import { LiquidEffectBoundary } from '../../src/templates/bubble/components/LiquidEffectBoundary'
import { BubbleFloatProvider } from '../../src/templates/bubble/components/BubbleFloatProvider'
import { BubbleFloatContext, useBubbleFloat } from '../../src/templates/bubble/hooks/useBubbleFloat'
import { useBubbleLiquid } from '../../src/templates/bubble/hooks/useBubbleLiquid'
import { BubbleRuntimeContext } from '../../src/templates/bubble/runtime'

let rafCallbacks = new Map<number, FrameRequestCallback>()
let nextFrame = 1

function flushAnimationFrame(now: number) {
  const callbacks = [...rafCallbacks.values()]
  rafCallbacks.clear()
  callbacks.forEach((callback) => callback(now))
}

function FloatProbe({ id, zeroWidth = false }: { id: string; zeroWidth?: boolean }) {
  const { floatRef, floatStyle } = useBubbleFloat(id)
  return (
    <div ref={floatRef} className="bubble-float-body" data-testid={`float-${id}`}
      data-motion-values={String(Boolean(floatStyle.x && floatStyle.y))}>
      <div className="bubble-shell" data-zero-width={zeroWidth ? 'true' : 'false'} />
    </div>
  )
}

function FloatHarness({
  blocked = false,
  children = <FloatProbe id="alpha" />,
}: {
  blocked?: boolean
  children?: ReactNode
}) {
  const root = createRef<HTMLDivElement>()
  return (
    <BubbleRuntimeContext.Provider value={{ root, blocked }}>
      <div ref={root}>
        <BubbleFloatProvider blocked={blocked}>{children}</BubbleFloatProvider>
      </div>
    </BubbleRuntimeContext.Provider>
  )
}

function LiquidHarness({ enabled = true, ripple = true, punchBody = true }: {
  enabled?: boolean
  ripple?: boolean
  punchBody?: boolean
}) {
  const skinRef = useBubbleLiquid(enabled)
  const shell = (
    <div className="bubble-shell" data-testid="liquid-shell">
      {ripple && <span className="bubble-liquid-ripple" data-testid="liquid-ripple" />}
      <div ref={skinRef} className="bubble-liquid-skin" data-testid="liquid-skin" />
    </div>
  )
  return punchBody ? <div className="bubble-punch-body" data-testid="punch-body">{shell}</div> : shell
}

beforeEach(() => {
  installDomStubs()
  setDocumentVisibility('visible')
  motionBoundary.reset()
  rafCallbacks = new Map()
  nextFrame = 1
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++
    rafCallbacks.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    rafCallbacks.delete(id)
  }))
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function getBoundingClientRect(this: HTMLElement) {
      const width = this.dataset.zeroWidth === 'true' ? 0 : 100
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: width, width, height: width, toJSON: () => ({}) }
    },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('LiquidBubbleSkin 与 LiquidEffectBoundary', () => {
  it('液态皮肤保持装饰语义、必要层级并连接公开 ref', () => {
    const ref = createRef<HTMLDivElement>()
    const { container } = render(<LiquidBubbleSkin skinRef={ref} />)
    const layer = container.querySelector('.bubble-liquid-layer')!
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect(ref.current).toBe(container.querySelector('.bubble-liquid-skin'))
    expect(container.querySelector('.bubble-liquid-ripple')).not.toBeNull()
    expect(container.querySelectorAll('.reservoir-shine, .reservoir-glint, .reservoir-rim, .reservoir-caustic')).toHaveLength(4)
  })

  it('装饰效果子树异常时只移除效果并通知降级，不摧毁外层内容', () => {
    const onUnavailable = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function BrokenEffect(): ReactNode {
      throw new Error('liquid unavailable')
    }
    render(
      <div>
        <span>导航仍可用</span>
        <LiquidEffectBoundary onUnavailable={onUnavailable}><BrokenEffect /></LiquidEffectBoundary>
      </div>,
    )
    expect(screen.getByText('导航仍可用')).not.toBeNull()
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })
})

describe('useBubbleFloat 与 BubbleFloatProvider', () => {
  it('向公开上下文注册 DOM 和 MotionValue，id/context 变化与卸载都会注销', () => {
    const unregisterFirst = vi.fn()
    const unregisterSecond = vi.fn()
    const firstRegister = vi.fn(() => unregisterFirst)
    const secondRegister = vi.fn(() => unregisterSecond)
    const view = render(
      <BubbleFloatContext.Provider value={{ register: firstRegister }}><FloatProbe id="alpha" /></BubbleFloatContext.Provider>,
    )
    expect(firstRegister).toHaveBeenCalledWith(
      'alpha',
      screen.getByTestId('float-alpha'),
      motionBoundary.values[0],
      motionBoundary.values[1],
    )
    expect(screen.getByTestId('float-alpha').dataset.motionValues).toBe('true')

    view.rerender(
      <BubbleFloatContext.Provider value={{ register: secondRegister }}><FloatProbe id="beta" /></BubbleFloatContext.Provider>,
    )
    expect(unregisterFirst).toHaveBeenCalledTimes(1)
    expect(secondRegister).toHaveBeenCalledWith('beta', expect.any(HTMLElement), motionBoundary.values[0], motionBoundary.values[1])
    view.unmount()
    expect(unregisterSecond).toHaveBeenCalledTimes(1)
  })

  it('没有 provider 时安全降级，不尝试注册', () => {
    render(<FloatProbe id="standalone" />)
    expect(screen.getByTestId('float-standalone').dataset.motionValues).toBe('true')
  })

  it('桌面空闲三秒后开始浮动；用户活动和页面可见性会重新计算空闲窗口', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const view = render(<FloatHarness children={<><FloatProbe id="alpha" /><FloatProbe id="zero" zeroWidth /></>} />)
    expect(rafCallbacks.size).toBe(0)

    act(() => vi.advanceTimersByTime(2999))
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 20, clientY: 20 }))
    act(() => vi.advanceTimersByTime(2999))
    expect(rafCallbacks.size).toBe(0)
    act(() => vi.advanceTimersByTime(1))
    expect(rafCallbacks.size).toBe(1)

    act(() => flushAnimationFrame(3000))
    act(() => flushAnimationFrame(3016))
    expect(motionBoundary.values[0].set).toHaveBeenCalled()
    expect(motionBoundary.values[0].set.mock.calls.some(([value]) => value !== 0)).toBe(true)
    expect(motionBoundary.values[2].set.mock.calls.every(([value]) => value === 0)).toBe(true)

    setDocumentVisibility('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(rafCallbacks.size).toBe(0)
    setDocumentVisibility('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(3000))
    expect(rafCallbacks.size).toBe(1)

    view.unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('blocked、reduced-motion 和窄视口会停止或归零，并在卸载时清理监听', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const media = installDomStubs(false)
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const view = render(<FloatHarness />)
    act(() => vi.advanceTimersByTime(3000))
    act(() => flushAnimationFrame(3000))
    act(() => flushAnimationFrame(3016))

    motionBoundary.values[0].set.mockClear()
    motionBoundary.values[1].set.mockClear()
    act(() => media.setMatches(true))
    expect(motionBoundary.values[0].set).toHaveBeenLastCalledWith(0)
    expect(motionBoundary.values[1].set).toHaveBeenLastCalledWith(0)
    expect(rafCallbacks.size).toBe(0)

    act(() => media.setMatches(false))
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 900 })
    act(() => window.dispatchEvent(new Event('resize')))
    expect(motionBoundary.values[0].set).toHaveBeenLastCalledWith(0)

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
    act(() => window.dispatchEvent(new Event('resize')))
    view.rerender(<FloatHarness blocked />)
    act(() => vi.advanceTimersByTime(4000))
    expect(rafCallbacks.size).toBe(0)

    view.unmount()
    expect(removeDocument).toHaveBeenCalledWith('pointermove', expect.any(Function), true)
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(removeWindow).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })
})

describe('useBubbleLiquid', () => {
  it('disabled 时不安装交互效果，事件保持无副作用', () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    render(<LiquidHarness enabled={false} />)
    const shell = screen.getByTestId('liquid-shell')
    shell.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', isPrimary: true, clientX: 80, clientY: 50 }))
    shell.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 50, clientY: 50 }))
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(animate).not.toHaveBeenCalled()
  })

  it('只跟踪主非触摸指针，并在离开、blur、scroll 与尺寸变化时恢复高光', () => {
    render(<LiquidHarness />)
    const shell = screen.getByTestId('liquid-shell')
    const skin = screen.getByTestId('liquid-skin')
    shell.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch', isPrimary: true, clientX: 80, clientY: 50 }))
    shell.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', isPrimary: false, clientX: 80, clientY: 50 }))
    expect(requestAnimationFrame).not.toHaveBeenCalled()

    shell.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', isPrimary: true, clientX: 80, clientY: 50 }))
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    act(() => flushAnimationFrame(16))
    expect(skin.style.getPropertyValue('--bubble-light-x')).not.toBe('')
    expect(skin.style.getPropertyValue('--bubble-light-x')).not.toBe('-0.5300')

    shell.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', isPrimary: true, clientX: 180, clientY: 180 }))
    act(() => flushAnimationFrame(32))
    shell.dispatchEvent(new PointerEvent('pointerleave'))
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('scroll'))
    const observers = (ResizeObserver as unknown as { instances: Array<{ callback: ResizeObserverCallback }> }).instances
    act(() => observers.at(-1)?.callback([], observers.at(-1) as unknown as ResizeObserver))
    expect(requestAnimationFrame).toHaveBeenCalled()
  })

  it('主左键产生按压与涟漪，液态接触产生形变；取消和卸载完整清理', () => {
    const existingRippleAnimation = { cancel: vi.fn() } as unknown as Animation
    const createdAnimations: Array<{ element: HTMLElement; cancel: ReturnType<typeof vi.fn> }> = []
    vi.spyOn(HTMLElement.prototype, 'getAnimations').mockImplementation(function getAnimations(this: HTMLElement) {
      return this.classList.contains('bubble-liquid-ripple') ? [existingRippleAnimation] : []
    })
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function animate(this: HTMLElement) {
      const animation = { cancel: vi.fn() }
      createdAnimations.push({ element: this, cancel: animation.cancel })
      return animation as unknown as Animation
    })
    const view = render(<LiquidHarness />)
    const observers = (ResizeObserver as unknown as { instances: Array<{ disconnect: ReturnType<typeof vi.fn> }> }).instances
    const disconnect = observers.at(-1)?.disconnect
    expect(disconnect).toBeDefined()
    const shell = screen.getByTestId('liquid-shell')
    const skin = screen.getByTestId('liquid-skin')

    shell.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', isPrimary: true, button: 2, clientX: 50, clientY: 50 }))
    shell.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', isPrimary: false, button: 0, clientX: 50, clientY: 50 }))
    expect(createdAnimations).toHaveLength(0)

    shell.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 50, clientY: 50 }))
    expect(createdAnimations.map(({ element }) => element.className)).toEqual(expect.arrayContaining(['bubble-punch-body', 'bubble-liquid-ripple']))
    expect((existingRippleAnimation.cancel as ReturnType<typeof vi.fn>)).toHaveBeenCalled()

    shell.dispatchEvent(new CustomEvent('liquid-contact', {
      detail: { amount: 1, direction: { x: 0, y: 1 }, land: false },
    }))
    act(() => flushAnimationFrame(16))
    expect(skin.style.transform).toContain('translate(')

    shell.dispatchEvent(new CustomEvent('liquid-contact', {
      detail: { amount: 0, direction: { x: 1, y: 0 }, land: true },
    }))
    shell.dispatchEvent(new PointerEvent('pointercancel'))
    act(() => flushAnimationFrame(32))
    expect(createdAnimations.filter(({ element }) => element.classList.contains('bubble-liquid-ripple')).length).toBeGreaterThanOrEqual(2)

    view.unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalled()
    expect(createdAnimations.find(({ element }) => element.classList.contains('bubble-punch-body'))?.cancel).toHaveBeenCalled()
    expect(skin.style.transform).toBe('')
    expect(skin.style.getPropertyValue('--bubble-light-x')).toBe('-0.5300')
    expect(skin.style.getPropertyValue('--bubble-light-y')).toBe('-0.8400')
  })

  it('缺少涟漪或 punch 容器时仍安全处理点击和清理', () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    const view = render(<LiquidHarness ripple={false} punchBody={false} />)
    const shell = screen.getByTestId('liquid-shell')
    shell.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 0, clientY: 0 }))
    shell.dispatchEvent(new CustomEvent('liquid-contact', {
      detail: { amount: 0.04, direction: { x: -1, y: 0 } },
    }))
    act(() => flushAnimationFrame(16))
    expect(animate).not.toHaveBeenCalled()
    expect(screen.getByTestId('liquid-skin').style.transform).toContain('translate(')
    view.unmount()
  })
})
