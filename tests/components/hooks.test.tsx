// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from '../../src/hooks/useLongPress'
import { useMotionPreference } from '../../src/hooks/useMotionPreference'
import { useViewportWidth } from '../../src/hooks/useViewportWidth'
import { installDomStubs } from './testEnvironment'

function LongPressHarness({ onLongPress, delay = 500, moveThreshold = 9 }: {
  onLongPress: () => void
  delay?: number
  moveThreshold?: number
}) {
  const { longPressProps, consumeLongPressClick } = useLongPress(onLongPress, { delay, moveThreshold })
  return <button {...longPressProps} onClick={(event) => {
    if (consumeLongPressClick()) event.preventDefault()
  }}>长按目标</button>
}

beforeEach(() => {
  installDomStubs()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useLongPress', () => {
  it('主指针保持到延迟后触发一次长按、震动，并消费紧随其后的点击', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const vibrate = vi.fn()
    Object.defineProperty(window.navigator, 'vibrate', { configurable: true, value: vibrate })
    render(<LongPressHarness onLongPress={onLongPress} delay={300} />)
    const target = screen.getByRole('button', { name: '长按目标' })

    fireEvent.pointerDown(target, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 20 })
    act(() => vi.advanceTimersByTime(299))
    expect(onLongPress).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))

    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(10)
    const firstClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(target.dispatchEvent(firstClick)).toBe(false)
    const secondClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(target.dispatchEvent(secondClick)).toBe(true)
  })

  it.each([
    ['抬起', 'pointerUp'],
    ['取消', 'pointerCancel'],
    ['离开', 'pointerLeave'],
  ])('%s会在到期前取消长按', (_label, eventName) => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<LongPressHarness onLongPress={onLongPress} delay={100} />)
    const target = screen.getByRole('button', { name: '长按目标' })
    fireEvent.pointerDown(target, { pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 })
    fireEvent[eventName as 'pointerUp'](target)
    act(() => vi.advanceTimersByTime(120))
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('移动超过阈值取消，小于等于阈值仍触发', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<LongPressHarness onLongPress={onLongPress} delay={100} moveThreshold={5} />)
    const target = screen.getByRole('button', { name: '长按目标' })

    fireEvent.pointerDown(target, { pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(target, { pointerType: 'touch', clientX: 14, clientY: 13 })
    act(() => vi.advanceTimersByTime(100))
    expect(onLongPress).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(target, { pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(target, { pointerType: 'touch', clientX: 16, clientY: 10 })
    act(() => vi.advanceTimersByTime(100))
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('忽略非主指针和非左键鼠标，并在卸载时清理计时器', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const { unmount } = render(<LongPressHarness onLongPress={onLongPress} delay={100} />)
    const target = screen.getByRole('button', { name: '长按目标' })

    fireEvent.pointerDown(target, { pointerType: 'touch', isPrimary: false })
    fireEvent.pointerDown(target, { pointerType: 'mouse', isPrimary: true, button: 2 })
    act(() => vi.advanceTimersByTime(120))
    expect(onLongPress).not.toHaveBeenCalled()

    fireEvent.pointerDown(target, { pointerType: 'mouse', isPrimary: true, button: 0 })
    unmount()
    act(() => vi.advanceTimersByTime(120))
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('重新按下会替换旧计时器，并使用最新回调', () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<LongPressHarness onLongPress={first} delay={100} />)
    const target = screen.getByRole('button', { name: '长按目标' })
    fireEvent.pointerDown(target, { pointerType: 'touch', isPrimary: true })
    act(() => vi.advanceTimersByTime(60))
    rerender(<LongPressHarness onLongPress={second} delay={100} />)
    fireEvent.pointerDown(target, { pointerType: 'touch', isPrimary: true })
    act(() => vi.advanceTimersByTime(100))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('useMotionPreference', () => {
  it('读取当前媒体查询、响应 change，并在卸载时退订', () => {
    const media = installDomStubs(false)
    const { result, unmount } = renderHook(() => useMotionPreference())
    expect(result.current).toBe(false)
    expect(media.listeners.size).toBe(1)

    act(() => media.setMatches(true))
    expect(result.current).toBe(true)
    act(() => media.setMatches(false))
    expect(result.current).toBe(false)

    unmount()
    expect(media.listeners.size).toBe(0)
  })
})

describe('useViewportWidth', () => {
  it('读取窗口宽度、响应 resize，并在卸载后停止更新', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
    const remove = vi.spyOn(window, 'removeEventListener')
    const { result, unmount } = renderHook(() => useViewportWidth())
    expect(result.current).toBe(1280)

    act(() => {
      window.innerWidth = 390
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(390)

    unmount()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
