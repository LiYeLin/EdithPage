import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; onUnavailable: () => void }

// A decorative dependency failure must never take down the navigation or its DndContext.
export class LiquidEffectBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onUnavailable() }
  render() { return this.state.failed ? null : this.props.children }
}
