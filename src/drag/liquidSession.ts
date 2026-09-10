export type Arrival = { moduleId: string; siteId: string; variant: 'module' | 'frequent' }
export type LiquidPhase = 'idle' | 'lifting' | 'source-attached' | 'detached' | 'target-attracted' | 'settling-success' | 'settling-return'
export type ReleaseReason = 'complete' | 'timeout' | 'interrupted' | 'unmount'
export const SETTLE_LIMIT_MS = 360

type Clock = { schedule: (callback: () => void, ms: number) => () => void }
const clock: Clock = { schedule: (callback, ms) => { const id = setTimeout(callback, ms); return () => clearTimeout(id) } }

// Owns the deadline and pending placeholder independently of a draggable DOM node.
// A superseded session can finish only once; its callbacks cannot release a newer one.
export class LiquidSession {
  phase: LiquidPhase = 'lifting'
  pending: Arrival | null = null
  private cancelDeadline: (() => void) | null = null
  private readonly onPending: (arrival: Arrival | null) => void
  private readonly onRelease: (reason: ReleaseReason) => void
  private readonly clock: Clock

  constructor(onPending: (arrival: Arrival | null) => void, onRelease: (reason: ReleaseReason) => void, timer: Clock = clock) {
    this.onPending = onPending
    this.onRelease = onRelease
    this.clock = timer
  }

  get dragging() { return this.phase !== 'idle' && !this.phase.startsWith('settling-') }

  follow(sourceAttached: boolean, hasTarget: boolean) {
    if (!this.dragging) return
    this.phase = hasTarget ? 'target-attracted' : sourceAttached ? 'source-attached' : 'detached'
  }

  settle(moved: boolean, arrival: Arrival) {
    if (!this.dragging) return
    this.phase = moved ? 'settling-success' : 'settling-return'
    this.pending = arrival
    this.onPending(arrival)
    this.cancelDeadline = this.clock.schedule(() => this.finish('timeout'), SETTLE_LIMIT_MS)
  }

  finish(reason: ReleaseReason) {
    if (this.phase === 'idle') return
    this.phase = 'idle'
    this.cancelDeadline?.()
    this.cancelDeadline = null
    this.pending = null
    this.onPending(null)
    this.onRelease(reason)
  }
}
